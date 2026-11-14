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
const { publicVehicle } = await import("../convex/lib/vehicleVisibility.ts");
const { cleanup, cleanupVinCache } = await import("../convex/privacy.ts");
const { getVehicleContext } = await import("../convex/conversations.ts");

test("approved listings retain public VIN but remove contact data, postal code, coordinates and internal notes", () => {
  const listing = { status: "approved", vin: "PRIVATEVIN", vinKey: "PRIVATEVIN", contactInfo: "private phone", ownershipAttestedAt: 10, ownershipRole: "authorized", lienPayoffPlan: "Private lender detail",
    location: { city: "Raleigh", state: "NC", postalCode: "27601", latitude: 35.12345, longitude: -78.12345 }, moderationReason: "private", moderationHistory: [{ reason: "private" }] };
  const visible = publicVehicle(listing);
  assert.equal(visible.status, "active");
  assert.equal(visible.vin, "PRIVATEVIN"); assert.equal(visible.vinKey, undefined); assert.equal(visible.contactInfo, "");
  assert.equal(visible.ownershipAttestedAt, undefined); assert.equal(visible.ownershipRole, undefined); assert.equal(visible.lienPayoffPlan, undefined); assert.equal(visible.moderationReason, undefined); assert.deepEqual(visible.moderationHistory, []);
  assert.deepEqual(visible.location, { city: "Raleigh", state: "NC" });
  assert.equal(listing.vin, "PRIVATEVIN");
});

test("sensitive listing cleanup purges stale closed records but preserves available and recent listings", async () => {
  const old = Date.now() - 91 * 86_400_000;
  const records = [
    { _id: "closed", status: "sold", updatedAt: old, vin: "VIN", vinKey: "VIN", contactInfo: "Phone", lienPayoffPlan: "Private payoff details" },
    { _id: "legacy-draft", status: "draft", createdAt: old, vin: "VIN", contactInfo: "Phone" },
    { _id: "active", status: "active", updatedAt: old, vin: "VIN", contactInfo: "Phone" },
    { _id: "recent", status: "withdrawn", updatedAt: Date.now(), vin: "VIN", contactInfo: "Phone" },
  ];
  const scheduled = [];
  const ctx = { db: { query: () => ({ paginate: async options => { assert.equal(options.numItems, 50); return { page: records, isDone: false, continueCursor: "next" }; } }),
    patch: async (id, patch) => Object.assign(records.find(row => row._id === id), patch) }, scheduler: { runAfter: async (...args) => scheduled.push(args) } };
  await cleanup._handler(ctx, { cursor: null });
  for (const row of records.slice(0, 2)) { assert.equal(row.vin, undefined); assert.equal(row.vinKey, undefined); assert.equal(row.contactInfo, ""); assert.equal(row.lienPayoffPlan, undefined); }
  for (const row of records.slice(2)) assert.equal(row.vin, "VIN");
  assert.equal(scheduled.length, 1); assert.deepEqual(scheduled[0][2], { cursor: "next" });
});

test("VIN cache deletion uses expiry index and bounded batches", async () => {
  const removed = [];
  const ctx = { db: { query: table => { assert.equal(table, "vinDecodes"); return { withIndex: (index, filter) => {
    assert.equal(index, "by_decoded"); filter({ lt: (field, cutoff) => { assert.equal(field, "decodedAt"); assert.ok(cutoff < Date.now() - 29 * 86_400_000); } });
    return { take: async cap => { assert.equal(cap, 100); return [{ _id: "expired" }]; } };
  } }; }, delete: async id => removed.push(id) } };
  await cleanupVinCache._handler(ctx, {}); assert.deepEqual(removed, ["expired"]);
});

test("former buyer cannot read later private listing edits through an existing thread", async () => {
  const user = { _id: "buyer", externalId: "clerk-buyer" };
  const vehicle = { _id: "vehicle", userId: "seller", status: "draft", title: "Private revision", year: 2026, make: "Private", model: "Edit", mileage: 1, mileageUnit: "mi", price: 1 };
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: user.externalId }) },
    db: {
      query: table => ({ withIndex: () => table === "users"
        ? { unique: async () => user }
        : { first: async () => ({ participant1Id: "buyer", participant2Id: "seller" }) } }),
      get: async () => vehicle,
    },
  };
  const result = await getVehicleContext._handler(ctx, { vehicleId: "vehicle", otherUserId: "seller" });
  assert.deepEqual(result, { _id: "vehicle", status: "draft", title: "Listing no longer public" });
});
