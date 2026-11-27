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

const wanted = await import("../convex/wantedConversations.ts");
const wantedBoard = await import("../convex/wanted.ts");
const media = await import("../convex/wantedMedia.ts");
const mediaHttp = await import("../convex/wantedMediaHttp.ts");
const { RATE_LIMITS, rateWindow } = await import("../convex/lib/trustPolicy.ts");
const requestId = "request-1";
const reply = { requestId, year: 2019, make: "Honda", model: "Pilot", askingPrice: 25000, mileage: 72000, city: "Durham", state: "NC", message: "I have a clean Pilot available." };

function fixture() {
  let actor = "seller", seq = 0;
  let tables = {
    users: [
      { _id: "buyer", externalId: "clerk-buyer", name: "Private Buyer", email: "buyer@example.com" },
      { _id: "seller", externalId: "clerk-seller", name: "Seller", email: "seller@example.com" },
      { _id: "other", externalId: "clerk-other", name: "Other", email: "other@example.com" },
    ],
    wantedRequests: [{ _id: requestId, userId: "buyer", status: "active", expiresAt: Date.now() + 86400000, title: "Family SUV", maxBudget: 28000, zip: "27701", area: "Durham, NC", radiusMiles: 50, make: "Honda", model: "Pilot" }],
    wantedConversations: [], wantedMessages: [], wantedReplyPhotos: [], messages: [], trustRateLimits: [], userBlocks: [], notifications: [], emailOutbox: [], trustReports: [],
  };
  const clone = structuredClone;
  const query = table => {
    const tests = []; let descending = false;
    const index = {
      eq(field, value) { tests.push(row => row[field] === value); return index; },
      gt(field, value) { tests.push(row => row[field] > value); return index; },
    };
    const rows = () => { const result = (tables[table] ?? []).filter(row => tests.every(fn => fn(row))); return clone(descending ? [...result].reverse() : result); };
    const q = {
      withIndex(_name, filter) { filter(index); return q; }, order(value) { descending = value === "desc"; return q; },
      collect: async () => rows(), first: async () => rows()[0] ?? null,
      unique: async () => { const result = rows(); assert.ok(result.length <= 1); return result[0] ?? null; },
      take: async count => rows().slice(0, count),
      paginate: async ({ numItems, cursor }) => { const result = rows(); const start = Number(cursor ?? 0), end = start + numItems; return { page: result.slice(start, end), isDone: end >= result.length, continueCursor: String(end) }; },
    };
    return q;
  };
  const ctx = {
    auth: { getUserIdentity: async () => actor ? { subject: `clerk-${actor}` } : null },
    db: {
      get: async id => clone(Object.values(tables).flat().find(row => row._id === id) ?? null), query,
      insert: async (table, fields) => { const id = `row-${++seq}`; (tables[table] ??= []).push({ _id: id, ...clone(fields) }); return id; },
      patch: async (id, fields) => { const row = Object.values(tables).flat().find(item => item._id === id); assert.ok(row); Object.assign(row, clone(fields)); },
      delete: async id => { for (const rows of Object.values(tables)) { const index = rows.findIndex(item => item._id === id); if (index >= 0) rows.splice(index, 1); } },
    },
    scheduler: { runAfter: async () => {}, runAt: async () => {} },
  };
  const mutate = async (fn, args) => { const before = clone(tables); try { return await fn._handler(ctx, args); } catch (error) { tables = before; throw error; } };
  return { ctx, mutate, rows: table => tables[table], as: id => { actor = id; } };
}

test("seller replies without a listing and buyer identity stays private", async () => {
  const f = fixture();
  const conversationId = await f.mutate(wanted.replyToRequest, reply);
  assert.equal(f.rows("wantedConversations").length, 1);
  assert.equal(f.rows("wantedMessages").length, 1);
  const sellerThread = await wanted.getThread._handler(f.ctx, { conversationId });
  const sellerMessages = await wanted.listMessages._handler(f.ctx, { conversationId, paginationOpts: { numItems: 10, cursor: null } });
  assert.equal(sellerThread.otherUserName, "Buyer");
  assert.equal("buyerId" in sellerThread.conversation, false);
  assert.equal("zip" in sellerThread.conversation.requestSnapshot, false);
  assert.equal("senderId" in sellerMessages.page[0], false);
  f.as("buyer");
  const buyerThread = await wanted.getThread._handler(f.ctx, { conversationId });
  assert.equal(buyerThread.otherUserName, "Seller");
  f.as("other");
  await assert.rejects(wanted.getThread._handler(f.ctx, { conversationId }), /unavailable/);
  await assert.rejects(wanted.listMessages._handler(f.ctx, { conversationId, paginationOpts: { numItems: 10, cursor: null } }), /unavailable/);
});

test("seller reply rejects an invalid state before creating private history", async () => {
  const f = fixture();
  await assert.rejects(f.mutate(wanted.replyToRequest, { ...reply, state: "ZZ" }), /valid U\.S\. state or DC/);
  assert.equal(f.rows("wantedConversations").length, 0);
  assert.equal(f.rows("wantedMessages").length, 0);
  const conversationId = await f.mutate(wanted.replyToRequest, { ...reply, state: "dc" });
  assert.equal(f.rows("wantedConversations").find(row => row._id === conversationId)?.sellerVehicle.state, "DC");
});

test("closed request keeps participant history while shared duplicate and block controls apply", async () => {
  const f = fixture();
  const conversationId = await f.mutate(wanted.replyToRequest, reply);
  f.rows("wantedRequests")[0].status = "closed";
  await assert.rejects(f.mutate(wanted.send, { conversationId, content: reply.message }), /same message/);
  f.as("buyer");
  await f.mutate(wanted.send, { conversationId, content: "Can we discuss the vehicle?" });
  const history = await wanted.listMessages._handler(f.ctx, { conversationId, paginationOpts: { numItems: 10, cursor: null } });
  assert.equal(history.page.length, 2);
  assert.equal(history.page[0].isMine, true);
  await f.mutate(wanted.setBlock, { conversationId, blocked: true });
  f.as("seller");
  await assert.rejects(f.mutate(wanted.send, { conversationId, content: "Here are more details." }), /unavailable between these accounts/);
  assert.equal((await wanted.getThread._handler(f.ctx, { conversationId })).canContact, false);
});

test("deleting a wanted request removes it from boards but retains participant context", async () => {
  const f = fixture();
  const conversationId = await f.mutate(wanted.replyToRequest, reply);
  const original = (await wanted.getThread._handler(f.ctx, { conversationId })).conversation.requestSnapshot;
  f.as("buyer");
  await f.mutate(wantedBoard.remove, { id: requestId });
  assert.deepEqual((await wantedBoard.browse._handler(f.ctx, { paginationOpts: { numItems: 10, cursor: null } })).page, []);
  assert.deepEqual(await wantedBoard.mine._handler(f.ctx, {}), { current: [], past: [] });
  assert.deepEqual((await wanted.getThread._handler(f.ctx, { conversationId })).conversation.requestSnapshot, original);
  f.as("seller");
  assert.deepEqual((await wanted.getThread._handler(f.ctx, { conversationId })).conversation.requestSnapshot, original);
});

test("one seller cannot start duplicate threads or bypass listing-path duplicate detection", async () => {
  const f = fixture();
  f.rows("messages").push({ _id: "listing-message", senderId: "seller", content: reply.message, createdAt: Date.now() });
  await assert.rejects(f.mutate(wanted.replyToRequest, reply), /same message/);
  f.rows("messages").length = 0;
  await f.mutate(wanted.replyToRequest, reply);
  await assert.rejects(f.mutate(wanted.replyToRequest, { ...reply, message: "Another response" }), /existing conversation/);
  assert.equal(f.rows("wantedConversations").length, 1);
});

test("wanted replies consume the same account quotas as listing conversations", async () => {
  const f = fixture();
  f.rows("trustRateLimits").push({ _id: "listing-quota", userId: "seller", action: "conversation", windowStart: rateWindow(Date.now(), RATE_LIMITS.conversation.windowMs), count: RATE_LIMITS.conversation.count });
  await assert.rejects(f.mutate(wanted.replyToRequest, reply), /Too many requests/);
  assert.equal(f.rows("wantedConversations").length, 0);
  f.rows("trustRateLimits").length = 0;
  const conversationId = await f.mutate(wanted.replyToRequest, reply);
  f.rows("trustRateLimits").push({ _id: "listing-message-quota", userId: "seller", action: "message", windowStart: rateWindow(Date.now(), RATE_LIMITS.message.windowMs), count: RATE_LIMITS.message.count });
  // The fixture's first reply already created one message-rate row; replace it with a full shared window.
  f.rows("trustRateLimits").splice(f.rows("trustRateLimits").findIndex(row => row.action === "message" && row._id !== "listing-message-quota"), 1);
  await assert.rejects(f.mutate(wanted.send, { conversationId, content: "Another update" }), /Too many requests/);
});

test("private reply photos require a participant and stay available after request closure", async () => {
  const f = fixture();
  const conversationId = await f.mutate(wanted.replyToRequest, reply);
  const message = f.rows("wantedMessages")[0];
  message.photoIds = ["photo-1"];
  f.rows("wantedReplyPhotos").push({ _id: "photo-1", userId: "seller", requestId, conversationId, messageId: message._id, detailId: "storage-1", status: "ready" });
  f.rows("wantedRequests")[0].status = "closed";
  assert.equal(await media.authorizePhoto._handler(f.ctx, { photoId: "photo-1" }), "storage-1");
  f.as("buyer");
  assert.equal(await media.authorizePhoto._handler(f.ctx, { photoId: "photo-1" }), "storage-1");
  f.as("other");
  await assert.rejects(media.authorizePhoto._handler(f.ctx, { photoId: "photo-1" }), /unavailable/);
  await assert.rejects(media.attachPhotos(f.ctx, Array.from({ length: 11 }, (_, i) => `photo-${i}`), "other", requestId, conversationId), /at most 10/);
});

test("private photo downloads allow the authenticated browser preflight without exposing content", async () => {
  const previousOrigin = process.env.APP_URL;
  process.env.APP_URL = "https://market.example";
  try {
    const response = await mediaHttp.download._handler({}, new Request("https://test.convex.site/wanted-media/photo?id=photo-1", { method: "OPTIONS", headers: { Origin: "https://market.example", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" } }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://market.example");
    assert.match(response.headers.get("Access-Control-Allow-Headers"), /Authorization/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const foreign = await mediaHttp.download._handler({}, new Request("https://test.convex.site/wanted-media/photo?id=photo-1", { method: "OPTIONS", headers: { Origin: "https://foreign.example" } }));
    assert.equal(foreign.status, 404);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_URL; else process.env.APP_URL = previousOrigin;
  }
});

test("only buyer can pass and reopen; request renewal cannot revive a passed thread", async () => {
  const f = fixture();
  const conversationId = await f.mutate(wanted.replyToRequest, reply);
  await assert.rejects(f.mutate(wanted.dismiss, { conversationId }), /Only the buyer/);
  f.as("buyer");
  await f.mutate(wanted.dismiss, { conversationId });
  assert.ok(f.rows("wantedConversations")[0].dismissedAt);
  assert.equal(f.rows("notifications").at(-1).message, "The buyer passed on your wanted-request response.");
  assert.equal(f.rows("emailOutbox").at(-1).message.includes("rationale"), false);
  await f.mutate(wantedBoard.stillLooking, { id: requestId });
  f.as("seller");
  await assert.rejects(f.mutate(wanted.send, { conversationId, content: "Still available" }), /paused/);
  await assert.rejects(f.mutate(wanted.reopen, { conversationId }), /Only the buyer/);
  f.as("buyer");
  await assert.rejects(f.mutate(wanted.send, { conversationId, content: "I changed my mind" }), /paused/);
  await f.mutate(wanted.reopen, { conversationId });
  assert.equal(f.rows("wantedConversations")[0].dismissedAt, undefined);
  f.as("seller");
  await f.mutate(wanted.send, { conversationId, content: "Still available" });
  assert.equal(f.rows("wantedMessages").length, 2);
});

test("a stale seller composer cannot send after buyer passes, while another thread remains usable", async () => {
  const f = fixture();
  const firstId = await f.mutate(wanted.replyToRequest, reply);
  f.rows("wantedRequests").push({ ...structuredClone(f.rows("wantedRequests")[0]), _id: "request-2", title: "Compact car" });
  const secondId = await f.mutate(wanted.replyToRequest, { ...reply, requestId: "request-2", message: "I also have a compact car." });
  assert.equal((await wanted.getThread._handler(f.ctx, { conversationId: firstId })).canContact, true);
  f.as("buyer");
  await f.mutate(wanted.dismiss, { conversationId: firstId });
  f.as("seller");
  await assert.rejects(f.mutate(wanted.send, { conversationId: firstId, content: "Stale composer send" }), /paused/);
  await f.mutate(wanted.send, { conversationId: secondId, content: "The compact car is still available." });
  assert.equal(f.rows("wantedMessages").filter(row => row.conversationId === firstId).length, 1);
  assert.equal(f.rows("wantedMessages").filter(row => row.conversationId === secondId).length, 2);
});

test("deleting a participant leaves wanted history readable but permanently disables reopening", async () => {
  const f = fixture();
  const conversationId = await f.mutate(wanted.replyToRequest, reply);
  f.as("buyer");
  await f.mutate(wanted.dismiss, { conversationId });
  f.rows("users").find(row => row._id === "seller").deletedAt = Date.now();
  const thread = await wanted.getThread._handler(f.ctx, { conversationId });
  assert.equal(thread.otherUserName, "Deleted account");
  assert.equal(thread.canContact, false);
  assert.equal((await wanted.listMessages._handler(f.ctx, { conversationId, paginationOpts: { numItems: 10, cursor: null } })).page.length, 1);
  await assert.rejects(f.mutate(wanted.reopen, { conversationId }), /cannot receive messages/);
  await assert.rejects(f.mutate(wanted.send, { conversationId, content: "Can you still reply?" }), /paused/);
  assert.ok(f.rows("wantedConversations")[0].dismissedAt);
});
