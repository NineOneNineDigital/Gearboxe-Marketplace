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
const { readDiscoveryUrl, discoveryUrl } = await import("../lib/discovery-url.ts");
const { validateFilters, matches, distanceMiles, geoScope, geoScopes } = await import("../convex/lib/discoveryPolicy.ts");
const { syncDiscovery } = await import("../convex/lib/discoveryIndex.ts");
const discovery = await import("../convex/discovery.ts");
const savedSearches = await import("../convex/savedSearches.ts");
const recentViews = await import("../convex/recentViews.ts");
const vehicles = await import("../convex/vehicles.ts");

test("discovery URL round-trips validated filters and all supported sort orders", () => {
  const filters = { search: "Toyota & Lexus", make: "Toyota", model: "Camry", minPrice: 10000, maxPrice: 30000,
    minYear: 2018, maxYear: 2024, maxMileage: 60000, state: "NC", latitude: 35.7796, longitude: -78.6382, radiusMiles: 75 };
  for (const sort of ["newest", "price-low", "price-high", "mileage-low", "mileage-high", "year-new", "year-old"]) {
    const url = discoveryUrl(filters, sort);
    assert.deepEqual(readDiscoveryUrl(new URL(url, "https://marketplace.example").searchParams), { filters, sort });
  }
  assert.equal(discoveryUrl({}), "/vehicles");
});

test("malformed shared URLs cannot inject invalid bounds, sorts, or partial distance coordinates", () => {
  const parsed = readDiscoveryUrl(new URLSearchParams("minPrice=-1&maxPrice=Infinity&minYear=1900.5&maxMileage=NaN&state=NCx&latitude=35&sort=unknown"));
  assert.deepEqual(parsed, { filters: {}, sort: "newest" });
  assert.deepEqual(readDiscoveryUrl(new URLSearchParams("minPrice=300&maxPrice=100&minYear=2020&maxYear=2010&state=nc")),
    { filters: { minPrice: 300, minYear: 2020, state: "NC" }, sort: "newest" });
  assert.deepEqual(readDiscoveryUrl(new URLSearchParams("latitude=35&longitude=-78&radiusMiles=900")),
    { filters: { latitude: 35, longitude: -78, radiusMiles: 50 }, sort: "newest" });
});

const clone = value => structuredClone(value);
const listing = (id, fields = {}) => ({
  _id: id, _creationTime: 1, userId: "seller", status: "active", title: "2020 Toyota Camry", make: "Toyota", model: "Camry",
  year: 2020, price: 20000, mileage: 20000, mileageUnit: "mi", createdAt: 1, photos: [], media: [], description: "Well maintained",
  contactInfo: "Private seller contact", moderationReason: "Private review", moderationHistory: [{ reason: "Private note" }],
  location: { city: "Raleigh", state: "NC", latitude: 35.7796, longitude: -78.6382 },
  ...fields,
});

function fixture(inventory = []) {
  let actor = "buyer", sequence = 0;
  const tables = { vehicles: clone(inventory), users: ["buyer", "other", "seller"].map(id => ({ _id: id, externalId: `clerk-${id}`, role: "user" })) };
  const reads = [];
  const get = async id => clone(Object.values(tables).flat().find(row => row._id === id) ?? null);
  const query = table => {
    const predicates = [], constraints = [];
    let direction = "asc", index = "", search;
    const builder = {};
    for (const [name, compare] of Object.entries({ eq: (a, b) => a === b, gt: (a, b) => a > b, gte: (a, b) => a >= b, lt: (a, b) => a < b, lte: (a, b) => a <= b })) {
      builder[name] = (field, value) => { predicates.push(row => compare(row[field], value)); constraints.push({ operation: name, field, value }); return builder; };
    }
    builder.search = (field, value) => { search = { field, value }; predicates.push(row => String(row[field] ?? "").toLowerCase().includes(value.toLowerCase())); return builder; };
    const rows = () => {
      const result = (tables[table] ?? []).filter(row => predicates.every(predicate => predicate(row)));
      const fields = table === "vehicleSearchTerms" ? { by_price: ["token", "scope", "price"], by_mileage: ["token", "scope", "mileageMiles"], by_year: ["token", "scope", "year"], by_recency: ["token", "scope", "listedAt"] }[index] ?? []
        : table === "recentViews" && index === "by_user_time" ? ["userId", "viewedAt"]
        : index.replace(/^by_/, "").split("_").filter(field => result.some(row => row[field] !== undefined));
      result.sort((a, b) => {
        for (const field of [...fields, "_creationTime", "_id"]) {
          if (a[field] < b[field]) return direction === "desc" ? 1 : -1;
          if (a[field] > b[field]) return direction === "desc" ? -1 : 1;
        }
        return 0;
      });
      return clone(result);
    };
    const q = {
      withIndex(name, callback) { index = name; callback?.(builder); reads.push({ table, operation: "index", index, constraints: clone(constraints) }); return q; },
      withSearchIndex(name, callback) { index = name; callback(builder); reads.push({ table, operation: "search", index, search }); return q; },
      order(value) { direction = value; return q; },
      collect: async () => { assert.notEqual(table, "vehicles", "Discovery must not collect all inventory"); return rows(); },
      unique: async () => { const result = rows(); assert.ok(result.length <= 1); return result[0] ?? null; },
      first: async () => rows()[0] ?? null,
      take: async count => { assert.ok(Number.isInteger(count) && count > 0 && count <= 4096); reads.push({ table, operation: "take", count, index }); return rows().slice(0, count); },
      paginate: async options => {
        assert.ok(Number.isInteger(options.numItems) && options.numItems > 0 && options.numItems <= 1000);
        reads.push({ table, operation: "paginate", options, index });
        const start = Number(options.cursor ?? 0), result = rows();
        return { page: result.slice(start, start + options.numItems), isDone: start + options.numItems > result.length, continueCursor: String(start + options.numItems) };
      },
    };
    return q;
  };
  const ctx = {
    scheduler: { runAfter: async () => {} },
    auth: { getUserIdentity: async () => actor ? { subject: `clerk-${actor}` } : null },
    db: { query, get, normalizeId: (table, value) => value.startsWith("invalid") || value.includes(" ") ? null : tables[table]?.some(row => row._id === value) ? value : null,
      insert: async (table, row) => { const id = `record-${++sequence}`; (tables[table] ??= []).push({ _id: id, _creationTime: Date.now(), ...clone(row) }); return id; },
      patch: async (id, fields) => { const row = Object.values(tables).flat().find(row => row._id === id); assert.ok(row); Object.assign(row, clone(fields)); },
      delete: async id => { for (const rows of Object.values(tables)) { const index = rows.findIndex(row => row._id === id); if (index >= 0) rows.splice(index, 1); } },
    },
    storage: { getUrl: async id => `https://test.convex.cloud/api/storage/${id}` },
  };
  return { ctx, reads, as: id => { actor = id; }, rows: table => tables[table] ?? [], add: (table, row) => { (tables[table] ??= []).push(clone(row)); } };
}

test("server rejects unbounded and inconsistent discovery filters", () => {
  for (const filters of [{ minPrice: -1 }, { maxPrice: Infinity }, { minPrice: 30, maxPrice: 20 }, { minYear: 2024, maxYear: 2023 },
    { minYear: 2020.5 }, { maxMileage: 2000001 }, { latitude: 91, longitude: 0, radiusMiles: 50 }, { latitude: 0 },
    { state: "North Carolina" }, { search: "x".repeat(121) }, { radiusMiles: 501, latitude: 0, longitude: 0 },
    { zip: "27601" }, { zip: "wrong", latitude: 35, longitude: -78, radiusMiles: 50 },
    { bodyStyle: "airplane" }, { fuelType: "solar" }, { transmission: "unknown" }, { titleStatus: "invalid" }]) assert.throws(() => validateFilters(filters));
  assert.equal(validateFilters({ state: " nc ", search: " Camry " }).state, "NC");
  assert.equal(validateFilters({ zip: "27601", latitude: 35, longitude: -78, radiusMiles: 50 }).zip, "27601");
});

test("distance uses great-circle miles, crosses antimeridian, and excludes unknown coordinates", () => {
  assert.equal(distanceMiles(35, -78, 35, -78), 0);
  const acrossDateline = distanceMiles(0, 179.9, 0, -179.9);
  assert.ok(acrossDateline > 13 && acrossDateline < 15);
  const row = { searchWords: ["toyota", "camry"], modelKey: "camry", price: 20000, year: 2020, mileageMiles: 20000, latitude: 0, longitude: -179.9 };
  assert.equal(matches(row, validateFilters({ latitude: 0, longitude: 179.9, radiusMiles: 15 })), true);
  assert.equal(matches(row, validateFilters({ latitude: 0, longitude: 179.9, radiusMiles: 10 })), false);
  assert.equal(matches({ ...row, latitude: undefined }, validateFilters({ latitude: 0, longitude: 179.9, radiusMiles: 15 })), false);
  assert.equal(matches(row, { search: "TOYOTA Camry", maxMileage: 20000 }), true);
  assert.equal(matches(row, { search: "Toyota Corolla" }), false);
});

test("catalog synchronizes normalized mileage and public search terms, removes withdrawn postings", async () => {
  const f = fixture([listing("vehicle", { mileage: 16093.44, mileageUnit: "km", vin: "SECRET-VIN", contactInfo: "Private phone", trim: "LE" })]);
  await syncDiscovery(f.ctx, "vehicle");
  const catalog = f.rows("vehicleCatalog")[0];
  assert.equal(catalog.mileageMiles, 10000);
  assert.equal(catalog.makeKey, "toyota");
  assert.ok(catalog.searchWords.includes("camry"));
  assert.ok(!JSON.stringify(f.rows("vehicleSearchTerms")).includes("SECRET-VIN"));
  assert.ok(!JSON.stringify(f.rows("vehicleSearchTerms")).includes("Private phone"));
  assert.ok(f.rows("vehicleSearchTerms").some(row => row.token === "camry" && row.scope === "m:toyota|s:NC"));
  f.rows("vehicles")[0].status = "withdrawn";
  await syncDiscovery(f.ctx, "vehicle");
  assert.equal(f.rows("vehicleCatalog").length, 0);
  assert.equal(f.rows("vehicleSearchTerms").length, 0);
});

async function indexedFixture(inventory) {
  const f = fixture(inventory);
  for (const vehicle of inventory) await syncDiscovery(f.ctx, vehicle._id);
  f.reads.length = 0;
  return f;
}
const browse = (f, filters = {}, sort = "newest", numItems = 48, cursor = null) => discovery.browse._handler(f.ctx, { filters, sort, paginationOpts: { numItems, cursor } });

test("browse uses bounded indexed pages, advances sparse cursors, and never collects inventory", async () => {
  const inventory = Array.from({ length: 120 }, (_, i) => listing(`vehicle-${String(i).padStart(3, "0")}`, { createdAt: i, price: i === 0 ? 10 : 20000 }));
  const f = await indexedFixture(inventory);
  const first = await browse(f, { maxPrice: 20 }, "newest", 100000);
  assert.equal(first.page.length, 0); assert.equal(first.isDone, false);
  assert.equal(first.continueCursor, "48");
  const second = await browse(f, { maxPrice: 20 }, "newest", 100000, first.continueCursor);
  assert.equal(second.page.length, 0); assert.equal(second.continueCursor, "96");
  const third = await browse(f, { maxPrice: 20 }, "newest", 100000, second.continueCursor);
  assert.deepEqual(third.page.map(row => row._id), ["vehicle-000"]); assert.equal(third.isDone, true);
  for (const read of f.reads.filter(read => read.operation === "paginate")) {
    assert.equal(read.index, "by_recency"); assert.equal(read.options.numItems, 48);
    assert.equal(read.options.maximumRowsRead, 256); assert.equal(read.options.maximumBytesRead, 2000000);
  }
});

test("each inventory sort orders globally through its compound index, including mixed mileage units", async () => {
  const f = await indexedFixture([
    listing("a", { price: 30, mileage: 20000, year: 2020, createdAt: 3 }),
    listing("b", { price: 10, mileage: 16093.44, mileageUnit: "km", year: 2022, createdAt: 1 }),
    listing("c", { price: 20, mileage: 15000, year: 2018, createdAt: 2 }),
  ]);
  const expected = { newest: ["a", "c", "b"], "price-low": ["b", "c", "a"], "price-high": ["a", "c", "b"],
    "mileage-low": ["b", "c", "a"], "mileage-high": ["a", "c", "b"], "year-new": ["b", "a", "c"], "year-old": ["c", "a", "b"] };
  for (const [sort, ids] of Object.entries(expected)) assert.deepEqual((await browse(f, {}, sort)).page.map(row => row._id), ids);
  assert.deepEqual((await browse(f, { maxMileage: 12000 }, "mileage-low")).page.map(row => row._id), ["b"]);
  assert.deepEqual((await browse(f, { minPrice: 15, maxPrice: 25 }, "price-low")).page.map(row => row._id), ["c"]);
});

test("search combines indexed make/state scope with all identity words and remaining filters", async () => {
  const f = await indexedFixture([
    listing("match", { title: "2020 Toyota Camry LE", trim: "LE" }),
    listing("other-trim", { title: "2020 Toyota Camry SE", trim: "SE" }),
    listing("other-state", { title: "2020 Toyota Camry LE", trim: "LE", location: { city: "Austin", state: "TX" } }),
    listing("other-make", { title: "2020 Lexus Camry LE", make: "Lexus", trim: "LE" }),
  ]);
  const result = await browse(f, { search: "Toyota CAMRY LE", make: "toyota", model: "Camry", state: "nc", minYear: 2019, maxYear: 2021, minPrice: 10000, maxPrice: 30000 });
  assert.deepEqual(result.page.map(row => row._id), ["match"]);
  assert.ok(f.reads.some(read => read.index === "by_recency"));
  const publicRow = result.page[0];
  assert.equal(publicRow.contactInfo, ""); assert.equal(publicRow.moderationReason, undefined); assert.deepEqual(publicRow.moderationHistory, []);
});

test("vehicle facets match decoded and seller-entered specifications", async () => {
  const f = await indexedFixture([
    listing("match", { bodyStyle: "Sport Utility Vehicle (SUV)", fuelType: "Plug-in Hybrid Electric", transmission: "CVT", titleStatus: "clean", createdAt: 3 }),
    listing("gas", { bodyStyle: "SUV", fuelType: "Gasoline", transmission: "6-Speed Manual", titleStatus: "clean", createdAt: 2 }),
    listing("rebuilt", { bodyStyle: "SUV", fuelType: "Plug-in Hybrid", transmission: "Automatic", titleStatus: "rebuilt", createdAt: 1 }),
    listing("hybrid", { bodyStyle: "Sedan", fuelType: "Gasoline/Electric", transmission: "Automatic", titleStatus: "clean", createdAt: 0 }),
  ]);
  const filters = { bodyStyle: "suv", fuelType: "plug-in-hybrid", transmission: "automatic", titleStatus: "clean" };
  assert.deepEqual((await browse(f, filters)).page.map(row => row._id), ["match"]);
  assert.deepEqual((await browse(f, { ...filters, transmission: "manual" })).page, []);
  assert.deepEqual((await browse(f, { fuelType: "gasoline", transmission: "manual" })).page.map(row => row._id), ["gas"]);
  assert.deepEqual((await browse(f, { fuelType: "hybrid", bodyStyle: "sedan" })).page.map(row => row._id), ["hybrid"]);
});

test("browse and metadata recheck visibility even when a stale index contains private inventory", async () => {
  const f = await indexedFixture([listing("active"), listing("legacy", { status: "approved" }), listing("hidden")]);
  f.rows("vehicles").find(row => row._id === "hidden").status = "draft";
  assert.deepEqual((await browse(f)).page.map(row => row._id).sort(), ["active", "legacy"]);
  assert.equal(await discovery.metadataVehicle._handler(f.ctx, { id: "hidden" }), null);
  const metadata = await discovery.metadataVehicle._handler(f.ctx, { id: "active" });
  assert.equal(metadata.contactInfo, undefined); assert.equal(metadata.moderationReason, undefined); assert.equal(metadata.vin, undefined);
});

test("indexed distance pages apply exact radius and omit listings without coordinates", async () => {
  const f = await indexedFixture([
    listing("near"), listing("far", { location: { city: "Charlotte", state: "NC", latitude: 35.2271, longitude: -80.8431 } }),
    listing("unknown", { location: { city: "Raleigh", state: "NC" } }),
  ]);
  assert.deepEqual((await browse(f, { latitude: 35.7796, longitude: -78.6382, radiusMiles: 20 })).page.map(row => row._id), ["near"]);
});

test("saved searches validate bounds, cap storage, and enforce owner-only reads and deletion", async () => {
  const f = fixture();
  const id = await savedSearches.save._handler(f.ctx, { name: " Raleigh Camrys ", filters: { make: "Toyota", state: "nc", maxPrice: 30000, bodyStyle: "sedan", titleStatus: "clean" }, sort: "price-low" });
  assert.equal(f.rows("savedSearches")[0].userId, "buyer"); assert.equal(f.rows("savedSearches")[0].name, "Raleigh Camrys");
  assert.equal(f.rows("savedSearches")[0].filters.bodyStyle, "sedan");
  assert.equal((await savedSearches.list._handler(f.ctx, {})).length, 1);
  await assert.rejects(savedSearches.save._handler(f.ctx, { name: "Invalid", filters: { maxPrice: -1 }, sort: "newest" }), /Invalid/);
  f.as("other"); assert.deepEqual(await savedSearches.list._handler(f.ctx, {}), []);
  await assert.rejects(savedSearches.remove._handler(f.ctx, { id }), /not found/);
  f.as(null); await assert.rejects(savedSearches.list._handler(f.ctx, {}), /Authentication/);
  f.as("buyer");
  for (let i = 0; i < 24; i++) f.add("savedSearches", { _id: `search-${i}`, userId: "buyer", name: "Old search" });
  await assert.rejects(savedSearches.save._handler(f.ctx, { name: "Too many", filters: {}, sort: "newest" }), /maximum 25/);
  await savedSearches.remove._handler(f.ctx, { id }); assert.equal(f.rows("savedSearches").length, 24);
});

test("recent views deduplicate and retain only public listings for the current buyer", async () => {
  const f = fixture([listing("one"), listing("two", { status: "approved" }), listing("private", { status: "draft" })]);
  await recentViews.record._handler(f.ctx, { id: "one" }); await recentViews.record._handler(f.ctx, { id: "one" });
  await recentViews.record._handler(f.ctx, { id: "two" }); await recentViews.record._handler(f.ctx, { id: "private" });
  assert.equal(f.rows("recentViews").length, 2);
  f.rows("vehicles").find(row => row._id === "one").status = "sold";
  const results = await recentViews.list._handler(f.ctx, {});
  assert.deepEqual(results.map(row => row._id), ["two"]); assert.equal(results[0].contactInfo, "");
  f.as("other"); assert.deepEqual(await recentViews.list._handler(f.ctx, {}), []);
  f.as(null); await recentViews.record._handler(f.ctx, { id: "two" });
  assert.equal(f.rows("recentViews").length, 2); await assert.rejects(recentViews.list._handler(f.ctx, {}), /Authentication/);
});

test("recent history and sitemap read bounded pages and recheck stale catalog visibility", async () => {
  const f = await indexedFixture([listing("active"), listing("hidden")]);
  f.rows("vehicles").find(row => row._id === "hidden").status = "rejected";
  const sitemap = await discovery.sitemapPage._handler(f.ctx, { shard: 0, paginationOpts: { cursor: null, numItems: 10000 } });
  assert.deepEqual(sitemap.page.map(row => row._id), ["active"]);
  assert.equal(f.reads.find(read => read.operation === "paginate").options.numItems, 500);
  assert.equal(f.reads.find(read => read.operation === "paginate").options.maximumRowsRead, 501);
  assert.deepEqual(await discovery.sitemapManifest._handler(f.ctx, {}), { pages: 1 });
  await assert.rejects(discovery.sitemapPage._handler(f.ctx, { shard: -1, paginationOpts: { cursor: null, numItems: 10 } }), /Invalid/);
  for (let i = 0; i < 50; i++) f.add("recentViews", { _id: `recent-${i}`, userId: "buyer", vehicleId: `old-${i}`, viewedAt: i });
  await recentViews.record._handler(f.ctx, { id: "active" });
  assert.equal(f.rows("recentViews").length, 50);
  assert.ok(!f.rows("recentViews").some(row => row._id === "recent-0"));
});

function destination(latitude, longitude, miles, bearing) {
  const radians = degrees => degrees * Math.PI / 180;
  const startLatitude = radians(latitude), startLongitude = radians(longitude), angle = miles / 3958.7613, direction = radians(bearing);
  const targetLatitude = Math.asin(Math.sin(startLatitude) * Math.cos(angle) + Math.cos(startLatitude) * Math.sin(angle) * Math.cos(direction));
  const targetLongitude = startLongitude + Math.atan2(Math.sin(direction) * Math.sin(angle) * Math.cos(startLatitude), Math.cos(angle) - Math.sin(startLatitude) * Math.sin(targetLatitude));
  return { latitude: targetLatitude * 180 / Math.PI, longitude: ((targetLongitude * 180 / Math.PI + 540) % 360) - 180 };
}

test("every sampled point inside a radius belongs to its geographic query scope across poles, dateline and tile boundaries", () => {
  let scopedQueries = 0, stripQueries = 0;
  const centers = [[35.7796, -78.6382], [0, 0], [0, 179.9], [0, -179.9], [89.99, 15], [-89.99, -75], [90, 180], [-90, -180],
    [37.99999, -52.00001], [-26.00001, 75.99999], [5.99999, -148.00001], [0, 180], [0, -180]];
  // Deterministic samples through all latitude bands and geographic grid sizes.
  for (let i = 0; i < 24; i++) centers.push([-87 + i * 7.5, -177 + ((i * 47) % 354)]);
  for (const [latitude, longitude] of centers) for (const radiusMiles of [1, 15, 50, 125, 500]) {
    const scope = geoScope({ latitude, longitude, radiusMiles });
    if (scope) scopedQueries++;
    if (scope.startsWith("gy:")) stripQueries++;
    for (const fraction of [0, 0.25, 0.999999]) for (let bearing = 0; bearing < 360; bearing += 15) {
      const point = destination(latitude, longitude, radiusMiles * fraction, bearing);
      assert.ok(!scope || geoScopes(point.latitude, point.longitude).includes(scope),
        `Query ${latitude},${longitude} radius ${radiusMiles}, scope ${scope} excluded ${JSON.stringify(point)}`);
    }
  }
  assert.ok(scopedQueries > 100); assert.ok(stripQueries > 20);
});

test("distance browsing selects an indexed geographic scope and retains make, state and keyword constraints", async () => {
  const location = { city: "Raleigh", state: "NC", latitude: 35.7796, longitude: -78.6382 };
  const f = await indexedFixture([
    listing("match", { location, trim: "LE", title: "Toyota Camry LE" }),
    listing("wrong-make", { location, make: "Lexus", trim: "LE", title: "Lexus Camry LE" }),
    listing("wrong-state", { location: { ...location, state: "VA" }, trim: "LE", title: "Toyota Camry LE" }),
    listing("wrong-term", { location, trim: "SE", title: "Toyota Camry SE" }),
    listing("outside", { location: { ...location, ...destination(location.latitude, location.longitude, 60, 90) }, trim: "LE", title: "Toyota Camry LE" }),
  ]);
  const filters = { latitude: location.latitude, longitude: location.longitude, radiusMiles: 20, make: "Toyota", state: "NC", search: "Camry LE" };
  const result = await browse(f, filters, "price-low");
  assert.deepEqual(result.page.map(row => row._id), ["match"]);
  const indexedRead = f.reads.find(read => read.operation === "index" && read.table === "vehicleSearchTerms");
  assert.equal(indexedRead.index, "by_price");
  assert.ok(indexedRead.constraints.some(constraint => constraint.field === "scope" && constraint.value === geoScope(filters)));
  assert.ok(indexedRead.constraints.some(constraint => constraint.field === "token" && constraint.value === ""));
});

test("guest recently viewed accepts validated string IDs, deduplicates and excludes nonpublic listings", async () => {
  const f = fixture([listing("one"), listing("private", { status: "draft" }), listing("legacy", { status: "approved" })]);
  f.as(null);
  const result = await discovery.recentPublic._handler(f.ctx, { ids: ["invalid-id", "one", "one", "private", "legacy", "no such ID"] });
  assert.deepEqual(result.map(row => row._id), ["one", "legacy"]);
  assert.equal(result[0].contactInfo, ""); assert.deepEqual(result[0].moderationHistory, []);
  await assert.rejects(discovery.recentPublic._handler(f.ctx, { ids: Array(13).fill("one") }), /At most 12/);
});

test("backfill requires administrator access and advances one bounded vehicle per transaction", async () => {
  const f = fixture([listing("one"), listing("two")]);
  await assert.rejects(discovery.backfill._handler(f.ctx, { cursor: null }), /Administrator/);
  f.rows("users").find(user => user._id === "buyer").role = "admin";
  const first = await discovery.backfill._handler(f.ctx, { cursor: null });
  assert.deepEqual(first, { continueCursor: "1", isDone: false });
  assert.equal(f.rows("vehicleCatalog").length, 1);
  const pageRead = f.reads.find(read => read.operation === "paginate");
  assert.equal(pageRead.options.numItems, 1); assert.equal(pageRead.options.maximumRowsRead, 1);
  const second = await discovery.backfill._handler(f.ctx, { cursor: first.continueCursor });
  assert.equal(second.isDone, false); assert.equal(f.rows("vehicleCatalog").length, 2);
  const end = await discovery.backfill._handler(f.ctx, { cursor: second.continueCursor });
  assert.equal(end.isDone, true);
});

test("seller coordinates are validated before rounding and stored only at approximate precision", async () => {
  const f = fixture();
  const fields = { title: "Draft vehicle", make: "", model: "", year: 2020, mileage: 0, price: 0, photos: [], description: "", contactInfo: "" };
  for (const coordinates of [{ latitude: 90.00001, longitude: 0 }, { latitude: 0, longitude: 180.00001 },
    { latitude: -90.00001, longitude: 0 }, { latitude: 0, longitude: -180.00001 }, { latitude: 35 }, { latitude: NaN, longitude: 0 }]) {
    await assert.rejects(vehicles.saveDraft._handler(f.ctx, { ...fields, location: { city: "Raleigh", state: "NC", ...coordinates } }), /valid pair/);
  }
  assert.equal(f.rows("vehicles").length, 0);
  const saved = await vehicles.saveDraft._handler(f.ctx, { ...fields, location: { city: "Raleigh", state: "NC", latitude: 35.779654, longitude: -78.638276 } });
  const row = f.rows("vehicles").find(row => row._id === saved.id);
  assert.equal(row.location.latitude, 35.78); assert.equal(row.location.longitude, -78.64);
});

test("seller withdrawal removes discovery catalog and search postings in the status mutation", async () => {
  const f = await indexedFixture([listing("vehicle")]);
  f.as("seller");
  await vehicles.changeVehicleStatus._handler(f.ctx, { id: "vehicle", status: "withdrawn" });
  assert.equal(f.rows("vehicleCatalog").length, 0);
  assert.equal(f.rows("vehicleSearchTerms").length, 0);
  assert.equal((await browse(f)).page.length, 0);
  assert.equal(f.rows("listingNotifications").length, 1);
});
