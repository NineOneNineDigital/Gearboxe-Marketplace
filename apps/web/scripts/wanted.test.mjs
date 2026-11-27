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

const wanted = await import("../convex/wanted.ts");
const policy = await import("../convex/lib/wantedPolicy.ts");
const { wantedAreaForZip } = await import("../lib/wanted-location.ts");
const request = { title: "Family SUV", maxBudget: 28000, zip: "27601", radiusMiles: 50, make: "Honda", model: "Pilot" };

function fixture() {
  let actor = "buyer", seq = 0;
  let beforeRunMutation = () => {};
  globalThis.fetch = async () => new Response(JSON.stringify({ places: [{ "place name": "Raleigh", "state abbreviation": "NC" }] }), { status: 200 });
  let tables = { users: [
    { _id: "buyer", externalId: "clerk-buyer", emailVerified: true, role: "user", email: "buyer@example.com" },
    { _id: "other", externalId: "clerk-other", emailVerified: true, role: "user", email: "other@example.com" },
    { _id: "unverified", externalId: "clerk-unverified", emailVerified: false, role: "user", email: "unverified@example.com" },
    { _id: "admin", externalId: "clerk-admin", emailVerified: true, role: "admin", email: "admin@example.com" },
  ], wantedRequests: [], trustRateLimits: [], notifications: [], emailOutbox: [], trustReports: [], adminAuditLog: [] };
  const clone = structuredClone;
  const get = async id => clone(Object.values(tables).flat().find(row => row._id === id) ?? null);
  const query = table => {
    const tests = [];
    let desc = false;
    const builder = {
      eq(field, value) { tests.push(row => row[field] === value); return builder; },
      gt(field, value) { tests.push(row => row[field] > value); return builder; },
      lte(field, value) { tests.push(row => row[field] <= value); return builder; },
    };
    const q = {
      withIndex(_name, filter) { filter(builder); return q; },
      order(value) { desc = value === "desc"; return q; },
      collect: async () => { const rows = (tables[table] ?? []).filter(row => tests.every(fn => fn(row))); return clone(desc ? rows.reverse() : rows); },
      unique: async () => { const rows = await q.collect(); assert.ok(rows.length <= 1); return rows[0] ?? null; },
      take: async count => (await q.collect()).slice(0, count),
      paginate: async ({ numItems, cursor }) => { const rows = await q.collect(); const start = Number(cursor ?? 0), end = start + numItems; return { page: rows.slice(start, end), isDone: end >= rows.length, continueCursor: String(end) }; },
    };
    return q;
  };
  const ctx = {
    auth: { getUserIdentity: async () => actor ? { subject: `clerk-${actor}` } : null },
    db: {
      get, query,
      insert: async (table, fields) => { const id = `row-${++seq}`; (tables[table] ??= []).push({ _id: id, ...clone(fields) }); return id; },
      patch: async (id, fields) => { const row = Object.values(tables).flat().find(row => row._id === id); assert.ok(row); Object.assign(row, clone(fields)); },
    },
    scheduler: { runAfter: async () => {}, runAt: async () => {} },
  };
  const mutate = async (fn, args = {}) => {
    const before = clone(tables);
    try { return await fn._handler(ctx, args); }
    catch (error) { tables = before; throw error; }
  };
  ctx.runMutation = async (_reference, args) => {
    beforeRunMutation();
    return mutate(args.id ? wanted.editResolved : wanted.createResolved, args);
  };
  return { ctx, mutate, rows: name => tables[name], as: who => { actor = who; }, beforeRunMutation: fn => { beforeRunMutation = fn; } };
}

test("anonymous browsing excludes ZIP, owner identity, and expired or closed requests", async () => {
  const f = fixture();
  const id = await f.mutate(wanted.create, request);
  f.as(null);
  const board = (await wanted.browse._handler(f.ctx, { paginationOpts: { numItems: 24, cursor: null } })).page;
  assert.equal(board.length, 1);
  assert.equal(board[0]._id, id);
  assert.equal(board[0].area, "Raleigh, NC");
  for (const field of ["zip", "userId", "email", "name"]) assert.equal(field in board[0], false);
  f.rows("wantedRequests")[0].expiresAt = Date.now() - 1;
  assert.deepEqual((await wanted.browse._handler(f.ctx, { paginationOpts: { numItems: 24, cursor: null } })).page, []);
  f.rows("wantedRequests")[0].expiresAt = Date.now() + 1000;
  f.rows("wantedRequests")[0].status = "closed";
  assert.deepEqual((await wanted.browse._handler(f.ctx, { paginationOpts: { numItems: 24, cursor: null } })).page, []);
});

test("verified buyer can create five per day; rejected attempts and renewals do not consume quota", async () => {
  const f = fixture();
  f.as(null); await assert.rejects(f.mutate(wanted.create, request), /Authentication/);
  f.as("unverified"); await assert.rejects(f.mutate(wanted.create, request), /Verify your email/);
  f.as("buyer"); await assert.rejects(f.mutate(wanted.create, { ...request, zip: "2760" }), /five-digit ZIP/);
  const spoofed = await f.mutate(wanted.create, { ...request, area: "Fake City, CA" });
  assert.equal(f.rows("wantedRequests").find(row => row._id === spoofed).area, "Raleigh, NC");
  await assert.rejects(f.mutate(wanted.create, { ...request, details: "Email me at buyer@example.com" }), /contact information/);
  await assert.rejects(f.mutate(wanted.create, { ...request, title: "Family SUV in 27601" }), /ZIP/);
  for (const field of ["make", "model", "transmission"]) {
    await assert.rejects(f.mutate(wanted.create, { ...request, [field]: "buyer@example.com" }), /contact information/);
    await assert.rejects(f.mutate(wanted.create, { ...request, [field]: "27601" }), /ZIP/);
  }
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(await f.mutate(wanted.create, { ...request, title: `Family SUV ${i}` }));
  await assert.rejects(f.mutate(wanted.create, request), /Too many requests/);
  assert.equal(f.rows("wantedRequests").length, 5);
  assert.equal(f.rows("trustRateLimits")[0].count, 5);
  await f.mutate(wanted.stillLooking, { id: ids[0] });
  assert.equal(f.rows("trustRateLimits")[0].count, 5);
  f.as("other"); await assert.rejects(f.mutate(wanted.close, { id: ids[0] }), /unavailable/);
});

test("older active requests do not impose an accumulated count cap", async () => {
  const f = fixture();
  for (let i = 0; i < 8; i++) f.rows("wantedRequests").push({
    _id: `older-${i}`, userId: "buyer", status: "active", expiresAt: Date.now() + 86_400_000,
    title: `Older request ${i}`, maxBudget: 20_000, zip: "27601", area: "Raleigh, NC",
  });
  const id = await f.mutate(wanted.create, request);
  assert.equal(f.rows("wantedRequests").length, 9);
  assert.ok(f.rows("wantedRequests").some(row => row._id === id && row.status === "active"));
  assert.equal(f.rows("trustRateLimits")[0].count, 1);
});

test("only owner can edit; edits preserve expiry and do not consume creation quota", async () => {
  const f = fixture();
  const id = await f.mutate(wanted.create, request);
  const expiry = f.rows("wantedRequests")[0].expiresAt;
  f.as("other"); await assert.rejects(f.mutate(wanted.edit, { id, ...request, title: "Changed" }), /unavailable/);
  globalThis.fetch = async () => new Response(JSON.stringify({ places: [{ "place name": "Durham", "state abbreviation": "NC" }] }), { status: 200 });
  f.as("buyer"); await f.mutate(wanted.edit, { id, ...request, zip: "27701", area: "Fake City, CA", title: "Updated family SUV", radiusMiles: undefined });
  assert.equal(f.rows("wantedRequests")[0].title, "Updated family SUV");
  assert.equal(f.rows("wantedRequests")[0].zip, "27701");
  assert.equal(f.rows("wantedRequests")[0].area, "Durham, NC");
  assert.equal(f.rows("wantedRequests")[0].radiusMiles, undefined);
  assert.equal(f.rows("wantedRequests")[0].expiresAt, expiry);
  assert.equal(f.rows("trustRateLimits")[0].count, 1);
  await assert.rejects(f.mutate(wanted.edit, { id, ...request, details: "Call 919-555-1234" }), /contact information/);
});

test("lookup failure prevents create and edit writes", async () => {
  const f = fixture();
  globalThis.fetch = async () => new Response(null, { status: 404 });
  await assert.rejects(f.mutate(wanted.create, request), /ZIP code not found/);
  assert.equal(f.rows("wantedRequests").length, 0);
  assert.equal(f.rows("trustRateLimits").length, 0);
  globalThis.fetch = async () => new Response(JSON.stringify({ places: [{ "place name": "Raleigh", "state abbreviation": "NC" }] }), { status: 200 });
  const id = await f.mutate(wanted.create, request);
  globalThis.fetch = async () => new Response(null, { status: 404 });
  await assert.rejects(f.mutate(wanted.edit, { id, ...request, title: "Should not persist" }), /ZIP code not found/);
  assert.equal(f.rows("wantedRequests")[0].title, request.title);
});

test("create and edit recheck authorization after ZIP lookup", async () => {
  const f = fixture();
  f.beforeRunMutation(() => f.as(null));
  await assert.rejects(f.mutate(wanted.create, request), /Authentication/);
  assert.equal(f.rows("wantedRequests").length, 0);
  f.beforeRunMutation(() => {});
  f.as("buyer");
  const id = await f.mutate(wanted.create, request);
  f.beforeRunMutation(() => f.as("other"));
  await assert.rejects(f.mutate(wanted.edit, { id, ...request, title: "Unauthorized" }), /unavailable/);
  assert.equal(f.rows("wantedRequests")[0].title, request.title);
});

test("expired and closed requests remain private Past until deleted; renewal starts a new 30 days", async () => {
  const f = fixture();
  const id = await f.mutate(wanted.create, request);
  const row = f.rows("wantedRequests")[0];
  row.expiresAt = Date.now() - 1;
  assert.equal((await wanted.mine._handler(f.ctx, {})).past.length, 1);
  await f.mutate(wanted.expireDue);
  assert.equal(f.rows("wantedRequests")[0].status, "expired");
  await f.mutate(wanted.stillLooking, { id });
  assert.equal((await wanted.mine._handler(f.ctx, {})).current.length, 1);
  assert.deepEqual((await wanted.browse._handler(f.ctx, { paginationOpts: { numItems: 24, cursor: null } })).page.map(row => row._id), [id]);
  assert.ok(f.rows("wantedRequests")[0].expiresAt > Date.now() + 29 * 86_400_000);
  await f.mutate(wanted.close, { id });
  assert.equal((await wanted.mine._handler(f.ctx, {})).past.length, 1);
  await f.mutate(wanted.remove, { id });
  assert.equal((await wanted.mine._handler(f.ctx, {})).past.length, 0);
  assert.equal(f.rows("wantedRequests")[0].status, "deleted");
});

test("reminders send email and in-app once per expiry cycle and ignore renewed or closed rows", async () => {
  const f = fixture();
  const id = await f.mutate(wanted.create, request);
  const row = f.rows("wantedRequests")[0];
  row.expiresAt = Date.now() + 2 * 86_400_000;
  row.reminderAt = Date.now() - 1;
  await f.mutate(wanted.remindExpiring);
  await f.mutate(wanted.remindExpiring);
  assert.equal(f.rows("notifications").length, 1);
  assert.equal(f.rows("emailOutbox").length, 1);
  assert.equal(f.rows("notifications")[0].userId, "buyer");
  await f.mutate(wanted.remindOne, { id, expectedExpiry: row.expiresAt });
  assert.equal(f.rows("notifications").length, 1);
  await f.mutate(wanted.stillLooking, { id });
  await f.mutate(wanted.remindOne, { id, expectedExpiry: row.expiresAt });
  assert.equal(f.rows("notifications").length, 1);
  await f.mutate(wanted.remindExpiring);
  assert.equal(f.rows("notifications").length, 1);
  f.rows("wantedRequests")[0].expiresAt = Date.now() + 2 * 86_400_000;
  f.rows("wantedRequests")[0].reminderAt = Date.now() - 1;
  await f.mutate(wanted.close, { id });
  await f.mutate(wanted.remindExpiring);
  assert.equal(f.rows("notifications").length, 1);
  assert.ok(policy.wantedReminderDue({ status: "active", expiresAt: Date.now() + 2 * 86_400_000 }, Date.now()));
});

test("reporting requires account, prevents self-report, and records a moderation case", async () => {
  const f = fixture();
  const id = await f.mutate(wanted.create, request);
  f.as(null); await assert.rejects(f.mutate(wanted.report, { id, reason: "spam", details: "Repeated posts" }), /Authentication/);
  f.as("buyer"); await assert.rejects(f.mutate(wanted.report, { id, reason: "spam", details: "Repeated posts" }), /unavailable/);
  f.as("other"); await f.mutate(wanted.report, { id, reason: "spam", details: "Repeated posts" });
  assert.equal(f.rows("trustReports")[0].wantedRequestId, id);
  assert.equal(f.rows("trustReports")[0].targetUserId, "buyer");
});

test("admin takedown hides a request, notifies its owner, and prevents self-republication", async () => {
  const f = fixture();
  const id = await f.mutate(wanted.create, request);
  await assert.rejects(f.mutate(wanted.moderateRemove, { id, reason: "spam" }), /Administrator/);
  f.as("admin"); await f.mutate(wanted.moderateRemove, { id, reason: "spam" });
  assert.equal(f.rows("wantedRequests")[0].status, "removed");
  assert.equal(f.rows("adminAuditLog")[0].wantedRequestId, id);
  assert.equal(f.rows("notifications")[0].userId, "buyer");
  assert.deepEqual((await wanted.browse._handler(f.ctx, { paginationOpts: { numItems: 24, cursor: null } })).page, []);
  f.as("buyer");
  await assert.rejects(f.mutate(wanted.stillLooking, { id }), /removed by the safety team/);
  await assert.rejects(f.mutate(wanted.edit, { id, ...request }), /removed by the safety team/);
  assert.equal((await wanted.mine._handler(f.ctx, {})).past.length, 1);
});

test("ZIP lookup supplies only a city and state label for the public area", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ places: [{ "place name": "Raleigh", "state abbreviation": "NC" }] }), { status: 200 });
    assert.equal(await wantedAreaForZip("27601"), "Raleigh, NC");
    await assert.rejects(wantedAreaForZip("2760"), /five-digit ZIP/);
    globalThis.fetch = async () => new Response(null, { status: 404 });
    await assert.rejects(wantedAreaForZip("99999"), /ZIP code not found/);
  } finally { globalThis.fetch = original; }
});
