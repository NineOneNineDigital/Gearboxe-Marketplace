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
const { eventForViewer } = await import("../convex/lib/eventVisibility.ts");
const events = await import("../convex/events.ts");
const registrations = await import("../convex/registrations.ts");
const event = { _id: "event", name: "Popup", date: Date.now() + 86400_000, capacity: 5, onSiteContact: { name: "Event desk", phone: "+1 919 555 0100" }, cancellationReason: "Private operational note" };
function fixture() {
  let actor = null;
  const tables = { events: [structuredClone(event)], users: [{ _id: "admin", externalId: "admin", role: "admin" }, { _id: "staff", externalId: "staff", role: "user" }, { _id: "vendor", externalId: "vendor", role: "user" }, { _id: "other", externalId: "other", role: "user" }], eventStaff: [{ eventId: "event", userId: "staff", role: "checkin" }], registrations: [{ _id: "registration", eventId: "event", userId: "vendor", vehicleId: "car", paymentStatus: "completed" }] };
  function query(table) {
    const filters = [];
    const builder = { eq(field, value) { filters.push(row => row[field] === value); return builder; } };
    const q = { withIndex(_name, callback) { if (callback) callback(builder); return q; }, order() { return q; }, collect: async () => tables[table].filter(row => filters.every(filter => filter(row))), first: async () => (await q.collect())[0] ?? null, unique: async () => { const rows = await q.collect(); assert.ok(rows.length <= 1); return rows[0] ?? null; } };
    return q;
  }
  return { tables, as: value => { actor = value; }, ctx: { auth: { getUserIdentity: async () => actor ? { subject: actor } : null }, db: { query, get: async id => Object.values(tables).flat().find(row => row._id === id) ?? null } } };
}
test("on-site contacts default private on every public event entrypoint", async () => {
  const f = fixture();
  for (const actor of [null, "other"]) {
    f.as(actor);
    for (const view of [await events.getEventById._handler(f.ctx, { id: "event" }), ...(await events.getUpcomingEvents._handler({ ...f.ctx, db: { ...f.ctx.db, query: table => {
      if (table !== "events") return f.ctx.db.query(table);
      return { withIndex: () => ({ collect: async () => f.tables.events }) };
    } } }, {})), (await registrations.getRegistrationByVehicle._handler(f.ctx, { vehicleId: "car" })).event]) {
      assert.equal(view.onSiteContact, undefined); assert.equal(view.cancellationReason, undefined);
    }
  }
});
test("contacts are visible only to authorized staff, paid vendors, admins, or an explicit public setting", async () => {
  const f = fixture();
  for (const actor of ["admin", "staff", "vendor"]) { f.as(actor); assert.deepEqual((await eventForViewer(f.ctx, f.tables.events[0])).onSiteContact, event.onSiteContact); }
  f.tables.registrations[0].paymentStatus = "refunded"; f.as("vendor"); assert.equal((await eventForViewer(f.ctx, f.tables.events[0])).onSiteContact, undefined);
  f.tables.events[0].onSiteContactVisibility = "public"; f.as(null);
  assert.deepEqual((await eventForViewer(f.ctx, f.tables.events[0])).onSiteContact, event.onSiteContact);
  assert.equal((await eventForViewer(f.ctx, f.tables.events[0])).cancellationReason, undefined);
});
