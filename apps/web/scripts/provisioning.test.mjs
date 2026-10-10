import assert from "node:assert/strict";
import test from "node:test";
import { provisionFirstSuperAdmin } from "../convex/lib/provisioning.ts";

const args = { clerkUserId: "user_owner", expectedEmail: "owner@example.com", reason: "Approved launch provisioning" };
const env = { MARKETPLACE_ENV: "production", BOOTSTRAP_SUPER_ADMIN_CLERK_ID: "user_owner" };
function fixture(role = "user") {
  const user = { _id: "user-id", externalId: "user_owner", email: "owner@example.com", role };
  const writes = [];
  const db = {
    query: () => ({
      collect: async () => [user],
      withIndex: () => ({ unique: async () => user }),
    }),
    patch: async (...values) => writes.push(["patch", ...values]),
    insert: async (...values) => writes.push(["insert", ...values]),
  };
  return { ctx: { db }, writes };
}
test("first administrator requires an allowlist and matching synchronized email", async () => {
  for (const [input, config] of [
    [args, { ...env, BOOTSTRAP_SUPER_ADMIN_CLERK_ID: undefined }],
    [{ ...args, expectedEmail: "other@example.com" }, env],
    [{ ...args, reason: "" }, env],
    [args, { ...env, MARKETPLACE_ENV: "ci" }],
  ]) {
    const { ctx, writes } = fixture();
    await assert.rejects(provisionFirstSuperAdmin(ctx, input, config));
    assert.equal(writes.length, 0);
  }
});
test("bootstrap cannot run when a super administrator already exists", async () => {
  const { ctx, writes } = fixture("superAdmin");
  await assert.rejects(provisionFirstSuperAdmin(ctx, args, env), /Bootstrap is disabled/);
  assert.equal(writes.length, 0);
});
test("bootstrap records a role change and an audit entry", async () => {
  const { ctx, writes } = fixture();
  assert.equal((await provisionFirstSuperAdmin(ctx, args, env)).success, true);
  assert.deepEqual(writes[0], ["patch", "user-id", { role: "superAdmin" }]);
  assert.equal(writes[1][1], "adminAuditLog");
  assert.equal(writes[1][2].reason, args.reason);
});
