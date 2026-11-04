import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) for (const suffix of [".ts", ".js"]) {
    const candidate = new URL(`${specifier}${suffix}`, context.parentURL); if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });
const bookings = await import("../convex/eventBookings.ts");
const waitlist = await import("../convex/eventWaitlist.ts");
const policy = await import("../convex/lib/eventPaymentPolicy.ts");
process.env.EVENT_REGISTRATION_PRICE_CENTS = "4900";
function fixture(capacity = 1) {
  let actor = "seller", sequence = 0;
  const tables = { users: ["seller", "other", "admin"].map(id => ({ _id: id, externalId: id, email: `${id}@example.test`, role: id === "admin" ? "admin" : "user", notificationPreferences: { emailEnabled: false } })), vehicles: [{ _id: "car", title: "My car", userId: "seller", status: "active" }, { _id: "other-car", userId: "other", status: "approved", title: "Other car" }], events: [{ _id: "event", name: "Market", date: Date.now() + 30 * 86400000, capacity }] };
  const rows = table => tables[table] ?? [];
  const get = async id => Object.values(tables).flat().find(row => row._id === id) ?? null;
  const scheduled = [];
  function query(table) {
    const predicates = []; let descending = false;
    const b = { eq(field, value) { predicates.push(row => row[field] === value); return b; }, lte(field, value) { predicates.push(row => row[field] <= value); return b; }, gt(field, value) { predicates.push(row => row[field] > value); return b; } };
    const q = { withIndex(_name, callback) { callback(b); return q; }, order(direction) { descending = direction === "desc"; return q; }, collect: async () => { const selected = rows(table).filter(row => predicates.every(fn => fn(row))); return descending ? [...selected].reverse() : selected; }, first: async () => (await q.collect())[0] ?? null, unique: async () => { const selected = await q.collect(); assert.ok(selected.length <= 1); return selected[0] ?? null; }, take: async count => (await q.collect()).slice(0, count), paginate: async ({ cursor, numItems }) => { const selected = await q.collect(), offset = Number(cursor ?? 0); return { page: selected.slice(offset, offset + numItems), continueCursor: String(offset + numItems), isDone: offset + numItems >= selected.length }; } };
    return q;
  }
  const ctx = { auth: { getUserIdentity: async () => actor ? { subject: actor } : null }, db: { get, query, insert: async (table, fields) => { const id = `row-${++sequence}`; (tables[table] ??= []).push({ _id: id, ...fields }); return id; }, patch: async (id, patch) => Object.assign(await get(id), patch) }, scheduler: { runAfter: async (...args) => scheduled.push(args) } };
  return { ctx, rows, get, scheduled, as: value => { actor = value; }, add: (table, row) => (tables[table] ??= []).push(row) };
}

const reserve = f => bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "car" });
const join = f => waitlist.join._handler(f.ctx, { eventId: "event", vehicleId: "other-car" });
test("deadline closes new reservations and waitlist but honors an existing priced hold", async () => {
  const f = fixture(2); const hold = await reserve(f);
  await f.ctx.db.patch("event", { registrationDeadline: Date.now() - 1, registrationFeeCents: 6000 });
  assert.equal((await reserve(f)).amount, 4900);
  f.as("other"); await assert.rejects(bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car" }), /deadline/);
  await assert.rejects(join(f), /no longer/); assert.equal((await f.get(hold._id)).status, "held");
});
test("FIFO promotion reserves capacity atomically and direct checkout cannot bypass the queue", async () => {
  const f = fixture(); const hold = await reserve(f); f.as("other"); const entry = await join(f); assert.equal(await join(f), entry);
  assert.equal(f.rows("eventInventories")[0].waiting, 1);
  await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "confirmed expired" });
  f.as("seller"); await assert.rejects(reserve(f), /waitlist/);
  await waitlist.promote._handler(f.ctx, { eventId: "event" });
  const row = await f.get(entry); assert.equal(row.status, "offered"); assert.equal(f.rows("eventInventories")[0].held, 1); assert.equal(f.rows("eventInventories")[0].waiting, 0);
  await waitlist.promote._handler(f.ctx, { eventId: "event" }); assert.equal(f.rows("eventReservations").length, 2);
  f.as("other"); const offer = await bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car" }); assert.equal(offer._id, row.reservationId);
  assert.equal(f.rows("notifications").length, 1);
});
test("promotion skips suspended or unapproved owners and never charges anyone automatically", async () => {
  const f = fixture(); const hold = await reserve(f); f.as("other"); const id = await join(f);
  await f.ctx.db.patch("other", { suspendedAt: Date.now() }); await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "expired" });
  await waitlist.promote._handler(f.ctx, { eventId: "event" }); assert.equal((await f.get(id)).status, "ineligible"); assert.equal(f.rows("eventInventories")[0].held, 0); assert.equal(f.rows("eventPayments").length, 0);
});
test("leaving the waitlist requires ownership and preserves other users' positions", async () => {
  const f = fixture(); await reserve(f); f.as("other"); const id = await join(f); f.as("seller");
  await assert.rejects(waitlist.leave._handler(f.ctx, { waitlistId: id }), /not found/); f.as("other");
  await waitlist.leave._handler(f.ctx, { waitlistId: id }); await waitlist.leave._handler(f.ctx, { waitlistId: id }); assert.equal(f.rows("eventInventories")[0].waiting, 0); assert.equal((await f.get(id)).status, "left");
});
test("deadline cancellation drains queued vehicles instead of offering unavailable admission", async () => {
  const f = fixture(); await reserve(f); f.as("other"); const id = await join(f); await f.ctx.db.patch("event", { registrationDeadline: Date.now() - 1 });
  await waitlist.promote._handler(f.ctx, { eventId: "event" }); assert.equal((await f.get(id)).status, "ineligible"); assert.equal(f.rows("eventInventories")[0].waiting, 0);
});
test("attempted invitation checkouts retain capacity until authoritative provider reconciliation releases them", async () => {
  const f = fixture(); const hold = await reserve(f); f.as("other"); const id = await join(f); await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "expired" });
  await waitlist.promote._handler(f.ctx, { eventId: "event" }); const row = await f.get(id); await f.ctx.db.patch(row.reservationId, { expiresAt: 0, checkoutCreateAttemptAt: 1 }); await f.ctx.db.patch(id, { updatedAt: 0 });
  await waitlist.sweep._handler(f.ctx, {}); assert.equal((await f.get(id)).status, "offered"); assert.equal(f.rows("eventInventories")[0].held, 1);
  await bookings.releaseReservation._handler(f.ctx, { reservationId: row.reservationId, reason: "provider confirms no charge" }); await f.ctx.db.patch(id, { updatedAt: 0 });
  await waitlist.sweep._handler(f.ctx, {}); assert.equal((await f.get(id)).status, "expired"); assert.equal(f.rows("eventInventories")[0].held, 0);
});
test("rules require explicit consent and immutable offered rules survive subsequent event edits", async () => {
  const f = fixture(); await f.ctx.db.patch("event", { eventRules: "Original rules" }); await assert.rejects(reserve(f), /Accept/);
  const hold = await bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "car", acceptRules: true }); assert.equal(hold.rulesSnapshot, "Original rules");
  f.as("other"); const id = await join(f); await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "expired" }); await waitlist.promote._handler(f.ctx, { eventId: "event" });
  await f.ctx.db.patch("event", { eventRules: "New rules" }); await assert.rejects(bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car" }), /Accept/);
  const offer = await bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car", acceptRules: true }); assert.equal(offer.rulesSnapshot, "Original rules"); assert.ok((await f.get((await f.get(id)).reservationId)).rulesAcceptedAt);
});
test("registration cutoff is exclusive and canceled or started events fail closed", () => {
  assert.equal(policy.acceptsNewRegistrations({ date: 100, registrationDeadline: 50 }, 49), true);
  assert.equal(policy.acceptsNewRegistrations({ date: 100, registrationDeadline: 50 }, 50), false);
  assert.equal(policy.acceptsNewRegistrations({ date: 100 }, 100), false);
  assert.equal(policy.acceptsNewRegistrations({ date: 100, cancelledAt: 1 }, 2), false);
});

test("first waitlist claim grants a fresh payment window once and preserves idempotent expiry", async () => {
  const f = fixture(); const hold = await reserve(f); f.as("other"); const id = await join(f); await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "expired" });
  await waitlist.promote._handler(f.ctx, { eventId: "event" }); const row = await f.get(id);
  await f.ctx.db.patch(row.reservationId, { expiresAt: Date.now() + 1000 });
  const claimed = await bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car" }); assert.ok(claimed.expiresAt > Date.now() + 30 * 60_000); assert.ok(claimed.waitlistClaimedAt);
  assert.equal((await bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car" })).expiresAt, claimed.expiresAt);
});
test("unclaimed offer cancellation releases capacity, claimed cancellation retains it for provider reconciliation", async () => {
  for (const claim of [false, true]) {
    const f = fixture(); const hold = await reserve(f); f.as("other"); const id = await join(f); await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "expired" }); await waitlist.promote._handler(f.ctx, { eventId: "event" });
    const row = await f.get(id); if (claim) await bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car" });
    await waitlist.leave._handler(f.ctx, { waitlistId: id }); assert.equal(f.rows("eventInventories")[0].held, claim ? 1 : 0);
    const reservation = await f.get(row.reservationId); assert.equal(reservation.status, claim ? "held" : "expired"); if (claim) assert.ok(reservation.cancellationRequestedAt);
  }
});
test("provider create intent is durable and canceled reservations cannot initiate checkout", async () => {
  const f = fixture(); const hold = await reserve(f); await bookings.markCheckoutAttempt._handler(f.ctx, { reservationId: hold._id }); assert.ok((await f.get(hold._id)).checkoutCreateAttemptAt);
  await f.ctx.db.patch(hold._id, { cancellationRequestedAt: Date.now() }); await assert.rejects(bookings.markCheckoutAttempt._handler(f.ctx, { reservationId: hold._id }), /no longer/);
});

test("stale expiry reconciliation cannot release a newly claimed waitlist reservation", async () => {
  const f = fixture(); const hold = await reserve(f); f.as("other"); const id = await join(f); await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "expired" }); await waitlist.promote._handler(f.ctx, { eventId: "event" });
  const row = await f.get(id); await f.ctx.db.patch(row.reservationId, { expiresAt: Date.now() + 1000 }); const staleExpiry = (await f.get(row.reservationId)).expiresAt;
  await bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car" });
  await bookings.releaseReservation._handler(f.ctx, { reservationId: row.reservationId, reason: "stale worker", expectedExpiresAt: staleExpiry });
  assert.equal((await f.get(row.reservationId)).status, "held"); assert.equal(f.rows("eventInventories")[0].held, 1);
});

test("multiple promotions preserve FIFO and stop at the available inventory", async () => {
  const f = fixture(); const hold = await reserve(f); f.as("other"); const first = await join(f);
  f.add("users", { _id: "third", externalId: "third", email: "third@example.test", role: "user", notificationPreferences: { emailEnabled: false } });
  f.add("vehicles", { _id: "third-car", userId: "third", status: "approved", title: "Third car" }); f.as("third");
  const second = await waitlist.join._handler(f.ctx, { eventId: "event", vehicleId: "third-car" });
  await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "expired" }); await waitlist.promote._handler(f.ctx, { eventId: "event" });
  assert.equal((await f.get(first)).status, "offered"); assert.equal((await f.get(second)).status, "waiting"); assert.equal(f.rows("eventInventories")[0].held, 1);
  await f.ctx.db.patch("event", { capacity: 2 }); await waitlist.promote._handler(f.ctx, { eventId: "event" });
  assert.equal((await f.get(second)).status, "offered"); assert.equal(f.rows("eventInventories")[0].held, 2); assert.equal(f.rows("eventInventories")[0].waiting, 0);
});

test("older active waitlists count toward limits even after hundreds of closed entries", async () => {
  const f = fixture(); await reserve(f); f.as("other");
  for (let i = 0; i < 5; i++) f.add("eventWaitlist", { _id: `active-wait-${i}`, eventId: `old-event-${i}`, vehicleId: `old-car-${i}`, userId: "other", status: i % 2 ? "offered" : "waiting", createdAt: i, updatedAt: i });
  for (let i = 0; i < 120; i++) f.add("eventWaitlist", { _id: `closed-wait-${i}`, eventId: `closed-event-${i}`, vehicleId: `closed-car-${i}`, userId: "other", status: "left", createdAt: 100 + i, updatedAt: 100 + i });
  await assert.rejects(join(f), /Leave an existing waitlist/);
});

test("older active holds count toward direct checkout limits after long closed history", async () => {
  const f = fixture(10);
  for (let i = 0; i < 5; i++) f.add("eventReservations", { _id: `active-hold-${i}`, eventId: `old-event-${i}`, vehicleId: `old-car-${i}`, userId: "seller", status: "held" });
  for (let i = 0; i < 120; i++) f.add("eventReservations", { _id: `closed-hold-${i}`, eventId: `closed-event-${i}`, vehicleId: `closed-car-${i}`, userId: "seller", status: "expired" });
  await assert.rejects(reserve(f), /Finish or cancel/);
});

test("older active holds prevent waitlist promotion despite newer closed history", async () => {
  const f = fixture(); const hold = await reserve(f); f.as("other"); const id = await join(f);
  for (let i = 0; i < 5; i++) f.add("eventReservations", { _id: `active-offer-hold-${i}`, eventId: `old-event-${i}`, vehicleId: `old-car-${i}`, userId: "other", status: "held" });
  for (let i = 0; i < 120; i++) f.add("eventReservations", { _id: `closed-offer-hold-${i}`, eventId: `closed-event-${i}`, vehicleId: `closed-car-${i}`, userId: "other", status: "expired" });
  await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "expired" }); await waitlist.promote._handler(f.ctx, { eventId: "event" });
  assert.equal((await f.get(id)).status, "waiting"); assert.equal(f.rows("eventInventories")[0].held, 0);
});

test("expired untouched invitation releases locally and promotes the next vehicle without Stripe", async () => {
  const f = fixture(); const hold = await reserve(f); f.as("other"); const first = await join(f);
  f.add("users", { _id: "third", externalId: "third", email: "third@example.test", role: "user", notificationPreferences: { emailEnabled: false } });
  f.add("vehicles", { _id: "third-car", userId: "third", status: "approved", title: "Third car" }); f.as("third");
  const second = await waitlist.join._handler(f.ctx, { eventId: "event", vehicleId: "third-car" });
  await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "expired" }); await waitlist.promote._handler(f.ctx, { eventId: "event" });
  const invitation = await f.get(first); await f.ctx.db.patch(invitation.reservationId, { expiresAt: 0 }); await f.ctx.db.patch(first, { updatedAt: 0 });
  await waitlist.sweep._handler(f.ctx, {}); assert.equal((await f.get(first)).status, "expired"); assert.equal((await f.get(invitation.reservationId)).status, "expired"); assert.equal(f.rows("eventInventories")[0].held, 0);
  await waitlist.promote._handler(f.ctx, { eventId: "event" }); assert.equal((await f.get(second)).status, "offered"); assert.equal(f.rows("eventInventories")[0].held, 1);
  assert.equal(f.rows("eventPayments").length, 0); assert.ok(f.rows("notifications").some(row => row.link === "/events/event/register?vehicleId=third-car"));
});

test("claimed invitations cannot expire locally even when provider creation has not started", async () => {
  const f = fixture(); const hold = await reserve(f); f.as("other"); const id = await join(f); await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "expired" }); await waitlist.promote._handler(f.ctx, { eventId: "event" });
  const row = await f.get(id); await bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car" });
  await f.ctx.db.patch(row.reservationId, { expiresAt: 0 }); await f.ctx.db.patch(id, { updatedAt: 0 }); await waitlist.sweep._handler(f.ctx, {});
  assert.equal((await f.get(row.reservationId)).status, "held"); assert.equal((await f.get(id)).status, "offered"); assert.equal(f.rows("eventInventories")[0].held, 1);
});
