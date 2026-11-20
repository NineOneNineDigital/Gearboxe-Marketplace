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
const users = await import("../convex/users.ts");
const { recordPolicyAcceptance, currentPolicyStatus, PUBLISHED_POLICY_PAIR } = await import("../convex/lib/policyConsent.ts");
// Synthetic release fixtures are never a published registry or policy approval.
const first = { termsVersion: "test-terms-1", privacyVersion: "test-privacy-1", termsEffectiveAt: 1, privacyEffectiveAt: 1,
  termsUrl: "/terms/test-terms-1", privacyUrl: "/privacy/test-privacy-1" };
const acceptance = pair => ({ accepted: true, termsVersion: pair.termsVersion, privacyVersion: pair.privacyVersion });
const paginationOpts = { cursor: null, numItems: 10 };

function fixture(t) {
  let actor = "owner", now = 10_000, nextId = 0;
  t.mock.method(Date, "now", () => now);
  const tables = { users: ["owner", "other", "admin", "superAdmin"].map(id => ({
    _id: id, externalId: id, name: id, createdAt: 1,
    role: ["admin", "superAdmin"].includes(id) ? id : "user",
  })), policyAcceptances: [], adminAuditLog: [] };
  const rows = table => tables[table] ??= [];
  const query = table => {
    const predicates = [];
    let direction = "asc";
    const builder = { eq(key, value) { predicates.push(row => row[key] === value); return builder; } };
    const matches = () => {
      const matched = rows(table).filter(row => predicates.every(predicate => predicate(row)));
      return structuredClone(direction === "desc" ? matched.reverse() : matched);
    };
    const q = {
      withIndex(_, fn) { fn(builder); return q; }, order(value) { direction = value; return q; },
      async unique() { const found = matches(); assert.ok(found.length < 2); return found[0] ?? null; },
      async paginate({ cursor, numItems }) {
        assert.ok(numItems <= 50);
        const offset = Number(cursor ?? 0), found = matches();
        return { page: found.slice(offset, offset + numItems), isDone: offset + numItems >= found.length, continueCursor: String(offset + numItems) };
      },
    };
    return q;
  };
  const ctx = {
    auth: { getUserIdentity: async () => actor ? { subject: actor } : null },
    db: { query, insert: async (table, data) => {
      const id = `${table}-${++nextId}`;
      rows(table).push({ _id: id, ...structuredClone(data) }); return id;
    }, get: async id => Object.values(tables).flat().find(row => row._id === id) ?? null },
  };
  return { ctx, rows, as: id => { actor = id; }, at: value => { now = value; },
    record: (input = acceptance(first), pair = first) => recordPolicyAcceptance(ctx, input, pair),
    call: (fn, args = {}) => fn._handler(ctx, args) };
}

test("no approved policies means public acceptance is disabled without writes", async t => {
  const f = fixture(t);
  assert.equal(PUBLISHED_POLICY_PAIR, null);
  assert.equal(await f.call(users.publishedPolicies), null);
  assert.deepEqual(await f.call(users.currentPolicyStatus), { published: null, provisioned: true, accepted: false });
  await assert.rejects(f.call(users.acceptPolicies, acceptance(first)), /not available/);
  assert.equal(f.rows("policyAcceptances").length, 0);
});

test("current acceptance status is private, provision-aware and version-specific", async t => {
  const f = fixture(t);
  assert.deepEqual(await currentPolicyStatus(f.ctx, first), { published: first, provisioned: true, accepted: false });
  await f.record();
  assert.deepEqual(await currentPolicyStatus(f.ctx, first), { published: first, provisioned: true, accepted: true });
  const next = { ...first, privacyVersion: "test-privacy-2", privacyUrl: "/privacy/test-privacy-2" };
  assert.deepEqual(await currentPolicyStatus(f.ctx, next), { published: next, provisioned: true, accepted: false });
  f.as("other");
  assert.equal((await currentPolicyStatus(f.ctx, first)).accepted, false);
  f.as("new-clerk-account");
  assert.deepEqual(await currentPolicyStatus(f.ctx, first), { published: first, provisioned: false, accepted: false });
});

test("explicit consent, exact current pair and effective dates are required", async t => {
  const f = fixture(t);
  for (const accepted of [false, undefined, "true"]) {
    await assert.rejects(f.record({ ...acceptance(first), accepted }), /Explicit/);
  }
  await assert.rejects(f.record({ ...acceptance(first), termsVersion: "stale" }), /changed/);
  await assert.rejects(f.record({ ...acceptance(first), privacyVersion: "stale" }), /changed/);
  await assert.rejects(f.record(acceptance(first), { ...first, termsEffectiveAt: 10_001 }), /not available/);
  await assert.rejects(f.record(acceptance(first), { ...first, privacyEffectiveAt: 10_001 }), /not available/);
  assert.equal(f.rows("policyAcceptances").length, 0);
});

test("identity and timestamp come from the server and retries retain first evidence", async t => {
  const f = fixture(t);
  const id = await f.record({ ...acceptance(first), userId: "other", clerkUserId: "other", acceptedAt: 1, termsUrl: "fake" });
  f.at(20_000);
  assert.equal(await f.record(), id);
  assert.deepEqual(f.rows("policyAcceptances"), [{ _id: id, ...first, userId: "owner", clerkUserId: "owner", acceptedAt: 10_000 }]);
});

test("a policy update rejects a stale form and preserves prior version history", async t => {
  const f = fixture(t);
  await f.record();
  const second = { ...first, privacyVersion: "test-privacy-2", privacyUrl: "/privacy/test-privacy-2", privacyEffectiveAt: 15_000 };
  f.at(20_000);
  await assert.rejects(f.record(acceptance(first), second), /changed/);
  await f.record(acceptance(second), second);
  assert.equal(f.rows("policyAcceptances").length, 2);
  assert.deepEqual(f.rows("policyAcceptances").map(row => [row.privacyVersion, row.acceptedAt]), [["test-privacy-1", 10_000], ["test-privacy-2", 20_000]]);
});

test("anonymous, suspended and not-yet-provisioned users cannot create evidence", async t => {
  const f = fixture(t);
  f.as(null); await assert.rejects(f.record(), /Authentication/);
  f.as("new-clerk-account"); await assert.rejects(f.record(), /Authentication/);
  f.as("owner"); f.rows("users")[0].suspendedAt = 10;
  await assert.rejects(f.record(), /suspended/);
  delete f.rows("users")[0].suspendedAt;
  f.as("new-clerk-account");
  f.rows("users").push({ _id: "provisioned", externalId: "new-clerk-account", role: "user" });
  await f.record(); await f.record();
  assert.equal(f.rows("policyAcceptances").length, 1);
  assert.equal(f.rows("policyAcceptances")[0].userId, "provisioned");
});

test("legacy users and duplicate Clerk callbacks never receive invented acceptance", async t => {
  const f = fixture(t);
  assert.deepEqual((await f.call(users.policyAcceptanceHistory, { paginationOpts })).page, []);
  const data = { id: "clerk-new", email_addresses: [], phone_numbers: [], unsafe_metadata: { accepted: true, termsVersion: first.termsVersion } };
  f.ctx.db.patch = async (id, patch) => Object.assign(f.rows("users").find(row => row._id === id), patch);
  await f.call(users.upsertFromClerk, { data });
  await f.call(users.upsertFromClerk, { data });
  assert.equal(f.rows("users").filter(row => row.externalId === "clerk-new").length, 1);
  assert.equal(f.rows("policyAcceptances").length, 0);
});

test("owner-only history and public users reveal no other account consent metadata", async t => {
  const f = fixture(t);
  await f.record();
  f.as("other"); assert.deepEqual((await f.call(users.policyAcceptanceHistory, { paginationOpts })).page, []);
  const publicUser = await f.call(users.getUserById, { id: "owner" });
  assert.deepEqual(Object.keys(publicUser).sort(), ["_id", "createdAt", "emailVerified", "identityVerified", "name", "phoneVerified"]);
  assert.equal(publicUser.clerkUserId, undefined);
  f.as("admin"); assert.deepEqual((await f.call(users.policyAcceptanceHistory, { paginationOpts })).page, []);
  f.as(null); await assert.rejects(f.call(users.policyAcceptanceHistory, { paginationOpts }), /Authentication/);
});

test("support reads require an active administrator and record a bounded audited read", async t => {
  const f = fixture(t);
  await f.record();
  const args = { userId: "owner", reason: "Test support case", paginationOpts: { ...paginationOpts, numItems: 100 } };
  f.as("other"); await assert.rejects(f.call(users.inspectPolicyAcceptanceHistory, args), /Administrator/);
  f.as("admin"); await assert.rejects(f.call(users.inspectPolicyAcceptanceHistory, { ...args, reason: " " }), /reason/);
  assert.equal(f.rows("adminAuditLog").length, 0);
  assert.equal((await f.call(users.inspectPolicyAcceptanceHistory, args)).page.length, 1);
  assert.deepEqual(f.rows("adminAuditLog"), [{ _id: "adminAuditLog-2", actorId: "admin", targetUserId: "owner", action: "policy_acceptance_read", source: "support", reason: "Test support case", createdAt: 10_000 }]);
  f.rows("users").find(row => row._id === "admin").suspendedAt = 10;
  await assert.rejects(f.call(users.inspectPolicyAcceptanceHistory, args), /suspended/);
});
