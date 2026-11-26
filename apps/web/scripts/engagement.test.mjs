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
const { recordEngagementInquiry, recordEngagementResponse, engagementPurgeAt } = await import("../convex/lib/engagement.ts");
const { weekly, reviewPairs, setExcluded, purge } = await import("../convex/engagement.ts");
const { getAdminStats } = await import("../convex/admin.ts");
function fixture() {
  let actor = "admin", sequence = 0;
  const tables = { engagementPairs: [], engagementTracking: [], adminAuditLog: [], users: [{ _id: "admin", externalId: "admin", role: "admin" }, { _id: "buyer", externalId: "buyer", role: "user", emailVerified: true }] };
  const query = table => {
    const checks = [];
    const q = { withIndex(_name, cb) { const b = { eq(field, v) { checks.push(x => x[field] === v); return b; }, gte(field, v) { checks.push(x => x[field] >= v); return b; }, lte(field, v) { checks.push(x => x[field] <= v); return b; } }; cb(b); return q; }, unique: async () => tables[table].find(x => checks.every(f => f(x))) ?? null, take: async n => tables[table].filter(x => checks.every(f => f(x))).slice(0, n) };
    return q;
  };
  const ctx = { auth: { getUserIdentity: async () => actor ? { subject: actor } : null }, db: { query, get: async id => Object.values(tables).flat().find(x => x._id === id) ?? null, insert: async (table, row) => { const id = `id-${++sequence}`; tables[table].push({ _id: id, ...row }); return id; }, patch: async (id, value) => { const row = Object.values(tables).flat().find(x => x._id === id); Object.assign(row, value); }, delete: async id => { for (const rows of Object.values(tables)) { const i = rows.findIndex(row => row._id === id); if (i >= 0) rows.splice(i, 1); } } } };
  return { ctx, tables, as: value => { actor = value; } };
}
test("inquiries deduplicate across sources and seller responses remain separate from reserved", async () => {
  const f = fixture(), now = Date.now(), vehicle = { _id: "vehicle", userId: "seller" }, buyer = f.tables.users[1];
  await recordEngagementInquiry(f.ctx, vehicle, buyer, "active", "message", now - 1000);
  await recordEngagementInquiry(f.ctx, vehicle, buyer, "active", "offer", now - 900);
  await recordEngagementInquiry(f.ctx, vehicle, buyer, "reserved", "message", now - 800);
  assert.equal(f.tables.engagementPairs.length, 2);
  await recordEngagementResponse(f.ctx, "vehicle", "buyer", "seller", now - 700, "active");
  await recordEngagementResponse(f.ctx, "vehicle", "buyer", "seller", now - 600, "active");
  assert.equal(f.tables.engagementPairs[0].respondedAt, now - 700);
  assert.equal(f.tables.engagementPairs[1].respondedAt, undefined);
  const report = await weekly._handler(f.ctx, {});
  assert.equal(report.active.inquiries, 1); assert.equal(report.active.responses, 1);
  assert.equal(report.reserved.inquiries, 1); assert.equal(report.reserved.responses, 0);
  assert.equal(report.trackingStartedAt, now - 1000);
  assert.doesNotMatch(JSON.stringify(report), /buyer|seller|vehicle|price|content/);
  f.as("buyer"); await assert.rejects(weekly._handler(f.ctx, {}), /Administrator/);
  f.as(null); await assert.rejects(weekly._handler(f.ctx, {}), /Authentication/);
});
test("admins can audit exclusion and restoration without exposing private content in reports", async () => {
  const f = fixture(), now = Date.now(), vehicle = { _id: "vehicle", userId: "seller" }, buyer = f.tables.users[1];
  await recordEngagementInquiry(f.ctx, vehicle, buyer, "active", "offer", now - 1000);
  await recordEngagementResponse(f.ctx, "vehicle", "buyer", "seller", now - 500, "active");
  const pairId = f.tables.engagementPairs[0]._id;
  const review = await reviewPairs._handler(f.ctx, {});
  assert.equal(review.pairs.length, 1);
  assert.doesNotMatch(JSON.stringify(review), /price|messageText|contact|email/);
  await assert.rejects(setExcluded._handler(f.ctx, { pairId, excluded: true, reason: "short" }), /Reason/);
  await setExcluded._handler(f.ctx, { pairId, excluded: true, reason: "Known internal test account" });
  assert.equal((await weekly._handler(f.ctx, {})).active.inquiries, 0);
  assert.equal((await weekly._handler(f.ctx, {})).excludedPairs, 1);
  assert.equal(f.tables.adminAuditLog[0].action, "engagement_pair_excluded");
  assert.match(f.tables.adminAuditLog[0].reason, /Known internal test account/);
  await setExcluded._handler(f.ctx, { pairId, excluded: true, reason: "Known internal test account" });
  assert.equal(f.tables.adminAuditLog.length, 1);
  f.as("buyer");
  await assert.rejects(reviewPairs._handler(f.ctx, {}), /Administrator/);
  await assert.rejects(setExcluded._handler(f.ctx, { pairId, excluded: false, reason: "Restore after investigation" }), /Administrator/);
  f.as("admin");
  await setExcluded._handler(f.ctx, { pairId, excluded: false, reason: "Restored after investigation" });
  assert.equal((await weekly._handler(f.ctx, {})).active.responses, 1);
  assert.equal(f.tables.adminAuditLog[1].action, "engagement_pair_restored");
});
test("unverified, suspended, and self inquiries are not captured", async () => {
  const f = fixture(), vehicle = { _id: "vehicle", userId: "seller" };
  for (const buyer of [{ _id: "buyer", emailVerified: false }, { _id: "buyer", emailVerified: true, suspendedAt: 1 }, { _id: "seller", emailVerified: true }]) await recordEngagementInquiry(f.ctx, vehicle, buyer, "active", "message", Date.now());
  assert.equal(f.tables.engagementPairs.length, 0);
});

test("cleanup deletes expired pairs in bounded batches and clamps six-month UTC dates", async () => {
  assert.equal(new Date(engagementPurgeAt(Date.UTC(2024, 7, 31, 12))).toISOString(), "2025-02-28T12:00:00.000Z");
  const f = fixture(), now = Date.now();
  for (let i = 0; i < 101; i++) f.tables.engagementPairs.push({ _id: `expired-${i}`, purgeAt: now - 1 });
  f.tables.engagementPairs.push({ _id: "retained", purgeAt: now + 86400000 });
  assert.equal(await purge._handler(f.ctx, {}), 100);
  assert.equal(await purge._handler(f.ctx, {}), 1);
  assert.deepEqual(f.tables.engagementPairs.map(row => row._id), ["retained"]);
});

test("operator inventory context excludes expired active listings and separates reserved from sold", async () => {
  const now = Date.now();
  const tables = {
    users: [{ _id: "admin", externalId: "admin", role: "admin" }],
    vehicles: [
      { status: "active", availabilityDueAt: now + 1000 },
      { status: "active", availabilityDueAt: now - 1000 },
      { status: "reserved" },
      { status: "sold" },
    ],
    events: [], registrations: [],
  };
  const ctx = { auth: { getUserIdentity: async () => ({ subject: "admin" }) }, db: {
    query: table => ({ withIndex: () => ({ unique: async () => tables.users[0] }), collect: async () => tables[table] }),
  } };
  const stats = await getAdminStats._handler(ctx, {});
  assert.equal(stats.activeVehicles, 1);
  assert.equal(stats.reservedVehicles, 1);
  assert.equal(stats.soldVehicles, 1);
});
