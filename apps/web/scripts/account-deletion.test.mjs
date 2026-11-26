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

const users = await import("../convex/users.ts");
const auth = await import("../convex/lib/authorization.ts");
const trust = await import("../convex/lib/trustGuards.ts");
const visibility = await import("../convex/lib/vehicleVisibility.ts");
const discovery = await import("../convex/discovery.ts");
const wantedApi = await import("../convex/wanted.ts");
const deletion = await import("../convex/accountDeletion.ts");
const emailRecords = await import("../convex/emailRecords.ts");
const photoRequestMedia = await import("../convex/photoRequestMedia.ts");
const wantedMedia = await import("../convex/wantedMedia.ts");

function fixture() {
  const owner = { _id: "owner", externalId: "clerk-owner", name: "Private Seller", email: "seller@example.com", phone: "919-555-0100", emailVerified: true, phoneVerified: true, role: "user", createdAt: 1 };
  const vehicle = { _id: "vehicle", userId: "owner", status: "active", title: "Private car", make: "Honda", model: "Pilot", year: 2019, mileage: 100, price: 1000, photos: ["https://example.com/car.jpg"], media: [], description: "Private description", contactInfo: "private phone", vin: "PRIVATEVIN", location: { city: "Raleigh", state: "NC" }, createdAt: 1 };
  const wanted = { _id: "wanted", userId: "owner", status: "active", title: "Wanted family SUV", maxBudget: 28000, zip: "27601", area: "Raleigh, NC", make: "Honda", createdAt: 1 };
  const tables = { users: [owner, { _id: "buyer", externalId: "clerk-buyer", name: "Buyer", email: "buyer@example.com", role: "user" }], vehicles: [vehicle], wantedRequests: [wanted], photoPublicSelections: [], offerCycles: [], offerThreads: [], offerActions: [], offerNoticeRefs: [], vehicleCatalog: [], vehicleSearchTerms: [], favorites: [], savedSearches: [], recentViews: [], notifications: [], listingNotifications: [], emailOutbox: [], vehicleMedia: [], ownershipUploadLeases: [], vinDecodeLimits: [], trustRateLimits: [], userBlocks: [], photoRequestPhotos: [], wantedReplyPhotos: [], policyAcceptances: [], eventPayments: [], trustReports: [], adminAuditLog: [] };
  const scheduled = [];
  const deletedStorage = [];
  const query = table => {
    const predicates = [];
    const builder = { eq(field, value) { predicates.push(row => row[field] === value); return builder; },
      gt(field, value) { predicates.push(row => row[field] > value); return builder; } };
    const rows = () => (tables[table] ?? []).filter(row => predicates.every(predicate => predicate(row)));
    const q = { withIndex(_index, filter) { filter(builder); return q; }, order() { return q; },
      unique: async () => rows()[0] ?? null, first: async () => rows()[0] ?? null, take: async count => rows().slice(0, count),
      paginate: async ({ numItems, cursor }) => {
        // Model a stable index cursor even when cleanup deletes earlier rows.
        const remaining = rows().filter(row => cursor === null || row._id > cursor).sort((a, b) => a._id.localeCompare(b._id));
        const page = remaining.slice(0, numItems);
        return { page, isDone: remaining.length <= numItems, continueCursor: page.at(-1)?._id ?? cursor };
      } };
    return q;
  };
  const ctx = { auth: { getUserIdentity: async () => ({ subject: "clerk-owner" }) },
    db: { normalizeId: (_table, value) => value, query,
      insert: async (table, fields) => { const id = `${table}-${tables[table].length + 1}`; tables[table].push({ _id: id, ...fields }); return id; },
      get: async id => Object.values(tables).flat().find(row => row._id === id) ?? null,
      patch: async (id, fields) => Object.assign(Object.values(tables).flat().find(row => row._id === id), fields),
      delete: async id => { for (const rows of Object.values(tables)) { const index = rows.findIndex(row => row._id === id); if (index >= 0) rows.splice(index, 1); } } },
    scheduler: { runAfter: async (...args) => scheduled.push(args), runAt: async (...args) => scheduled.push(args) }, storage: { delete: async id => deletedStorage.push(id) } };
  return { ctx, owner, vehicle, wanted, tables, scheduled, deletedStorage };
}

test("Clerk deletion creates an idempotent scrubbed tombstone and delayed upsert cannot restore it", async () => {
  const f = fixture();
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  assert.equal(f.owner._id, "owner");
  assert.equal(f.owner.name, "Deleted account");
  assert.equal(f.owner.email, "");
  assert.equal(f.owner.phone, undefined);
  assert.ok(f.owner.deletedAt);
  assert.deepEqual(f.scheduled[0][2], { userId: "owner", phase: "vehicles", cursor: null });
  const firstDeletedAt = f.owner.deletedAt;
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  assert.equal(f.owner.deletedAt, firstDeletedAt);
  await users.upsertFromClerk._handler(f.ctx, { data: { id: "clerk-owner", first_name: "Restored", last_name: "Name", email_addresses: [] } });
  assert.equal(f.owner.name, "Deleted account");
  assert.equal(await auth.getCurrentUser(f.ctx), null);
  await assert.rejects(auth.requireCurrentUser(f.ctx), /Authentication required/);
});

test("delete-before-create webhook order leaves an unrevivable tombstone", async () => {
  const f = fixture();
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-unknown" });
  const tombstone = f.tables.users.find(row => row.externalId === "clerk-unknown");
  assert.equal(tombstone.name, "Deleted account");
  await users.upsertFromClerk._handler(f.ctx, { data: { id: "clerk-unknown", first_name: "Late", email_addresses: [] } });
  assert.equal(tombstone.name, "Deleted account");
});

test("tombstoned seller content disappears before bounded cleanup finishes", async () => {
  const f = fixture();
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  assert.equal(await visibility.isPublicVehicleFromActiveSeller(f.ctx, f.vehicle), false);
  f.wanted.expiresAt = Date.now() + 86_400_000;
  assert.deepEqual((await wantedApi.browse._handler(f.ctx, { paginationOpts: { cursor: null, numItems: 10 } })).page, []);
  assert.deepEqual(await discovery.sharedListing._handler(f.ctx, { id: "vehicle" }), { kind: "unavailable" });
  await assert.rejects(trust.assertCanContact(f.ctx, "buyer", "owner"), /cannot receive messages/);
});

test("bounded cleanup archives public listings and scrubs wanted source while preserving IDs", async () => {
  const f = fixture();
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  await deletion.cleanup._handler(f.ctx, { userId: "owner", phase: "vehicles", cursor: null });
  assert.equal(f.vehicle.status, "archived");
  assert.deepEqual(f.vehicle.photos, []);
  assert.equal(f.vehicle.contactInfo, "");
  assert.equal(f.vehicle.vin, undefined);
  assert.deepEqual(f.scheduled.at(-1)[2], { userId: "owner", phase: "wanted", cursor: null });
  await deletion.cleanup._handler(f.ctx, { userId: "owner", phase: "wanted", cursor: null });
  assert.equal(f.wanted._id, "wanted");
  assert.equal(f.wanted.status, "deleted");
  assert.equal(f.wanted.zip, "");
  assert.equal(f.wanted.title, "");
  const selection = { _id: "selection", sellerId: "owner", status: "pending" };
  f.tables.photoPublicSelections.push(selection);
  await deletion.cleanup._handler(f.ctx, { userId: "owner", phase: "photoPublicSelections", cursor: null });
  assert.equal(selection.status, "stale");
  assert.equal(selection.reason, "Seller account deleted");
});

test("archiving a deleted seller's reserved listing closes its accepted offer", async () => {
  const f = fixture();
  f.vehicle.status = "reserved";
  const cycle = { _id: "cycle", vehicleId: "vehicle", winner: "thread", closedAt: undefined };
  const thread = { _id: "thread", cycleId: "cycle", vehicleId: "vehicle", sellerId: "owner", buyerId: "buyer", status: "reserved", version: 2, proposalVersion: 1, conversationId: "conversation" };
  f.tables.offerCycles.push(cycle);
  f.tables.offerThreads.push(thread);
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  await deletion.cleanup._handler(f.ctx, { userId: "owner", phase: "vehicles", cursor: null });
  assert.equal(f.vehicle.status, "archived");
  assert.equal(thread.status, "listing_closed");
  assert.ok(thread.closedAt);
  assert.ok(cycle.closedAt);
  assert.equal(cycle.winner, undefined);
});

test("archiving a deleted seller's active listing closes its offer cycle", async () => {
  const f = fixture();
  const cycle = { _id: "cycle", vehicleId: "vehicle", closedAt: undefined };
  f.tables.offerCycles.push(cycle);
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  await deletion.cleanup._handler(f.ctx, { userId: "owner", phase: "vehicles", cursor: null });
  assert.equal(f.vehicle.status, "archived");
  assert.ok(cycle.closedAt);
  assert.equal(cycle.needsClosure, true);
});

test("an email claimed before deletion is skipped at the final send check", async () => {
  const f = fixture();
  const outbox = { _id: "mail", userId: "owner", status: "sending", leaseToken: "lease",
    recipientEmail: "seller@example.com", unsubscribeToken: "unsubscribe" };
  f.tables.emailOutbox.push(outbox);
  assert.equal(await emailRecords.checkBeforeSend._handler(f.ctx, { id: "mail", leaseToken: "wrong" }), null);
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  assert.equal(await emailRecords.checkBeforeSend._handler(f.ctx, { id: "mail", leaseToken: "lease" }), null);
  assert.equal(outbox.status, "skipped");
  assert.equal(outbox.recipientEmail, undefined);
  assert.equal(outbox.leaseToken, undefined);
});

test("multi-page cleanup resumes after deleting earlier rows", async () => {
  const f = fixture();
  for (let index = 0; index < 120; index++) f.tables.favorites.push({ _id: `favorite-${String(index).padStart(3, "0")}`, userId: "owner", vehicleId: "vehicle" });
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  let cursor = null;
  for (let page = 0; page < 3; page++) {
    await deletion.cleanup._handler(f.ctx, { userId: "owner", phase: "favorites", cursor });
    const scheduled = f.scheduled.at(-1)?.[2];
    assert.ok(scheduled);
    if (page < 2) { assert.equal(scheduled.phase, "favorites"); cursor = scheduled.cursor; }
    else assert.equal(scheduled.phase, "savedSearches");
  }
  assert.equal(f.tables.favorites.length, 0);
});

test("deletion removes transient account data and unattached uploads but retains conversation photos", async () => {
  const f = fixture();
  f.tables.ownershipUploadLeases.push({ _id: "lease", userId: "owner", token: "secret" });
  f.tables.vinDecodeLimits.push({ _id: "vin-limit", userId: "owner" });
  f.tables.trustRateLimits.push({ _id: "rate-limit", userId: "owner" });
  f.tables.userBlocks.push({ _id: "outgoing-block", userId: "owner", blockedUserId: "buyer" });
  f.tables.userBlocks.push({ _id: "incoming-block", userId: "buyer", blockedUserId: "owner" });
  f.tables.photoRequestPhotos.push({ _id: "unattached-request", userId: "owner", sourceId: "source-1", detailId: "detail-1" });
  f.tables.photoRequestPhotos.push({ _id: "attached-request", userId: "owner", entryId: "entry", detailId: "detail-2" });
  f.tables.wantedReplyPhotos.push({ _id: "unattached-wanted", userId: "owner", sourceId: "source-3" });
  f.tables.wantedReplyPhotos.push({ _id: "attached-wanted", userId: "owner", messageId: "message", detailId: "detail-4" });
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  for (const phase of ["ownershipUploadLeases", "vinDecodeLimits", "trustRateLimits", "userBlocks", "photoRequestUploads", "wantedReplyUploads"])
    await deletion.cleanup._handler(f.ctx, { userId: "owner", phase, cursor: null });
  assert.equal(f.tables.ownershipUploadLeases.length, 0);
  assert.equal(f.tables.vinDecodeLimits.length, 0);
  assert.equal(f.tables.trustRateLimits.length, 0);
  assert.deepEqual(f.tables.userBlocks.map(row => row._id), ["incoming-block"]);
  assert.deepEqual(f.tables.photoRequestPhotos.map(row => row._id), ["attached-request"]);
  assert.deepEqual(f.tables.wantedReplyPhotos.map(row => row._id), ["attached-wanted"]);
  assert.deepEqual(f.deletedStorage.sort(), ["detail-1", "source-1", "source-3"]);
});

test("cleanup preserves consent, payment, safety, and audit evidence pending privacy review", async () => {
  const f = fixture();
  const records = {
    policyAcceptances: { _id: "consent", userId: "owner", termsVersion: "test-version" },
    eventPayments: { _id: "payment", userId: "owner", status: "paid" },
    trustReports: { _id: "safety", targetUserId: "owner", status: "open" },
    adminAuditLog: { _id: "audit", targetUserId: "owner", action: "reviewed" },
  };
  const expected = structuredClone(records);
  for (const [table, row] of Object.entries(records)) f.tables[table].push(row);
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  for (const phase of ["vehicles", "wanted", "photoPublicSelections", "ownershipUploadLeases", "vinDecodeLimits", "trustRateLimits", "userBlocks", "photoRequestUploads", "wantedReplyUploads", "comparisons", "favorites", "savedSearches", "recentViews", "notifications", "listingNotifications", "emailOutbox", "vehicleMedia"])
    await deletion.cleanup._handler(f.ctx, { userId: "owner", phase, cursor: null });
  for (const [table, row] of Object.entries(expected)) assert.deepEqual(f.tables[table], [row]);
});

test("in-flight private photo processing cannot complete after account deletion", async () => {
  const f = fixture();
  f.tables.photoRequestPhotos.push({ _id: "request-upload", userId: "owner", status: "processing", sourceId: "request-source", expiresAt: Date.now() + 1000 });
  f.tables.wantedReplyPhotos.push({ _id: "wanted-upload", userId: "owner", status: "processing", sourceId: "wanted-source", expiresAt: Date.now() + 1000 });
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  await assert.rejects(photoRequestMedia.complete._handler(f.ctx, { photoId: "request-upload", detailId: "request-detail" }), /Upload unavailable/);
  await assert.rejects(wantedMedia.complete._handler(f.ctx, { photoId: "wanted-upload", detailId: "wanted-detail" }), /Upload unavailable/);
  assert.equal(f.tables.photoRequestPhotos[0].detailId, undefined);
  assert.equal(f.tables.wantedReplyPhotos[0].detailId, undefined);
});

test("operator recovery restarts only a tombstoned account and records the reason", async () => {
  const f = fixture();
  await assert.rejects(deletion.restart._handler(f.ctx, { clerkUserId: "clerk-owner", reason: "Scheduled page failed" }), /Deleted account not found/);
  await users.deleteFromClerk._handler(f.ctx, { clerkUserId: "clerk-owner" });
  await assert.rejects(deletion.restart._handler(f.ctx, { clerkUserId: "clerk-owner", reason: "short" }), /recovery reason/);
  const result = await deletion.restart._handler(f.ctx, { clerkUserId: "clerk-owner", reason: "Scheduled cleanup page failed; restarting from first phase" });
  assert.deepEqual(result, { scheduled: true });
  assert.deepEqual(f.scheduled.at(-1)[2], { userId: "owner", phase: "vehicles", cursor: null });
  assert.equal(f.tables.adminAuditLog.length, 1);
  assert.equal(f.tables.adminAuditLog[0].targetUserId, "owner");
  assert.equal(f.tables.adminAuditLog[0].action, "account_deletion_cleanup_restarted");
});
