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
const ops = await import("../convex/eventOperations.ts");
const legacy = await import("../convex/registrations.ts");
const authorization = await import("../convex/lib/authorization.ts");
function fixture(capacity = 1) {
  let actor = "seller", sequence = 0;
  const tables = { users: ["seller", "other", "admin"].map(id => ({ _id: id, externalId: id, email: `${id}@example.test`, role: id === "admin" ? "admin" : "user", notificationPreferences: { emailEnabled: false } })), vehicles: [{ _id: "car", title: "My car", userId: "seller", status: "active" }, { _id: "other-car", userId: "other", status: "approved", title: "Other car" }], events: [{ _id: "event", name: "Market", date: Date.now() + 30 * 86400000, capacity }] };
  const rows = table => tables[table] ?? [];
  const get = async id => Object.values(tables).flat().find(row => row._id === id) ?? null;
  const scheduled = [];
  const searched = [];
  function query(table) {
    const predicates = []; let descending = false;
    const b = { search(field, value) { searched.push({ table, field, value }); predicates.push(row => String(row[field] ?? "").toLowerCase().includes(value.toLowerCase())); return b; }, eq(field, value) { predicates.push(row => row[field] === value); return b; }, lte(field, value) { predicates.push(row => row[field] <= value); return b; }, gt(field, value) { predicates.push(row => row[field] > value); return b; } };
    const q = { withSearchIndex(name, callback) { assert.equal(name, "search_roster"); callback(b); return q; }, withIndex(_name, callback) { callback(b); return q; }, order(direction) { descending = direction === "desc"; return q; }, collect: async () => { const selected = rows(table).filter(row => predicates.every(fn => fn(row))); return descending ? [...selected].reverse() : selected; }, first: async () => (await q.collect())[0] ?? null, unique: async () => { const selected = await q.collect(); assert.ok(selected.length <= 1); return selected[0] ?? null; }, take: async count => (await q.collect()).slice(0, count), paginate: async ({ cursor, numItems }) => { const selected = await q.collect(), offset = Number(cursor ?? 0); return { page: selected.slice(offset, offset + numItems), continueCursor: String(offset + numItems), isDone: offset + numItems >= selected.length }; } };
    return q;
  }
  const ctx = { auth: { getUserIdentity: async () => actor ? { subject: actor } : null }, db: { get, query, insert: async (table, fields) => { const id = `row-${++sequence}`; (tables[table] ??= []).push({ _id: id, ...fields }); return id; }, patch: async (id, patch) => Object.assign(await get(id), patch) }, scheduler: { runAfter: async (...args) => scheduled.push(args) } };
  return { ctx, rows, get, scheduled, searched, as: value => { actor = value; }, add: (table, row) => (tables[table] ??= []).push(row) };
}
function staffFixture() {
  const f = fixture(10);
  f.add("events", { _id: "other-event", date: Date.now() + 86400000, capacity: 10 });
  f.add("eventStaff", { _id: "assignment", eventId: "event", userId: "seller", role: "checkin" });
  f.add("eventStaff", { _id: "manager", eventId: "event", userId: "other", role: "manager" });
  f.add("registrations", { _id: "registration", userId: "seller", vehicleId: "car", eventId: "event", paymentStatus: "completed", checkedIn: false, rosterSearch: "Unavailable seller Red convertible", qrCodeData: "secret-qr", stripePaymentId: "secret-payment", receiptUrl: "secret-receipt" });
  return f;
}
const command = { eventId: "event", registrationId: "registration", requestId: "request-one", expectedRevision: 0 };
test("event staff cannot cross event boundaries or call administrator functions", async () => {
  const f = staffFixture();
  await assert.rejects(ops.getRoster._handler(f.ctx, { eventId: "other-event", paginationOpts: { cursor: null, numItems: 20 } }), /Access to this event/);
  await assert.rejects(authorization.requireAdmin(f.ctx), /Administrator/);
  await assert.rejects(ops.assignStaff._handler(f.ctx, { eventId: "other-event", userId: "seller", role: "manager" }), /Access to this event/);
  f.as("other");
  await assert.rejects(ops.assignStaff._handler(f.ctx, { eventId: "event", userId: "seller", role: "manager" }), /administrators can assign event managers/);
  f.as("seller");
  await assert.rejects(ops.undoCheckIn._handler(f.ctx, { ...command, reason: "Mistake" }), /Access/);
  f.as("admin"); assert.ok(await ops.getMetrics._handler(f.ctx, { eventId: "other-event" }));
  f.as("seller"); await f.ctx.db.patch("seller", { suspendedAt: Date.now() });
  await assert.rejects(ops.lookup._handler(f.ctx, { eventId: "event", qrCodeData: "secret-qr" }), /suspended/);
});
test("QR validation binds selected event and exposes only operational fields", async () => {
  const f = staffFixture();
  const row = await ops.lookup._handler(f.ctx, { eventId: "event", qrCodeData: "secret-qr" });
  assert.deepEqual(Object.keys(row).sort(), ["checkedIn", "paymentStatus", "registrationId", "revision", "sellerName", "vehicleId", "vehicleLabel"].sort());
  f.as("admin"); assert.equal(await legacy.validateQRCode._handler(f.ctx, { eventId: "other-event", qrCodeData: "secret-qr" }), null);
  assert.equal(await ops.lookup._handler(f.ctx, { eventId: "other-event", registrationId: "registration" }), null);
});
test("check-in retries are idempotent, undo audits and rejects stale offline intent", async () => {
  const f = staffFixture();
  assert.equal((await ops.checkInRegistration._handler(f.ctx, command)).revision, 1);
  assert.equal((await ops.checkInRegistration._handler(f.ctx, command)).status, "replayed");
  assert.equal(f.rows("adminAuditLog").length, 1);
  assert.equal((await ops.getMetrics._handler(f.ctx, { eventId: "event" })).attended, 1);
  f.as("other"); await ops.undoCheckIn._handler(f.ctx, { eventId: "event", registrationId: "registration", expectedRevision: 1, reason: "Wrong admission" });
  assert.equal(f.rows("adminAuditLog")[1].action, "undo_event_checkin");
  assert.equal((await ops.getMetrics._handler(f.ctx, { eventId: "event" })).attended, 0);
  f.as("seller"); const replay = await ops.checkInRegistration._handler(f.ctx, command);
  assert.equal(replay.checkedIn, false); assert.equal(replay.revision, 2);
  await assert.rejects(ops.checkInRegistration._handler(f.ctx, { ...command, requestId: "new-request" }), /Registration changed/);
  await assert.rejects(ops.checkInRegistration._handler(f.ctx, { ...command, registrationId: "another" }), /already used/);
  assert.equal((await ops.checkInRegistration._handler(f.ctx, { ...command, requestId: "new-valid-request", expectedRevision: 2 })).checkedIn, true);
});
test("roster search and audited export remain bounded and sanitized", async () => {
  const f = staffFixture();
  const result = await ops.getRoster._handler(f.ctx, { eventId: "event", search: "seller@example.test", paginationOpts: { cursor: null, numItems: 20 } });
  assert.equal(result.page.length, 0);
  await assert.rejects(ops.exportRoster._handler(f.ctx, { eventId: "event", paginationOpts: { cursor: null, numItems: 20 } }), /Access/);
  f.as("other"); const exported = await ops.exportRoster._handler(f.ctx, { eventId: "event", paginationOpts: { cursor: null, numItems: 20 } });
  assert.equal(exported.page.length, 1); assert.equal(exported.page[0].receiptUrl, undefined);
  assert.equal(f.rows("adminAuditLog")[0].action, "export_event_roster");
});
test("critical incidents escalate and manager refunds reuse the durable refund queue", async () => {
  const f = staffFixture();
  const id = await ops.recordIncident._handler(f.ctx, { eventId: "event", registrationId: "registration", reason: "safety", severity: "critical", notes: "Escalate to event lead" });
  assert.equal((await f.get(id)).status, "escalated");
  await assert.rejects(ops.requestRefund._handler(f.ctx, { eventId: "event", registrationId: "registration", reason: "safety" }), /Access/);
  f.add("eventPayments", { _id: "payment", status: "paid", registrationId: "registration", eventId: "event", userId: "seller" }); await f.ctx.db.patch("registration", { paymentRecordId: "payment" });
  f.as("other"); await ops.requestRefund._handler(f.ctx, { eventId: "event", registrationId: "registration", reason: "Admission canceled due to incident" });
  assert.equal((await f.get("payment")).status, "refund_pending"); assert.equal((await f.get("registration")).qrCodeData, undefined);
  await ops.requestRefund._handler(f.ctx, { eventId: "event", registrationId: "registration", reason: "Retry" });
  assert.equal(f.rows("adminAuditLog").filter(row => row.action === "request_event_incident_refund").length, 1);
});

test("roster search queries the entire indexed event before pagination and preserves event boundaries", async () => {
  const f = staffFixture();
  f.add("registrations", { _id: "foreign", userId: "seller", vehicleId: "car", eventId: "other-event", rosterSearch: "Red convertible", paymentStatus: "completed", checkedIn: false });
  for (let i = 0; i < 75; i++) f.add("registrations", { _id: `early-${i}`, eventId: "event", userId: "seller", vehicleId: "car", rosterSearch: "Blue coupe", paymentStatus: "completed", checkedIn: false });
  f.add("registrations", { _id: "last-match", eventId: "event", userId: "seller", vehicleId: "car", rosterSearch: "Red convertible", paymentStatus: "completed", checkedIn: false });
  const result = await ops.getRoster._handler(f.ctx, { eventId: "event", search: "convertible", paginationOpts: { cursor: null, numItems: 100 } });
  assert.deepEqual(result.page.map(row => row.registrationId), ["registration", "last-match"]);
  assert.deepEqual(f.searched, [{ table: "registrations", field: "rosterSearch", value: "convertible" }]);
  assert.ok(result.page.every(row => !('rosterSearch' in row) && !('email' in row) && !('qrCodeData' in row)));
});
test("replayed check-in never authorizes admission after a refund or event cancellation", async () => {
  const f = staffFixture(); await ops.checkInRegistration._handler(f.ctx, command);
  await f.ctx.db.patch("registration", { paymentStatus: "refund_pending" });
  assert.equal((await ops.checkInRegistration._handler(f.ctx, command)).checkedIn, false);
  await f.ctx.db.patch("registration", { paymentStatus: "completed" });
  await f.ctx.db.patch("event", { cancelledAt: Date.now() });
  assert.equal((await ops.checkInRegistration._handler(f.ctx, command)).checkedIn, false);
});
test("delayed check-in intent cannot execute as another assigned account", async () => {
  const f = staffFixture(); f.as("other");
  await assert.rejects(ops.checkInRegistration._handler(f.ctx, { ...command, expectedActorId: "seller" }), /Account changed/);
  assert.equal((await f.get("registration")).checkedIn, false);
  assert.equal(f.rows("eventCheckinRequests").length, 0); assert.equal(f.rows("adminAuditLog").length, 0);
  await ops.checkInRegistration._handler(f.ctx, { ...command, expectedActorId: "other" });
  assert.equal((await f.get("registration")).checkedInBy, "other");
  assert.equal('expectedActorId' in f.rows("eventCheckinRequests")[0], false);
});
test("all staff mutation APIs reject delayed intent after an account switch before writing", async () => {
  const f = staffFixture(); f.as("other");
  f.add("eventIncidents", { _id: "incident", eventId: "event", actorId: "seller", status: "open", notes: "Incident", severity: "low" });
  f.add("eventPayments", { _id: "payment", status: "paid", registrationId: "registration", eventId: "event", userId: "seller" });
  await f.ctx.db.patch("registration", { checkedIn: true, paymentRecordId: "payment" });
  const expectedActorId = "seller";
  const operations = [
    () => ops.undoCheckIn._handler(f.ctx, { ...command, reason: "Mistake", expectedActorId }),
    () => ops.requestRefund._handler(f.ctx, { eventId: "event", registrationId: "registration", reason: "Refund", expectedActorId }),
    () => ops.recordIncident._handler(f.ctx, { eventId: "event", reason: "Concern", notes: "Notes", severity: "low", expectedActorId }),
    () => ops.resolveIncident._handler(f.ctx, { incidentId: "incident", reason: "Resolved", expectedActorId }),
    () => ops.exportRoster._handler(f.ctx, { eventId: "event", paginationOpts: { cursor: null, numItems: 20 }, expectedActorId }),
  ];
  for (const operation of operations) await assert.rejects(operation(), /Account changed/);
  assert.equal((await f.get("registration")).checkedIn, true);
  assert.equal((await f.get("registration")).paymentStatus, "completed");
  assert.equal((await f.get("payment")).status, "paid");
  assert.equal((await f.get("incident")).status, "open");
  assert.equal(f.rows("eventIncidents").length, 1); assert.equal(f.rows("adminAuditLog").length, 0);
  await ops.resolveIncident._handler(f.ctx, { incidentId: "incident", reason: "Resolved", expectedActorId: "other" });
  assert.equal((await f.get("incident")).status, "resolved"); assert.equal(f.rows("adminAuditLog")[0].actorId, "other");
});
test("legacy roster search backfill snapshots only sanitized operational names in bounded batches", async () => {
  const f = staffFixture();
  await ops.backfillRosterSearch._handler(f.ctx, { eventId: "event", cursor: null });
  const text = (await f.get("registration")).rosterSearch;
  assert.match(text, /Unavailable seller/); assert.doesNotMatch(text, /example.test|secret-/);
  for (let i = 0; i < 101; i++) f.add("registrations", { _id: `row-${i}`, eventId: "event", userId: "seller", vehicleId: "car", paymentStatus: "completed", checkedIn: false });
  const result = await ops.backfillRosterSearch._handler(f.ctx, { eventId: "event", cursor: null });
  assert.equal(result.updated, 100); assert.equal(result.isDone, false); assert.equal(f.scheduled.length, 1);
});
test("attendance migration handles prior ready inventory above 1000 rows without changing capacity", async () => {
  const f = staffFixture();
  f.add("eventInventories", { _id: "inventory", eventId: "event", held: 7, confirmed: 1301, waiting: 3, initializationStatus: "ready" });
  for (let i = 0; i < 1300; i++) f.add("registrations", { _id: `legacy-attendance-${i}`, eventId: "event", userId: "seller", vehicleId: "car", checkedIn: i % 2 === 0, paymentStatus: i % 4 === 0 ? "refunded" : "completed" });
  await assert.rejects(ops.checkInRegistration._handler(f.ctx, command), /Attendance migration required/);
  await ops.startAttendanceBackfill._handler(f.ctx, { eventId: "event" });
  assert.equal((await ops.getMetrics._handler(f.ctx, { eventId: "event" })).complete, false);
  await assert.rejects(ops.checkInRegistration._handler(f.ctx, command), /migration is in progress/);
  f.as("other"); await assert.rejects(ops.undoCheckIn._handler(f.ctx, { eventId: "event", registrationId: "legacy-attendance-0", expectedRevision: 0, reason: "Wrong admission" }), /migration is in progress/);
  await ops.backfillAttendance._handler(f.ctx, { eventId: "event", cursor: null });
  const firstCount = (await f.get("inventory")).attended;
  await ops.backfillAttendance._handler(f.ctx, { eventId: "event", cursor: null });
  assert.equal((await f.get("inventory")).attended, firstCount);
  // Restart resumes the stored cursor instead of resetting the accumulator.
  await ops.startAttendanceBackfill._handler(f.ctx, { eventId: "event" });
  while ((await f.get("inventory")).attendanceInitializing) {
    const counter = await f.get("inventory");
    await ops.backfillAttendance._handler(f.ctx, { eventId: "event", cursor: counter.attendanceCursor ?? null });
  }
  const inventory = await f.get("inventory");
  assert.equal(inventory.attended, 650); assert.equal(inventory.held, 7); assert.equal(inventory.confirmed, 1301); assert.equal(inventory.waiting, 3);
  assert.equal((await ops.getMetrics._handler(f.ctx, { eventId: "event" })).complete, true);
  f.as("seller"); await ops.checkInRegistration._handler(f.ctx, command);
  assert.equal((await f.get("inventory")).attended, 651);
});
