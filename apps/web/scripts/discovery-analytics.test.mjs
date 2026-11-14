import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) for (const suffix of [".ts", ".js"]) {
    const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });

const { record, lastThirtyDays, utcDay } = await import("../convex/discoveryAnalytics.ts");

function fixture() {
  let actor = "admin", serial = 0;
  const rows = { discoveryActivity: [], users: [{ _id: "admin", externalId: "admin", role: "admin" }, { _id: "buyer", externalId: "buyer", role: "user" }] };
  const query = table => {
    const conditions = [];
    const q = {
      withIndex(_name, callback) {
        const filter = { eq(key, value) { conditions.push(row => row[key] === value); return filter; }, gte(key, value) { conditions.push(row => row[key] >= value); return filter; } };
        callback(filter); return q;
      },
      unique: async () => rows[table].find(row => conditions.every(check => check(row))) ?? null,
      take: async limit => rows[table].filter(row => conditions.every(check => check(row))).slice(0, limit),
    };
    return q;
  };
  const ctx = { auth: { getUserIdentity: async () => actor ? { subject: actor } : null }, db: {
    query,
    insert: async (table, row) => { const id = `row-${++serial}`; rows[table].push({ _id: id, ...row }); return id; },
    patch: async (id, values) => Object.assign(rows.discoveryActivity.find(row => row._id === id), values),
  } };
  return { rows, ctx, as: value => { actor = value; } };
}

test("anonymous discovery events aggregate by UTC day and type without search or visitor details", async () => {
  const f = fixture();
  f.as(null);
  await record._handler(f.ctx, { kind: "zip_entry" });
  await record._handler(f.ctx, { kind: "zip_entry" });
  await record._handler(f.ctx, { kind: "listing_click" });
  assert.equal(f.rows.discoveryActivity.length, 2);
  assert.deepEqual(f.rows.discoveryActivity.map(({ day, kind, count }) => ({ day, kind, count })), [
    { day: utcDay(Date.now()), kind: "zip_entry", count: 2 },
    { day: utcDay(Date.now()), kind: "listing_click", count: 1 },
  ]);
  assert.deepEqual(Object.keys(f.rows.discoveryActivity[0]).sort(), ["_id", "count", "day", "kind"]);
});

test("only an active administrator can read bounded aggregate totals", async () => {
  const f = fixture();
  for (const kind of ["zip_entry", "zero_results", "radius_expand", "nationwide_view", "listing_click"])
    await record._handler(f.ctx, { kind });
  const report = await lastThirtyDays._handler(f.ctx, {});
  assert.equal(report.totals.zip_entry, 1);
  assert.equal(report.totals.listing_click, 1);
  assert.equal(report.truncated, false);
  assert.doesNotMatch(JSON.stringify(report), /zipCode|visitor|latitude|longitude|vehicleId/);
  f.as("buyer"); await assert.rejects(lastThirtyDays._handler(f.ctx, {}), /Administrator/);
  f.as(null); await assert.rejects(lastThirtyDays._handler(f.ctx, {}), /Authentication/);
});

test("a saturated daily event stops writing and the report labels its totals as capped", async () => {
  const f = fixture();
  f.rows.discoveryActivity.push({ _id: "saturated", day: utcDay(Date.now()), kind: "zip_entry", count: 10_000 });
  await record._handler(f.ctx, { kind: "zip_entry" });
  assert.equal(f.rows.discoveryActivity[0].count, 10_000);
  const report = await lastThirtyDays._handler(f.ctx, {});
  assert.equal(report.capped, true);
  assert.equal(report.totals.zip_entry, 10_000);
});
