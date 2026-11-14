import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    for (const suffix of [".ts", ".js"]) {
      const candidate = new URL(specifier + suffix, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
} });
const offers = await import("../convex/offers.ts");
const { onOfferListingTransition } = await import("../convex/lib/offerListing.ts");
const { effectiveClosure, priceInCents, purgeDeadline, REVIEW_MS, RESPONSE_MS } = await import("../convex/lib/offerPolicy.ts");
const { publicVehicle } = await import("../convex/lib/vehicleVisibility.ts");

function fixture(t) {
  let time = Date.UTC(2026, 0, 31, 15, 23), actor = "buyer", serial = 0;
  t.mock.method(Date, "now", () => time);
  const env = process.env.OFFERS_ENABLED, roster = process.env.OFFER_REVIEWER_USER_IDS;
  process.env.OFFERS_ENABLED = "true";
  process.env.OFFER_REVIEWER_USER_IDS = "admin";
  t.after(() => {
    if (env === undefined) delete process.env.OFFERS_ENABLED; else process.env.OFFERS_ENABLED = env;
    if (roster === undefined) delete process.env.OFFER_REVIEWER_USER_IDS; else process.env.OFFER_REVIEWER_USER_IDS = roster;
  });
  let tables = { users: ["buyer", "seller", "other", "admin"].map(id => ({
    _id: id, externalId: id, emailVerified: true, phoneVerified: id === "seller", role: id === "admin" ? "admin" : "user",
  })), vehicles: [{ _id: "vehicle", userId: "seller", status: "active", price: 10000, title: "Test", make: "Ford", model: "Focus", mileage: 10, year: 2010, createdAt: time }] };
  const rows = table => tables[table] ??= [];
  const get = id => Object.values(tables).flat().find(row => row._id === id);
  const clone = structuredClone;
  const query = table => {
    const filters = []; let descending = false;
    const matches = () => {
      const list = rows(table).filter(row => filters.every(fn => fn(row)));
      return clone(descending ? list.reverse() : list);
    };
    const builder = {
      eq(k, v) { filters.push(row => row[k] === v); return builder; },
      gt(k, v) { filters.push(row => row[k] !== undefined && (v === undefined || row[k] > v)); return builder; },
      lte(k, v) { filters.push(row => row[k] === undefined || row[k] <= v); return builder; },
    };
    const q = {
      withIndex(_name, fn) { fn?.(builder); return q; }, order(dir) { descending = dir === "desc"; return q; },
      unique() { const result = matches(); assert.ok(result.length <= 1); return result[0] ?? null; },
      first() { return matches()[0] ?? null; }, take(n) { return matches().slice(0, n); },
      paginate({ numItems, cursor }) {
        const list = matches(), offset = Number(cursor ?? 0);
        return { page: list.slice(offset, offset + numItems), isDone: offset + numItems >= list.length, continueCursor: String(offset + numItems) };
      },
    };
    return q;
  };
  const jobs = [];
  const ctx = {
    auth: { getUserIdentity: () => actor ? { subject: actor } : null },
    scheduler: { runAt: async (at, _, args) => jobs.push({ at, args }), runAfter: async () => {} },
    db: { query, get: async id => clone(get(id) ?? null), normalizeId: (table, id) => rows(table).some(row => row._id === id) ? id : null,
      insert: async (table, data) => { const _id = table + ++serial; rows(table).push({ _id, ...clone(data) }); return _id; },
      patch: async (id, patch) => Object.assign(get(id), clone(patch)),
      delete: async id => { for (const [name, list] of Object.entries(tables)) tables[name] = list.filter(row => row._id !== id); },
    },
  };
  const call = async (fn, args = {}) => {
    const old = clone(tables);
    try { return await fn._handler(ctx, args); } catch (e) { tables = old; throw e; }
  };
  const submit = (requestId = "a", dollars = 9888) => call(offers.submit, { vehicleId: "vehicle", dollars, requestId });
  return { ctx, call, submit, rows, get, as: id => { actor = id; }, time: () => time, at: n => { time = n; } };
}
const page = { numItems: 20, cursor: null };

test("whole dollars, exact expiry, and six UTC calendar months including leap years", () => {
  assert.equal(priceInCents(1), 100); assert.equal(priceInCents(100_000_000), 10_000_000_000);
  for (const amount of [0, -1, 1.2, Infinity, NaN, 100_000_001]) assert.throws(() => priceInCents(amount));
  assert.equal(purgeDeadline(Date.UTC(2023, 7, 31, 13)), Date.UTC(2024, 1, 29, 13));
  assert.equal(purgeDeadline(Date.UTC(2024, 7, 31, 13)), Date.UTC(2025, 1, 28, 13));
  assert.equal(effectiveClosure(100, undefined, 99), null);
  assert.deepEqual(effectiveClosure(100, 151, 151), { status: "expired", at: 100 });
  assert.deepEqual(effectiveClosure(100, 99, 101), { status: "listing_closed", at: 99 });
});

test("rollout, private access, account verification, blocks and listing availability are enforced server-side", async t => {
  const f = fixture(t);
  delete process.env.OFFERS_ENABLED;
  await assert.rejects(f.submit(), /currently unavailable/);
  process.env.OFFERS_ENABLED = "true";
  f.as(null); await assert.rejects(f.submit(), /Authentication/);
  f.as("seller"); await assert.rejects(f.submit(), /does not accept/);
  f.as("buyer"); f.get("buyer").emailVerified = false; await assert.rejects(f.submit(), /Verify/);
  f.get("buyer").emailVerified = true; f.get("seller").suspendedAt = f.time(); await assert.rejects(f.submit(), /cannot receive/);
  delete f.get("seller").suspendedAt;
  f.rows("userBlocks").push({ userId: "seller", blockedUserId: "buyer" }); await assert.rejects(f.submit(), /unavailable/);
  f.rows("userBlocks").pop();
  f.get("vehicle").availabilityDueAt = f.time(); await assert.rejects(f.submit(), /does not accept/);
  delete f.get("vehicle").availabilityDueAt;
  const id = await f.submit();
  assert.equal(await f.submit(), id);
  await assert.rejects(f.submit("a", 1), /changed/); await assert.rejects(f.submit("b"), /unanswered/);
  f.as("other"); assert.equal(await f.call(offers.get, { threadId: id }), null);
  await assert.rejects(f.call(offers.history, { threadId: id, paginationOpts: page }), /unavailable/);
  await assert.rejects(f.call(offers.respond, { threadId: id, version: 1, action: "accept" }), /unavailable/);
  f.as("admin"); assert.equal(await f.call(offers.get, { threadId: id }), null);
  await assert.rejects(f.call(offers.inspectForSupport, { threadId: id, reason: "", paginationOpts: page }), /reason/);
  assert.equal((await f.call(offers.inspectForSupport, {threadId: id, reason: "Case under review", paginationOpts: page})).actions.page.length, 1);
  assert.equal(f.rows("offerSupportAccess").length, 1);
  f.as("buyer"); assert.deepEqual((await f.call(offers.get, { threadId: id })).allowedActions, ["withdraw"]);
  assert.equal(await f.call(offers.get, { threadId: "invalid" }), null);
  delete process.env.OFFERS_ENABLED;
  assert.deepEqual((await f.call(offers.get, { threadId: id })).allowedActions, []);
  await assert.rejects(f.call(offers.respond, { threadId: id, version: 1, action: "withdraw" }), /currently unavailable/);
});

test("counter versions, single acceptance, competing proposals, review/cancel/close and notices", async t => {
  const f = fixture(t), id = await f.submit();
  f.as("other"); const competitor = await f.submit("second", 8111);
  f.as("seller"); const start = f.time();
  f.at(start + RESPONSE_MS - 1);
  await f.call(offers.respond, { threadId: id, version: 1, action: "counter", dollars: 9999 });
  f.as("buyer");
  await assert.rejects(f.call(offers.respond, { threadId: id, version: 1, action: "accept" }), /changed/);
  assert.equal(f.get(id).expiresAt, f.time() + RESPONSE_MS);
  await f.call(offers.respond, { threadId: id, version: 2, action: "accept" });
  assert.equal(f.get("vehicle").status, "reserved");
  assert.equal(f.get(id).acceptedAt, f.time());
  assert.equal(f.get(id).proposalVersion, 2);
  assert.equal(JSON.stringify(publicVehicle(f.get("vehicle"))).includes("999900"), false);
  f.as("seller");
  assert.deepEqual((await f.call(offers.get, {threadId: competitor})).allowedActions, []);
  assert.equal((await f.call(offers.get, {threadId: competitor})).competingReservation, true);
  await assert.rejects(f.call(offers.respond, { threadId: competitor, version: 1, action: "accept" }), /no longer/);
  await assert.rejects(onOfferListingTransition(f.ctx, f.get("vehicle"), "active"), /Finish/);
  await assert.rejects(f.call(offers.renew, { threadId: id, version: 3 }), /changed/);
  const due = f.get(id).checkAt;
  assert.equal(due, f.time() + REVIEW_MS);
  f.at(due); await f.call(offers.checkReview, { threadId: id, checkAt: due });
  await f.call(offers.checkReview, { threadId: id, checkAt: due });
  assert.equal(f.rows("notifications").filter(n => n.kind === "offer_review_alert").length, 1);
  f.as("buyer"); await assert.rejects(f.call(offers.reviewQueue, { paginationOpts: page }), /Administrator access required/);
  f.as("admin");
  const reviewQueue = await f.call(offers.reviewQueue, { paginationOpts: page });
  assert.deepEqual(reviewQueue.page, [{ threadId: id, vehicleId: "vehicle", status: "reserved", dueAt: due }]);
  f.as("seller");
  await f.call(offers.renew, { threadId: id, version: 4 });
  assert.equal(f.get(id).needsReview, undefined);
  f.at(f.get(id).checkAt); await assert.rejects(f.call(offers.renew, { threadId: id, version: 5 }), /unavailable/);
  f.as("admin"); await f.call(offers.extendForSupport, { threadId: id, version: 5, reason: "Seller requested more time" });
  f.as("buyer"); await f.call(offers.cancel, {threadId: id, version: 6, reason: "Ending agreement"});
  assert.equal(f.get("vehicle").status, "reserved"); assert.equal(f.get(id).closedAt, undefined);
  await assert.rejects(f.call(offers.finish, {threadId: id, version: 7, outcome: "sold", reason: "Ended"}), /unavailable/);
  f.as("seller"); await f.call(offers.finish, {threadId: id, version: 7, outcome: "sold", reason: "Sale completed"});
  assert.equal(f.get("vehicle").status, "sold");
  await f.call(offers.sweep);
  assert.equal(f.get(competitor).closedAt, start + RESPONSE_MS);
  assert.equal(f.get(id).purgeAt, purgeDeadline(f.time()));
  const email = JSON.stringify(f.rows("emailOutbox").map(({ subject, message, path }) => ({subject,message,path})));
  assert.equal(/9888|9999|Ending agreement|buyer|seller/.test(email), false);
});

test("old and competing proposals never revive, expiry is authoritative, and a fresh thread has its own retention date", async t => {
  const f = fixture(t), id = await f.submit(), expiry = f.get(id).expiresAt;
  f.at(expiry); f.as("seller");
  assert.equal((await f.call(offers.get, { threadId: id })).status, "expired");
  await assert.rejects(f.call(offers.respond, {threadId:id, version:1, action:"accept"}), /expired/);
  f.as("buyer"); const fresh = await f.submit("fresh", 9000);
  assert.notEqual(id, fresh); assert.equal(f.get(id).closedAt, expiry);
  const closed = f.time() + 1;
  f.at(closed);
  await onOfferListingTransition(f.ctx, f.get("vehicle"), "pending");
  f.get("vehicle").status = "active";
  assert.equal((await f.call(offers.get, {threadId:fresh})).status, "listing_closed");
  const next = await f.submit("third", 9200);
  await f.call(offers.sweep);
  assert.equal(f.get(fresh).closedAt, closed);
  f.at(purgeDeadline(expiry));
  assert.equal(await f.call(offers.get, {threadId: id}), null);
  await f.call(offers.sweep);
  assert.equal(f.get(id), undefined);
  assert.ok(f.get(fresh)); assert.ok(f.get(next));
  for (const table of ["offerActions", "offerSupportAccess", "offerNoticeRefs"])
    assert.equal(f.rows(table).some(row => row.threadId === id), false);
  assert.equal(f.rows("notifications").some(row => row.link.endsWith("=" + id)), false);
});

test("withdrawal/decline enforce the sender/recipient and repeated proposals hit the independent account limit", async t => {
  const f = fixture(t);
  for (let i = 0; i < 20; i++) {
    f.as("buyer"); const threadId = await f.submit("r" + i);
    await assert.rejects(f.call(offers.respond, {threadId, version:1, action:"decline"}), /unavailable/);
    if (i % 2) f.as("seller");
    await f.call(offers.respond, {threadId, version:1, action: i % 2 ? "decline" : "withdraw"});
    await assert.rejects(f.call(offers.respond, {threadId, version:1, action:"accept"}), /changed/);
  }
  f.as("buyer");
  await assert.rejects(f.submit("limited"), /Try again in/);
  f.at(f.time() + 10 * 60 * 1000); assert.ok(await f.submit("after-window"));
});

test("release keeps a legacy approval valid, resets 45 days and invalidates every prior proposal immediately", async t => {
  const f = fixture(t);
  f.get("vehicle").status = "approved";
  const winner = await f.submit("winner");
  f.as("other"); const competitor = await f.submit("competing");
  f.as("seller"); await f.call(offers.respond, {threadId:winner, version:1, action:"accept"});
  assert.equal(f.get("vehicle").availabilityDueAt, undefined);
  f.get("vehicle").moderationRemovedAt = f.time();
  await assert.rejects(f.call(offers.finish, {threadId:winner, version:2, outcome:"available", reason:"Available again"}), /changed/);
  delete f.get("vehicle").moderationRemovedAt;
  f.get("seller").suspendedAt = f.time(); f.as("admin");
  await assert.rejects(f.call(offers.finish, {threadId:winner, version:2, outcome:"available", reason:"Confirm availability"}), /suspended/);
  delete f.get("seller").suspendedAt;
  const oldCheck = f.get(winner).checkAt;
  f.as("seller"); f.at(f.time() + 30_000);
  await f.call(offers.finish, {threadId:winner, version:2, outcome:"available", reason:"Available again"});
  assert.equal(f.get("vehicle").availabilityDueAt, f.time() + 45 * 86_400_000);
  assert.equal((await f.call(offers.get, {threadId: competitor})).status, "listing_closed");
  await f.call(offers.checkReview, {threadId:winner, checkAt:oldCheck});
  await assert.rejects(f.call(offers.respond, {threadId:competitor, version:1, action:"accept"}), /no longer/);
  f.as("other"); const fresh = await f.submit("fresh");
  assert.notEqual(f.get(fresh).cycleId, f.get(competitor).cycleId);
});

test("purge hides a closed thread at the deadline and resumes long histories without touching another conversation", async t => {
  const f = fixture(t), id = await f.submit();
  for (let version = 1; version <= 55; version++) {
    f.as(version % 2 ? "seller" : "buyer");
    await f.call(offers.respond, { threadId: id, version, action: "counter", dollars: 7000 + version });
    f.at(f.time() + 10 * 60_000);
  }
  f.as("buyer");
  await f.call(offers.respond, { threadId: id, version: 56, action: "decline" });
  f.as("admin"); await f.call(offers.inspectForSupport, {threadId:id, paginationOpts:page, reason:"Review case"});
  f.at(f.get(id).purgeAt); await f.call(offers.sweep);
  assert.ok(f.get(id));
  await assert.rejects(f.call(offers.inspectForSupport, {threadId:id, paginationOpts:page, reason:"Review case"}), /unavailable/);
  await f.call(offers.sweep);
  assert.equal(f.get(id), undefined);
  for (const table of ["offerActions", "offerSupportAccess", "offerNoticeRefs", "notifications", "emailOutbox"])
    assert.equal(f.rows(table).length, 0, table);
  assert.equal(f.rows("conversations").length, 1);
});

test("independent acceptance transactions both read and write the same listing and generation, and a conflicting retry loses", async t => {
  const f = fixture(t);
  const first = await f.submit(); f.as("other"); const second = await f.submit("second");
  f.as("seller");
  // Snapshot each candidate's speculative writes before either transaction is committed.
  // The retry below exercises the handler against the winning commit. Staging verifies Convex OCC itself.
  const traces = [];
  for (const id of [first, second]) {
    const snapshot = new Map(), reads = new Set(), writes = new Set();
    const index = f.ctx.db;
    const ctx = {...f.ctx, db: {...index,
      async get(key) { reads.add(key); return snapshot.has(key) ? structuredClone(snapshot.get(key)) : index.get(key); },
      async patch(key, data) { writes.add(key); snapshot.set(key, {...await this.get(key), ...data}); },
      async insert(table, data) { const key = "local-" + table + snapshot.size; snapshot.set(key, { _id:key, ...data }); return key; },
      async delete(key) { snapshot.set(key, null); },
    }};
    await offers.respond._handler(ctx, {threadId:id, version:1, action:"accept"});
    traces.push({reads,writes});
  }
  for (const shared of ["vehicle", f.get(first).cycleId]) {
    assert.ok(traces.every(trace => trace.reads.has(shared) && trace.writes.has(shared)));
  }
  await f.call(offers.respond, {threadId:first, version:1, action:"accept"});
  await assert.rejects(f.call(offers.respond, {threadId:second, version:1, action:"accept"}), /no longer/);
  assert.equal(f.rows("offerThreads").filter(thread => thread.status === "reserved").length, 1);
});

test("late moderation preserves the earlier effective availability deadline and its deletion date", async t => {
  const f = fixture(t), end = f.time() + 5000;
  f.get("vehicle").availabilityDueAt = end;
  const id = await f.submit();
  f.at(end + 1);
  const before = await f.call(offers.get, { threadId: id });
  assert.equal(before.closedAt, end);
  await onOfferListingTransition(f.ctx, f.get("vehicle"), "archived", {moderation:true});
  f.get("vehicle").status = "archived";
  await f.call(offers.sweep);
  assert.equal(f.get(id).closedAt, end);
  assert.equal(f.get(id).purgeAt, purgeDeadline(end));
});

test("offer engagement counts first inquiry and seller counter/accept once without recording price or decline", async t => {
  const f = fixture(t), first = await f.submit("first", 8321);
  f.as("seller"); await f.call(offers.respond, {threadId:first, version:1, action:"decline"});
  assert.equal(f.rows("engagementPairs").length, 1);
  assert.equal(f.rows("engagementPairs")[0].respondedAt, undefined);
  const firstAt = f.time();
  f.at(firstAt + 100); f.as("buyer"); const second = await f.submit("second", 8399);
  f.as("seller"); const answeredAt = f.time();
  await f.call(offers.respond, {threadId:second, version:1, action:"counter", dollars:8990});
  f.at(answeredAt + 50); f.as("buyer"); await f.call(offers.respond, {threadId:second, version:2, action:"accept"});
  const [row] = f.rows("engagementPairs");
  assert.equal(f.rows("engagementPairs").length, 1);
  assert.equal(row.firstAt, firstAt); assert.equal(row.respondedAt, answeredAt);
  assert.equal(row.firstSource, "offer"); assert.equal(row.kind, "active");
  assert.equal("priceCents" in row || "dollars" in row || "body" in row, false);
});

test("listing-wide throttling applies across accounts and to counters without superseding a blocked write", async t => {
  const f = fixture(t);
  const id = await f.submit();
  const bucket = f.rows("offerRateLimits").find(row => row.key === "listing:vehicle");
  bucket.count = 100;
  f.as("other"); await assert.rejects(f.submit("another"), /Try again in/);
  f.as("seller"); await assert.rejects(f.call(offers.respond, { threadId:id, version:1, action:"counter", dollars:4000 }), /Try again in/);
  assert.equal(f.get(id).version, 1);
  assert.equal(f.get(id).priceCents, 988800);
  f.at(bucket.resetsAt);
  await f.call(offers.respond, { threadId:id, version:1, action:"counter", dollars:4000 });
  for (const status of ["reserved", "sold", "archived", "withdrawn", "pending", "rejected", "draft"]) {
    f.get("vehicle").status = status;
    f.as("other"); await assert.rejects(f.submit("closed-" + status), /does not accept/);
    f.as("buyer"); await assert.rejects(f.call(offers.respond, {threadId:id, version:2, action:"accept"}), /no longer/);
  }
});
