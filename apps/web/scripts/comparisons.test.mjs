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

const comparisons = await import("../convex/comparisons.ts");
const accountDeletion = await import("../convex/accountDeletion.ts");

function fixture() {
  let actor = "buyer";
  let nextId = 0;
  const tables = {
    users: [
      { _id: "buyer", externalId: "clerk-buyer", emailVerified: true },
      { _id: "other", externalId: "clerk-other", emailVerified: true },
      { _id: "seller", externalId: "clerk-seller", emailVerified: true },
      { _id: "unverified", externalId: "clerk-unverified", emailVerified: false },
    ],
    vehicles: Array.from({ length: 5 }, (_, i) => ({
      _id: `vehicle-${i + 1}`, userId: "seller", status: "active",
      title: `Car ${i + 1}`, year: 2020, make: "Make", model: "Model",
      price: 10000 + i, mileage: 10000, mileageUnit: "mi", photos: [], media: [],
      vin: `VIN${i}`, contactInfo: "private@example.com", location: { city: "Raleigh", state: "NC", postalCode: "27601" },
      serviceRecords: "partial", damageDisclosure: "", accidentDisclosure: "", mechanicalIssues: "",
    })),
    comparisons: [], favorites: [], trustRateLimits: [],
  };
  const row = id => Object.values(tables).flat().find(item => item._id === id);
  const query = table => {
    const predicates = [];
    let descending = false;
    const builder = { eq(field, value) { predicates.push(item => item[field] === value); return builder; } };
    const rows = () => {
      const found = tables[table].filter(item => predicates.every(fn => fn(item)));
      return descending ? [...found].reverse() : found;
    };
    const q = {
      withIndex(_name, filter) { filter(builder); return q; },
      order(direction) { descending = direction === "desc"; return q; },
      unique: async () => { assert.ok(rows().length <= 1); return rows()[0] ?? null; },
      take: async count => rows().slice(0, count),
      paginate: async ({ numItems, cursor }) => { const start = Number(cursor ?? 0); return { page: rows().slice(start, start + numItems), isDone: start + numItems >= rows().length, continueCursor: String(start + numItems) }; },
    };
    return q;
  };
  const ctx = {
    auth: { getUserIdentity: async () => actor ? { subject: `clerk-${actor}` } : null },
    db: {
      query, get: async id => row(id) ?? null,
      insert: async (table, fields) => { const id = `new-${++nextId}`; tables[table].push({ _id: id, ...fields }); return id; },
      patch: async (id, fields) => Object.assign(row(id), fields),
      delete: async id => { for (const rows of Object.values(tables)) { const i = rows.findIndex(item => item._id === id); if (i >= 0) rows.splice(i, 1); } },
    },
    storage: { getUrl: async () => null },
    scheduler: { runAfter: async () => {} },
  };
  return { ctx, tables, as: value => { actor = value; } };
}

test("comparison membership is fixed, while public facts and availability remain current", async () => {
  const f = fixture();
  const { id, token } = await comparisons.create._handler(f.ctx, { vehicleIds: ["vehicle-1", "vehicle-2"] });
  assert.match(token, /^[0-9a-f]{32}$/);
  assert.deepEqual((await comparisons.listMine._handler(f.ctx, {}))[0].vehicleIds, ["vehicle-1", "vehicle-2"]);
  f.tables.vehicles[0].price = 12000;
  f.tables.vehicles[1].status = "withdrawn";
  f.as(null);
  const publicView = await comparisons.getPublic._handler(f.ctx, { token });
  assert.equal(publicView.cars.length, 1);
  assert.equal(publicView.cars[0].price, 12000);
  assert.equal(publicView.unavailableCount, 1);
  assert.deepEqual(publicView.cars[0].location, { city: "Raleigh", state: "NC" });
  for (const forbidden of ["userId", "vin", "contactInfo", "postalCode", "favorites", "savedSearches"]) {
    assert.equal(JSON.stringify(publicView).includes(forbidden), false);
  }
  f.as("buyer");
  await comparisons.revoke._handler(f.ctx, { id });
  f.as(null);
  assert.equal(await comparisons.getPublic._handler(f.ctx, { token }), null);
});

test("two to four cars stay fixed when the owner's favorites change", async () => {
  const f = fixture();
  f.tables.favorites.push(
    { userId: "buyer", vehicleId: "vehicle-1" },
    { userId: "buyer", vehicleId: "vehicle-2" },
    { userId: "buyer", vehicleId: "vehicle-3" },
    { userId: "buyer", vehicleId: "vehicle-4" },
  );
  const links = [];
  for (const count of [2, 3, 4]) {
    const vehicleIds = f.tables.favorites.slice(0, count).map(row => row.vehicleId);
    links.push({ vehicleIds, ...await comparisons.create._handler(f.ctx, { vehicleIds }) });
  }

  f.tables.favorites.splice(0, f.tables.favorites.length, { userId: "buyer", vehicleId: "vehicle-5" });
  f.as(null);
  for (const { token, vehicleIds } of links) {
    const view = await comparisons.getPublic._handler(f.ctx, { token });
    assert.deepEqual(view.cars.map(car => car.id), vehicleIds);
    assert.equal(view.unavailableCount, 0);
    assert.equal(JSON.stringify(view).includes("vehicle-5"), false);
  }
});

test("creation validates membership, current public visibility, auth and rate limit", async () => {
  const f = fixture();
  for (const vehicleIds of [["vehicle-1"], ["vehicle-1", "vehicle-2", "vehicle-3", "vehicle-4", "vehicle-5"], ["vehicle-1", "vehicle-1"]]) {
    await assert.rejects(comparisons.create._handler(f.ctx, { vehicleIds }), /two to four different/);
  }
  await assert.rejects(comparisons.create._handler(f.ctx, { vehicleIds: ["vehicle-1", "tampered"] }), /no longer available/);
  f.tables.vehicles[1].moderationRemovedAt = Date.now();
  await assert.rejects(comparisons.create._handler(f.ctx, { vehicleIds: ["vehicle-1", "vehicle-2"] }), /no longer available/);
  f.tables.vehicles[1].moderationRemovedAt = undefined;
  f.as(null);
  await assert.rejects(comparisons.create._handler(f.ctx, { vehicleIds: ["vehicle-1", "vehicle-2"] }), /Authentication required/);
  await assert.rejects(comparisons.listMine._handler(f.ctx, {}), /Authentication required/);
  f.as("unverified");
  await assert.rejects(comparisons.create._handler(f.ctx, { vehicleIds: ["vehicle-1", "vehicle-2"] }), /Verify your email/);
  f.as("buyer");
  const { id, token } = await comparisons.create._handler(f.ctx, { vehicleIds: ["vehicle-1", "vehicle-2"] });
  f.as("other");
  await assert.rejects(comparisons.revoke._handler(f.ctx, { id }), /not found/);
  assert.deepEqual(await comparisons.listMine._handler(f.ctx, {}), []);
  f.as("buyer");
  f.tables.trustRateLimits[0].count = 20;
  await assert.rejects(comparisons.create._handler(f.ctx, { vehicleIds: ["vehicle-1", "vehicle-2"] }), /Too many comparisons/);
  f.tables.users[0].deletedAt = Date.now();
  f.as(null);
  assert.equal(await comparisons.getPublic._handler(f.ctx, { token }), null);
  assert.equal(await comparisons.getPublic._handler(f.ctx, { token: "garbage" }), null);
});

test("account deletion removes comparison links during bounded cleanup", async () => {
  const f = fixture();
  const { token } = await comparisons.create._handler(f.ctx, { vehicleIds: ["vehicle-1", "vehicle-2"] });
  f.tables.users[0].deletedAt = Date.now();
  assert.equal(await comparisons.getPublic._handler(f.ctx, { token }), null);
  await accountDeletion.cleanup._handler(f.ctx, { userId: "buyer", phase: "comparisons", cursor: null });
  assert.equal(f.tables.comparisons.length, 0);
});

test("public comparison hides every nonpublic or missing member without leaking private fields", async () => {
  const f = fixture();
  const { token } = await comparisons.create._handler(f.ctx, { vehicleIds: ["vehicle-1", "vehicle-2", "vehicle-3", "vehicle-4"] });
  f.tables.vehicles[0].price = 14500;
  f.tables.vehicles[0].status = "reserved";
  f.tables.vehicles[1].status = "sold";
  f.tables.vehicles[2].moderationRemovedAt = Date.now();
  f.tables.vehicles.splice(f.tables.vehicles.findIndex(vehicle => vehicle._id === "vehicle-4"), 1);
  f.tables.favorites.push({ userId: "buyer", vehicleId: "vehicle-5" });

  f.as(null);
  const view = await comparisons.getPublic._handler(f.ctx, { token });
  assert.equal(view.unavailableCount, 3);
  assert.deepEqual(view.cars.map(car => car.id), ["vehicle-1"]);
  assert.equal(view.cars[0].price, 14500);
  assert.equal(view.cars[0].status, "reserved");
  assert.equal(view.cars[0].titleStatus, f.tables.vehicles[0].titleStatus);
  assert.deepEqual(view.cars[0].location, { city: "Raleigh", state: "NC" });
  assert.equal(view.cars[0].serviceRecords, "partial");
  for (const privateValue of ["VIN0", "private@example.com", "27601", "vehicle-5", "clerk-buyer"]) {
    assert.equal(JSON.stringify(view).includes(privateValue), false);
  }

  f.tables.vehicles[0].status = "withdrawn";
  assert.deepEqual(await comparisons.getPublic._handler(f.ctx, { token }), { cars: [], unavailableCount: 4 });
});
