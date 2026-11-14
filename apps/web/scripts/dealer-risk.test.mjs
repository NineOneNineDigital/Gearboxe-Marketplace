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
const { summarizeDealerRisk, DEALER_RISK_WINDOW_MS } = await import("../convex/lib/dealerRiskPolicy.ts");
const { forListing, recordReview } = await import("../convex/dealerRisk.ts");
const now = 200 * 86_400_000;
const listing = (overrides = {}) => ({ status: "active", createdAt: now, location: { city: "Raleigh", state: "NC" }, ...overrides });

test("one seller and a legitimate multi-car household are not labeled", () => {
  assert.equal(summarizeDealerRisk([listing()], 0, now, false).flagged, false);
  const result = summarizeDealerRisk([listing({ vin: "A" }), listing({ vin: "B" }), listing({ vin: "C" })], 0, now, false);
  assert.equal(result.flagged, false);
  assert.equal(result.sharedLocationCount, 3);
});
test("repeated activity and corroborating report or VIN are cues, not decisions", () => {
  const rows = [listing({ vin: "A" }), listing({ vin: "A" }), listing({ vin: "C" })];
  assert.equal(summarizeDealerRisk(rows, 0, now, false).repeatedVin, true);
  assert.equal(summarizeDealerRisk(rows, 0, now, false).flagged, true);
  assert.equal(summarizeDealerRisk(rows.map((r, i) => ({ ...r, vin: String(i) })), 1, now, false).flagged, true);
  assert.equal(summarizeDealerRisk(Array.from({ length: 5 }, () => listing()), 0, now, true).truncated, true);
});
test("recent activity includes withdrawn and sold listings without treating them as current", () => {
  const old = now - DEALER_RISK_WINDOW_MS - 1;
  const rows = [
    listing({ status: "withdrawn", createdAt: now, vin: "A" }),
    listing({ status: "sold", createdAt: old, vin: "A", moderationHistory: [{ toStatus: "pending", createdAt: now }] }),
    listing({ status: "archived", createdAt: now }),
    listing({ status: "rejected", createdAt: now }),
    listing({ status: "draft", createdAt: now }),
    listing({ status: "withdrawn", createdAt: old, moderationHistory: [{ toStatus: "pending", createdAt: old }] }),
  ];
  const result = summarizeDealerRisk(rows, 0, now, false);
  assert.equal(result.currentCount, 0);
  assert.equal(result.recentCount, 5);
  assert.equal(result.repeatedVin, false);
  assert.equal(result.sharedLocationCount, 0);
  assert.equal(result.flagged, true);
});
test("stale listing activity is excluded regardless of status", () => {
  const old = now - DEALER_RISK_WINDOW_MS - 1;
  const rows = ["active", "withdrawn", "sold", "archived", "rejected", "draft"].map(status => listing({ status, createdAt: old, moderationHistory: [{ toStatus: "pending", createdAt: old }] }));
  const result = summarizeDealerRisk(rows, 0, now, false);
  assert.equal(result.currentCount, 1); assert.equal(result.recentCount, 0); assert.equal(result.flagged, false);
});
test("risk reads and review writes require an administrator and bounded indexed reads", async () => {
  let role = "user";
  const writes = [], takes = [];
  const user = () => ({ _id: "actor", externalId: "clerk", role });
  const query = table => {
    const q = { withIndex(_index, callback) { const b = { eq() { return b; } }; callback(b); return q; }, order() { return q; }, unique: async () => user(), take: async n => { takes.push([table, n]); return []; } };
    return q;
  };
  const ctx = { auth: { getUserIdentity: async () => ({ subject: "clerk" }) }, db: { query, get: async () => ({ _id: "vehicle", userId: "seller" }), insert: async (table, row) => writes.push({ table, ...row }) } };
  await assert.rejects(forListing._handler(ctx, { vehicleId: "vehicle" }), /Administrator access required/);
  await assert.rejects(recordReview._handler(ctx, { vehicleId: "vehicle", nextStep: "escalate", reason: "reason" }), /Administrator access required/);
  role = "admin";
  await forListing._handler(ctx, { vehicleId: "vehicle" });
  assert.deepEqual(takes, [["vehicles", 101], ["trustReports", 11], ["trustReports", 11], ["trustReports", 11]]);
  await assert.rejects(recordReview._handler(ctx, { vehicleId: "vehicle", nextStep: "escalate", reason: " " }), /Reason/);
  await recordReview._handler(ctx, { vehicleId: "vehicle", nextStep: "escalate", reason: "Review ownership authority" });
  assert.equal(writes[0].action, "repeat_listing_escalate");
  assert.equal(writes[0].targetUserId, "seller");
});
