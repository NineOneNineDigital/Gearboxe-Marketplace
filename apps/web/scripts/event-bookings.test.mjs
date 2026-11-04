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
const registrations = await import("../convex/registrations.ts");
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
async function held(f) { return bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "car" }); }
async function pay(f, hold, stripePaymentId = "pi-one", extras = {}) { return bookings.recordPayment._handler(f.ctx, { reservationId: hold._id, stripeSessionId: "cs-one", stripePaymentId, amount: 4900, currency: "usd", qrCodeData: "unguessable-credential", receiptUrl: "https://pay.stripe.com/receipt", ...extras }); }
async function refund(f, paymentRecordId, status = "succeeded", leaseToken = "lease-one") {
  const job = await bookings.claimRefund._handler(f.ctx, { paymentRecordId, leaseToken }); assert.ok(job);
  await bookings.completeRefund._handler(f.ctx, { paymentRecordId, leaseToken, stripeRefundId: `re-${paymentRecordId}`, status });
}
test("booking binds the authenticated approved owner and reserves the final capacity before payment", async () => {
  const f = fixture(); f.as("other"); await assert.rejects(held(f), /approved vehicle/); f.as(null); await assert.rejects(held(f), /Authentication/); f.as("seller");
  const hold = await held(f); assert.equal(hold.amount, 4900); assert.equal(f.rows("eventInventories")[0].held, 1); assert.equal((await held(f))._id, hold._id);
  f.as("other"); await assert.rejects(bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car" }), /full/);
  await assert.rejects(bookings.getOwnedReservation._handler(f.ctx, { reservationId: hold._id }), /not found/);
});
test("paid webhook retry produces one registration, receipt, notification and counter transition", async () => {
  const f = fixture(); const hold = await held(f); const first = await pay(f, hold); assert.deepEqual(await pay(f, hold), first);
  assert.equal(f.rows("registrations").length, 1); assert.equal(f.rows("notifications").length, 1); assert.equal(f.rows("eventPayments").length, 1);
  assert.deepEqual({ held: f.rows("eventInventories")[0].held, confirmed: f.rows("eventInventories")[0].confirmed }, { held: 0, confirmed: 1 });
  assert.equal(f.rows("registrations")[0].receiptUrl, "https://pay.stripe.com/receipt");
});
test("a second successful payment is refunded without canceling the rightful registration", async () => {
  const f = fixture(); const hold = await held(f); const first = await pay(f, hold); const duplicate = await pay(f, hold, "pi-extra", { stripeSessionId: "cs-extra" });
  assert.equal(duplicate.refundRequired, true); assert.equal(f.rows("registrations").length, 1); await refund(f, duplicate.paymentRecordId);
  assert.equal((await f.get(first.registrationId)).paymentStatus, "completed"); assert.equal(f.rows("eventInventories")[0].confirmed, 1); assert.equal((await f.get(hold._id)).status, "paid");
});
test("invalid verified metadata preserves actual charged amount and capacity until refund succeeds", async () => {
  const f = fixture(); const hold = await held(f); const payment = await pay(f, hold, "pi-invalid", { metadataValid: false });
  assert.equal(f.rows("eventPayments")[0].amount, 4900); assert.equal(payment.refundRequired, true); assert.equal(f.rows("eventInventories")[0].held, 1); assert.equal((await f.get(hold._id)).status, "refund_pending");
  await refund(f, payment.paymentRecordId); assert.equal(f.rows("eventInventories")[0].held, 0); assert.equal(f.rows("registrations").length, 0);
});
test("expired authoritative checkout releases hold and a late paid session is automatically refunded", async () => {
  const f = fixture(); const hold = await held(f); await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "Stripe session expired" });
  const payment = await pay(f, hold); assert.equal(payment.refundRequired, true); assert.equal(f.rows("registrations").length, 0); assert.equal(f.rows("eventInventories")[0].held, 0);
  await refund(f, payment.paymentRecordId); assert.equal(f.rows("eventInventories")[0].held, 0);
});
test("refunds invalidate admission immediately but retain space through pending or failed delivery", async () => {
  const f = fixture(); const hold = await held(f); const payment = await pay(f, hold);
  await bookings.requestRefund._handler(f.ctx, { registrationId: payment.registrationId }); assert.equal(f.rows("eventInventories")[0].confirmed, 1); assert.equal(f.rows("registrations")[0].qrCodeData, undefined);
  f.as("admin"); await assert.rejects(registrations.checkInRegistration._handler(f.ctx, { id: payment.registrationId, eventId: "event", requestId: "request-one", expectedRevision: 0 }), /paid registration/i);
  await refund(f, payment.paymentRecordId, "pending"); assert.equal(f.rows("eventInventories")[0].confirmed, 1);
  await f.ctx.db.patch(payment.paymentRecordId, { nextAttemptAt: 0 }); await refund(f, payment.paymentRecordId);
  assert.equal(f.rows("eventInventories")[0].confirmed, 0); assert.equal(f.rows("registrations")[0].paymentStatus, "refunded");
  await bookings.completeRefund._handler(f.ctx, { paymentRecordId: payment.paymentRecordId, stripeRefundId: "re-repeat", status: "succeeded", leaseToken: "lease-one" }); assert.equal(f.rows("eventInventories")[0].confirmed, 0);
});
test("stale refund workers cannot acknowledge or fail another worker lease", async () => {
  const f = fixture(); const hold = await held(f); const payment = await pay(f, hold, "pi-invalid", { metadataValid: false });
  await bookings.claimRefund._handler(f.ctx, { paymentRecordId: payment.paymentRecordId, leaseToken: "new" });
  assert.equal(await bookings.claimRefund._handler(f.ctx, { paymentRecordId: payment.paymentRecordId, leaseToken: "other" }), null);
  await bookings.completeRefund._handler(f.ctx, { paymentRecordId: payment.paymentRecordId, stripeRefundId: "re", status: "succeeded", leaseToken: "old" });
  assert.equal((await f.get(payment.paymentRecordId)).status, "refund_processing");
});
test("calendar refund policy includes seventh prior local day and remains correct across daylight saving", () => {
  const event = { date: Date.parse("2026-11-08T17:00:00Z"), timeZone: "America/New_York" };
  assert.equal(policy.canRefundEvent(event, Date.parse("2026-11-02T04:59:59Z")), true);
  assert.equal(policy.canRefundEvent(event, Date.parse("2026-11-02T05:00:00Z")), false);
});
test("server fee fails closed without configuration and rejects invalid amounts", () => {
  const original = process.env.EVENT_REGISTRATION_PRICE_CENTS; delete process.env.EVENT_REGISTRATION_PRICE_CENTS;
  assert.throws(() => policy.eventFee({}), /not configured/); assert.equal(policy.eventFee({ registrationFeeCents: 5000 }), 5000);
  process.env.EVENT_REGISTRATION_PRICE_CENTS = "3.25"; assert.throws(() => policy.eventFee({}), /Invalid/); process.env.EVENT_REGISTRATION_PRICE_CENTS = original;
});
test("admin cancellation immediately blocks new bookings and admission and queues bounded full refunds", async () => {
  const f = fixture(2); const hold = await held(f); const paid = await pay(f, hold); f.as("admin");
  await bookings.cancelEvent._handler(f.ctx, { eventId: "event", reason: "Venue closed" });
  await assert.rejects(registrations.checkInRegistration._handler(f.ctx, { id: paid.registrationId, eventId: "event", requestId: "request-one", expectedRevision: 0 }), /canceled/);
  f.as("other"); await assert.rejects(bookings.reserve._handler(f.ctx, { eventId: "event", vehicleId: "other-car" }), /no longer/);
  await bookings.cancelEventBatch._handler(f.ctx, { eventId: "event", phase: "registrations", cursor: null });
  assert.equal((await f.get(paid.paymentRecordId)).refundReason, "event_cancellation"); assert.equal(f.rows("registrations")[0].paymentStatus, "refund_pending"); assert.equal(f.rows("adminAuditLog").length, 1);
});
test("legacy inventory migrates in bounded pages and rejects bookings until final page", async () => {
  const f = fixture(1200); for (let i = 0; i < 1050; i++) f.add("registrations", { _id: `legacy-${i}`, eventId: "event", vehicleId: `old-${i}`, paymentStatus: "completed" });
  await assert.rejects(held(f), /operator migration/); await bookings.startInventoryBackfill._handler(f.ctx, { eventId: "event" });
  await assert.rejects(held(f), /in progress/);
  let cursor = null;
  while (true) { await bookings.backfillInventory._handler(f.ctx, { eventId: "event", cursor }); const counter = f.rows("eventInventories")[0]; if (counter.initializationStatus === "ready") break; cursor = counter.migrationCursor; }
  assert.equal(f.rows("eventInventories")[0].confirmed, 1050); await held(f); assert.equal(f.rows("eventInventories")[0].held, 1);
});
test("refunding or expiring a stray mismatched session preserves the bound rightful checkout", async () => {
  const f = fixture(); const hold = await held(f);
  await bookings.attachSession._handler(f.ctx, { reservationId: hold._id, stripeSessionId: "cs-rightful", checkoutUrl: "https://checkout.stripe.com/rightful" });
  const stray = await pay(f, hold, "pi-stray", { stripeSessionId: "cs-stray" }); assert.equal(stray.refundRequired, true);
  await bookings.releaseReservation._handler(f.ctx, { reservationId: hold._id, reason: "stray expired", stripeSessionId: "cs-stray" });
  await refund(f, stray.paymentRecordId);
  assert.equal((await f.get(hold._id)).status, "held"); assert.equal(f.rows("eventInventories")[0].held, 1);
  const rightful = await pay(f, hold, "pi-rightful", { stripeSessionId: "cs-rightful" }); assert.equal(rightful.refundRequired, false);
});
test("provider refund before local payment prevents admission and reuses the verified refund reference", async () => {
  const f = fixture(); const hold = await held(f);
  const payment = await pay(f, hold, "pi-refunded", { providerRefundState: "full", stripeRefundId: "re-existing" });
  assert.equal(payment.refundRequired, true); assert.equal(f.rows("registrations").length, 0); assert.equal((await f.get(payment.paymentRecordId)).stripeRefundId, "re-existing");
  await refund(f, payment.paymentRecordId); assert.equal(f.rows("eventInventories")[0].held, 0);
});
test("partial prior refund preserves capacity without creating admission or an automatic second full refund", async () => {
  const f = fixture(); const hold = await held(f); const payment = await pay(f, hold, "pi-partial", { providerRefundState: "partial" });
  assert.equal(f.rows("registrations").length, 0); assert.equal((await f.get(payment.paymentRecordId)).status, "refund_failed");
  assert.equal(await bookings.claimRefund._handler(f.ctx, { paymentRecordId: payment.paymentRecordId, leaseToken: "lease" }), null);
  assert.equal(f.rows("eventInventories")[0].held, 1);
});
test("refund-first webhook without payment mapping remains retryable and failed external refund leaves admission valid", async () => {
  const f = fixture(); await assert.rejects(bookings.refundObserved._handler(f.ctx, { stripePaymentId: "pi-unknown", stripeRefundId: "re", amount: 4900, currency: "usd" }), /retry refund/);
  const hold = await held(f); const payment = await pay(f, hold);
  await bookings.refundObserved._handler(f.ctx, { stripePaymentId: "pi-one", stripeRefundId: "re-failed", amount: 4900, currency: "usd", status: "failed" });
  assert.equal((await f.get(payment.registrationId)).paymentStatus, "completed"); assert.equal((await f.get(payment.registrationId)).qrCodeData, "unguessable-credential");
});
test("legacy payment linking validates identity and leaves initialized confirmed count unchanged", async () => {
  const f = fixture(); f.add("registrations", { _id: "legacy", eventId: "event", vehicleId: "car", userId: "seller", stripePaymentId: "cs-legacy", createdAt: Date.now(), paymentStatus: "completed", checkedIn: false });
  const args = { registrationId: "legacy", stripeSessionId: "cs-legacy", stripePaymentId: "pi-legacy", amount: 4900, currency: "usd", metadataUserId: "seller", metadataEventId: "event", metadataVehicleId: "car" };
  await assert.rejects(bookings.linkLegacyPayment._handler(f.ctx, { ...args, metadataUserId: "other" }), /does not match/);
  await bookings.linkLegacyPayment._handler(f.ctx, args); assert.equal(f.rows("eventInventories")[0].confirmed, 1); assert.ok((await f.get("legacy")).paymentRecordId);
  await bookings.linkLegacyPayment._handler(f.ctx, args); assert.equal(f.rows("eventPayments").length, 1);
});
test("canceled legacy migration failures retry durably with a bounded queue and audited operator recovery", async () => {
  const f = fixture(); f.add("registrations", { _id: "legacy-retry", eventId: "event", vehicleId: "car", userId: "seller", stripePaymentId: "cs-legacy", createdAt: Date.now(), paymentStatus: "refund_pending", checkedIn: false, legacyMigrationNextAttemptAt: 0 });
  for (let attempt = 1; attempt <= 8; attempt++) {
    await f.ctx.db.patch("legacy-retry", { legacyMigrationNextAttemptAt: 0 });
    const claim = await bookings.claimLegacyMigration._handler(f.ctx, { registrationId: "legacy-retry" }); assert.equal(claim.legacyMigrationAttempts, attempt);
    assert.equal(await bookings.claimLegacyMigration._handler(f.ctx, { registrationId: "legacy-retry" }), null);
    await bookings.finishLegacyMigration._handler(f.ctx, { registrationId: "legacy-retry", error: "stripe_provider_unavailable", attempt });
  }
  assert.deepEqual((await bookings.listWork._handler(f.ctx, {})).legacyMigrations, []);
  assert.equal(await bookings.claimLegacyMigration._handler(f.ctx, { registrationId: "legacy-retry" }), null);
  f.as("admin"); const ops = await bookings.paymentOperations._handler(f.ctx, {}); assert.equal(ops.legacyMigrationFailures[0].legacyMigrationError, "stripe_provider_unavailable");
  await bookings.retryLegacyMigration._handler(f.ctx, { registrationId: "legacy-retry", reason: "Provider restored" });
  assert.equal((await f.get("legacy-retry")).legacyMigrationAttempts, 0); assert.equal(f.rows("adminAuditLog")[0].action, "retry_legacy_event_payment");
});
test("stale legacy migration failures cannot overwrite a newer attempt or successful link", async () => {
  const f = fixture(); f.add("registrations", { _id: "legacy-stale", eventId: "event", vehicleId: "car", userId: "seller", stripePaymentId: "cs-old", createdAt: Date.now(), paymentStatus: "refund_pending", checkedIn: false, legacyMigrationAttempts: 2 });
  await bookings.finishLegacyMigration._handler(f.ctx, { registrationId: "legacy-stale", error: "stale", attempt: 1 }); assert.equal((await f.get("legacy-stale")).legacyMigrationError, undefined);
  await bookings.linkLegacyPayment._handler(f.ctx, { registrationId: "legacy-stale", stripeSessionId: "cs-old", stripePaymentId: "pi-old", amount: 4900, currency: "usd", metadataUserId: "seller", metadataEventId: "event", metadataVehicleId: "car" });
  await bookings.finishLegacyMigration._handler(f.ctx, { registrationId: "legacy-stale", error: "stale", attempt: 2 }); assert.equal((await f.get("legacy-stale")).legacyMigrationError, undefined);
});


test("paid conversion fails closed if capacity was reduced or the held inventory is inconsistent", async () => {
  const f = fixture(); const hold = await held(f);
  f.rows("eventInventories")[0].confirmed = 1;
  const payment = await pay(f, hold);
  assert.equal(payment.refundRequired, true);
  assert.equal(f.rows("registrations").length, 0);
  assert.equal(f.rows("eventInventories")[0].confirmed, 1);
});

test("public vehicle event context excludes cancelled or refund-pending registrations", async () => {
  const f = fixture(); const hold = await held(f); const payment = await pay(f, hold);
  assert.ok(await registrations.getRegistrationByVehicle._handler(f.ctx, { vehicleId: "car" }));
  await bookings.requestRefund._handler(f.ctx, { registrationId: payment.registrationId });
  assert.equal(await registrations.getRegistrationByVehicle._handler(f.ctx, { vehicleId: "car" }), null);
});

test("roster search indexes seller and vehicle display names without private VIN or contact fields", async () => {
  const f = fixture(); await f.ctx.db.patch("seller", { name: "Seller Name", phone: "555-private-phone" });
  await f.ctx.db.patch("car", { year: 2020, make: "Example", model: "Coupe", vin: "PRIVATE-VIN-123" });
  const payment = await pay(f, await held(f)); const registration = await f.get(payment.registrationId);
  assert.equal(registration.rosterSearch, "Seller Name 2020 Example Coupe"); assert.ok(!registration.rosterSearch.includes("PRIVATE")); assert.ok(!registration.rosterSearch.includes("phone"));
});
