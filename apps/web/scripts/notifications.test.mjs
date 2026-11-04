import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    for (const suffix of [".ts", ".js"]) {
      const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
} });
const notifications = await import("../convex/notifications.ts");
const favorites = await import("../convex/favorites.ts");
const registrations = await import("../convex/registrations.ts");
const eventBookings = await import("../convex/eventBookings.ts");
function fixture() {
  let actor = "buyer", sequence = 0;
  const tables = { users: ["buyer", "seller", "admin"].map(id => ({ _id: id, externalId: id, role: id === "admin" ? "admin" : "user", email: `${id}@example.test`, emailVerified: true })), vehicles: [{ _id: "car", userId: "seller", status: "active", title: "Public listing" }], events: [{ _id: "event", capacity: 10 }] };
  const rows = table => tables[table] ?? [];
  const get = async id => Object.values(tables).flat().find(row => row._id === id) ?? null;
  function query(table) {
    const predicates = []; let descending = false;
    const builder = { eq(field, value) { predicates.push(row => row[field] === value); return builder; } };
    const q = { withIndex(_name, callback) { callback(builder); return q; }, order(direction) { descending = direction === "desc"; return q; },
      collect: async () => { const selected = rows(table).filter(row => predicates.every(predicate => predicate(row))); return descending ? [...selected].reverse() : selected; },
      unique: async () => { const selected = await q.collect(); assert.ok(selected.length <= 1); return selected[0] ?? null; },
      first: async () => (await q.collect())[0] ?? null, take: async count => (await q.collect()).slice(0, count),
      paginate: async options => { const selected = await q.collect(); const offset = Number(options.cursor ?? 0); return { page: selected.slice(offset, offset + options.numItems), isDone: offset + options.numItems >= selected.length, continueCursor: String(offset + options.numItems) }; } };
    return q;
  }
  const scheduled = [];
  const ctx = { auth: { getUserIdentity: async () => actor ? { subject: actor } : null }, db: { get, query,
    insert: async (table, fields) => { const id = `id-${++sequence}`; (tables[table] ??= []).push({ _id: id, ...fields }); return id; },
    patch: async (id, patch) => Object.assign(await get(id), patch), delete: async id => { for (const table of Object.values(tables)) { const index = table.findIndex(row => row._id === id); if (index >= 0) table.splice(index, 1); } } }, scheduler: { runAfter: async (...args) => scheduled.push(args) } };
  return { ctx, rows, scheduled, as: id => { actor = id; }, add: (table, row) => (tables[table] ??= []).push(row) };
}
const update = { userId: "buyer", category: "messages", kind: "new_message", message: "Private body stays in app", link: "/myAccount/messages", dedupeKey: "message:unique" };

test("notification + outbox deduplicate and emails exclude private content", async () => {
  const f = fixture();
  const id = await notifications.enqueueNotification(f.ctx, update);
  assert.equal(await notifications.enqueueNotification(f.ctx, update), id);
  assert.equal(f.rows("notifications").length, 1); assert.equal(f.rows("emailOutbox").length, 1);
  assert.equal(f.scheduled.length, 1); assert.ok(!f.rows("emailOutbox")[0].message.includes("Private body"));
  await notifications.updatePreferences._handler(f.ctx, { emailEnabled: true, messages: false, listings: true, favorites: true, events: true });
  await notifications.enqueueNotification(f.ctx, { ...update, dedupeKey: "message:next" });
  assert.equal(f.rows("notifications").length, 2); assert.equal(f.rows("emailOutbox").length, 1);
});

test("notification pages and read state belong to the authenticated account, including suspended support", async () => {
  const f = fixture(); const id = await notifications.enqueueNotification(f.ctx, update);
  f.as("seller");
  assert.deepEqual((await notifications.list._handler(f.ctx, { paginationOpts: { cursor: null, numItems: 1000 } })).page, []);
  await assert.rejects(notifications.markRead._handler(f.ctx, { id }), /not found/);
  f.as("buyer"); f.rows("users")[0].suspendedAt = 1;
  const page = await notifications.list._handler(f.ctx, { paginationOpts: { cursor: null, numItems: 10 } });
  assert.equal(page.page.length, 1); await notifications.markRead._handler(f.ctx, { id }); assert.ok(f.rows("notifications")[0].readAt);
  f.as(null); await assert.rejects(notifications.preferences._handler(f.ctx, {}), /Authentication/);
});

test("favorite actions derive actor and cannot repeatedly notify a seller through toggling", async () => {
  const f = fixture();
  await favorites.addFavorite._handler(f.ctx, { vehicleId: "car", userId: "seller" });
  assert.equal(f.rows("favorites")[0].userId, "buyer"); assert.equal(f.rows("notifications")[0].userId, "seller");
  assert.equal(f.rows("emailOutbox")[0].sourceUserId, "buyer");
  await favorites.removeFavorite._handler(f.ctx, { vehicleId: "car" });
  await favorites.addFavorite._handler(f.ctx, { vehicleId: "car" });
  assert.equal(f.rows("notifications").length, 1); assert.equal(f.rows("emailOutbox").length, 1);
});

test("event payment replays and repeated check-ins produce one notification per transition", async () => {
  const f = fixture(); f.as("seller");
  Object.assign(f.rows("events")[0], { date: Date.now() + 14 * 86_400_000, registrationFeeCents: 4900, name: "Market" });
  const reservation = await eventBookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "car" });
  const args = { reservationId: reservation._id, stripeSessionId: "cs_paid", stripePaymentId: "pi_paid", amount: 4900, currency: "usd", qrCodeData: "private-admission-token", metadataValid: true };
  const paid = await eventBookings.recordPayment._handler(f.ctx, args);
  const id = paid.registrationId;
  assert.equal((await eventBookings.recordPayment._handler(f.ctx, args)).registrationId, id);
  assert.equal(f.rows("notifications").length, 1); assert.equal(f.rows("emailOutbox").length, 1);
  const admission = { eventId: "event", id, requestId: "notification-checkin", expectedRevision: 0 };
  f.as("buyer"); await assert.rejects(registrations.checkInRegistration._handler(f.ctx, admission), /Access to this event/);
  f.as("admin"); await registrations.checkInRegistration._handler(f.ctx, admission); await registrations.checkInRegistration._handler(f.ctx, admission);
  assert.equal(f.rows("notifications").length, 2); assert.equal(f.rows("emailOutbox").length, 2);
  assert.ok(!JSON.stringify(f.rows("notifications")).includes("private-admission-token"));
  assert.ok(!JSON.stringify(f.rows("emailOutbox")).includes("private-admission-token"));
});

test("legacy backfill never sends email and repeated runs preserve newly-read unified entries", async () => {
  const f = fixture(); f.add("listingNotifications", { _id: "legacy", userId: "buyer", vehicleId: "car", kind: "active", message: "Approved", createdAt: 1 });
  await notifications.backfillLegacy._handler(f.ctx, { cursor: null });
  assert.equal(f.rows("emailOutbox").length, 0);
  const row = f.rows("notifications")[0]; assert.equal(row.createdAt, 1);
  await notifications.markRead._handler(f.ctx, { id: row._id }); const readAt = row.readAt;
  await notifications.backfillLegacy._handler(f.ctx, { cursor: null }); assert.equal(row.readAt, readAt); assert.equal(f.rows("notifications").length, 1);
});

test("follower status fanout uses bounded pages and preserves seller attribution for block checks", async () => {
  const f = fixture(); f.add("favorites", { _id: "favorite", userId: "buyer", vehicleId: "car" });
  await notifications.notifyFollowers._handler(f.ctx, { vehicleId: "car", kind: "sold", revision: 1, cursor: null });
  assert.equal(f.rows("notifications")[0].userId, "buyer"); assert.equal(f.rows("emailOutbox")[0].sourceUserId, "seller");
  await notifications.notifyFollowers._handler(f.ctx, { vehicleId: "car", kind: "sold", revision: 1, cursor: null });
  assert.equal(f.rows("emailOutbox").length, 1);
});
