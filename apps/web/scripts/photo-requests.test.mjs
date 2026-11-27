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

const requests = await import("../convex/photoRequests.ts");
const messages = await import("../convex/messages.ts");
const { RATE_LIMITS, rateWindow } = await import("../convex/lib/trustPolicy.ts");
const vehicleId = "vehicle-1";
const views = ["Front seats", "Engine bay", "Rear cargo area"];

function fixture() {
  let actor = "buyer", seq = 0;
  let tables = {
    users: [
      { _id: "buyer", externalId: "clerk-buyer", emailVerified: true, name: "Buyer", email: "buyer@example.com" },
      { _id: "other", externalId: "clerk-other", emailVerified: true, name: "Other", email: "other@example.com" },
      { _id: "third", externalId: "clerk-third", emailVerified: true, name: "Third", email: "third@example.com" },
      { _id: "unverified", externalId: "clerk-unverified", emailVerified: false, name: "Unverified" },
      { _id: "seller", externalId: "clerk-seller", emailVerified: true, name: "Seller", email: "seller@example.com" },
    ],
    vehicles: [{ _id: vehicleId, userId: "seller", status: "active", moderationRemovedAt: undefined }],
    conversations: [], photoRequestPairs: [], photoRequests: [], photoRequestEntries: [], messages: [], wantedMessages: [],
    userBlocks: [], trustRateLimits: [], offerCycles: [], offerThreads: [], notifications: [], emailOutbox: [],
  };
  const clone = structuredClone;
  const query = table => {
    const predicates = []; let descending = false;
    const builder = { eq(field, value) { predicates.push(row => row[field] === value); return builder; } };
    const rows = () => { const selected = (tables[table] ?? []).filter(row => predicates.every(fn => fn(row))); return clone(descending ? [...selected].reverse() : selected); };
    const q = {
      withIndex(_name, filter) { filter(builder); return q; }, order(direction) { descending = direction === "desc"; return q; },
      unique: async () => { const selected = rows(); assert.ok(selected.length <= 1); return selected[0] ?? null; },
      first: async () => rows()[0] ?? null, collect: async () => rows(), take: async count => rows().slice(0, count),
      paginate: async ({ numItems, cursor }) => { const selected = rows(); const from = Number(cursor ?? 0), to = from + numItems; return { page: selected.slice(from, to), isDone: to >= selected.length, continueCursor: String(to) }; },
    };
    return q;
  };
  const ctx = {
    auth: { getUserIdentity: async () => actor ? { subject: `clerk-${actor}` } : null },
    db: {
      query, get: async id => clone(Object.values(tables).flat().find(row => row._id === id) ?? null),
      insert: async (table, fields) => { const id = `row-${++seq}`; (tables[table] ??= []).push({ _id: id, ...clone(fields) }); return id; },
      patch: async (id, fields) => { const row = Object.values(tables).flat().find(item => item._id === id); assert.ok(row); Object.assign(row, clone(fields)); },
    },
    scheduler: { runAfter: async () => {} },
  };
  const mutate = async (fn, args) => { const before = clone(tables); try { return await fn._handler(ctx, args); } catch (error) { tables = before; throw error; } };
  return { ctx, mutate, rows: table => tables[table], as: who => { actor = who; } };
}

test("verified buyer opens one private multi-view request and follows up only after seller reply", async () => {
  const f = fixture();
  f.as("unverified"); await assert.rejects(f.mutate(requests.open, { vehicleId, views }), /Verify your email/);
  f.as("seller"); await assert.rejects(f.mutate(requests.open, { vehicleId, views }), /unavailable/);
  f.as("buyer");
  const { requestId, conversationId } = await f.mutate(requests.open, { vehicleId, views, note: "Please show wear on the seats" });
  assert.equal(f.rows("conversations").length, 1);
  assert.deepEqual(f.rows("photoRequests")[0].views, views);
  assert.equal(f.rows("photoRequestPairs")[0].openRequestId, requestId);
  await assert.rejects(f.mutate(requests.open, { vehicleId, views: ["Underbody"] }), /open photo request/);
  await assert.rejects(f.mutate(requests.followUp, { requestId, content: "Can you show the tires too?" }), /unavailable/);
  f.as("other"); assert.equal(await requests.getForConversation._handler(f.ctx, { conversationId }), null);
  await assert.rejects(requests.listHistory._handler(f.ctx, { conversationId, paginationOpts: { numItems: 10, cursor: null } }), /unavailable/);
  f.as("seller"); await f.mutate(requests.reply, { requestId, content: "I can send those photos." });
  f.as("buyer"); await f.mutate(requests.followUp, { requestId, content: "Can you show the tires too?" });
  assert.equal(f.rows("photoRequests")[0].status, "followup");
  const history = await requests.listHistory._handler(f.ctx, { conversationId, paginationOpts: { numItems: 10, cursor: null } });
  const entries = await requests.listEntries._handler(f.ctx, { requestId, paginationOpts: { numItems: 10, cursor: null } });
  assert.equal(history.page.length, 1);
  assert.deepEqual(entries.page.map(entry => entry.kind), ["followup", "reply", "request"]);
  assert.equal("email" in entries.page[0], false);
});

test("decline and durable disable are distinct; ordinary listing messages remain untouched", async () => {
  const f = fixture();
  const { requestId } = await f.mutate(requests.open, { vehicleId, views });
  f.as("seller");
  await f.mutate(requests.decline, { requestId });
  assert.equal(f.rows("photoRequests")[0].status, "declined");
  assert.equal(f.rows("photoRequestPairs")[0].disabledAt, undefined);
  f.as("buyer");
  const second = await f.mutate(requests.open, { vehicleId, views: ["Tire tread"] });
  f.as("seller"); await f.mutate(requests.setDisabled, { vehicleId, buyerId: "buyer", disabled: true });
  f.as("buyer");
  await assert.rejects(f.mutate(requests.open, { vehicleId, views: ["Rear seats"] }), /unavailable|open photo request/);
  f.as("seller"); await f.mutate(requests.reply, { requestId: second.requestId, content: "I can photograph those." });
  f.as("buyer"); await f.mutate(requests.followUp, { requestId: second.requestId, content: "Please also show the spare." });
  assert.equal(f.rows("photoRequests").find(row => row._id === second.requestId).status, "followup");
  f.as("seller"); await f.mutate(requests.decline, { requestId: second.requestId });
  f.as("buyer"); await assert.rejects(f.mutate(requests.open, { vehicleId, views: ["Rear seats"] }), /unavailable/);
  assert.equal(f.rows("conversations").length, 1);
  await f.mutate(messages.sendMessage, { recipientId: "seller", vehicleId, content: "Is the car still available?" });
  assert.equal(f.rows("messages").length, 1);
});

test("accepted buyer may request while reserved; manual reservation and other buyers may not", async () => {
  const f = fixture();
  const first = await f.mutate(requests.open, { vehicleId, views });
  f.rows("vehicles")[0].status = "reserved";
  f.as("seller"); await f.mutate(requests.reply, { requestId: first.requestId, content: "I have the photos." });
  f.as("buyer"); await assert.rejects(f.mutate(requests.followUp, { requestId: first.requestId, content: "Another view?" }), /unavailable/);
  await assert.rejects(f.mutate(requests.open, { vehicleId, views: ["Side profile"] }), /unavailable/);
  f.rows("offerCycles").push({ _id: "cycle-1", vehicleId, winner: "offer-1" });
  f.rows("offerThreads").push({ _id: "offer-1", vehicleId, buyerId: "buyer", status: "reserved" });
  await f.mutate(requests.followUp, { requestId: first.requestId, content: "Another view?" });
  f.as("other"); await assert.rejects(f.mutate(requests.open, { vehicleId, views }), /unavailable/);
  f.rows("vehicles")[0].status = "active";
  await f.mutate(requests.open, { vehicleId, views: ["Side profile"] });
  f.rows("vehicles")[0].status = "sold";
  await assert.rejects(f.mutate(requests.open, { vehicleId, views: ["Rear lights"] }), /unavailable/);
});

test("shared duplicate and account quotas apply across listing and photo-request paths", async () => {
  const f = fixture();
  f.rows("messages").push({ _id: "existing-message", senderId: "buyer", content: views.join("\n"), createdAt: Date.now() });
  await assert.rejects(f.mutate(requests.open, { vehicleId, views }), /same message/);
  f.rows("messages").length = 0;
  f.rows("trustRateLimits").push({ _id: "conversation-quota", userId: "buyer", action: "conversation", windowStart: rateWindow(Date.now(), RATE_LIMITS.conversation.windowMs), count: RATE_LIMITS.conversation.count });
  await assert.rejects(f.mutate(requests.open, { vehicleId, views }), /Too many requests/);
  assert.equal(f.rows("photoRequests").length, 0);
  f.rows("trustRateLimits").length = 0;
  f.rows("trustRateLimits").push({ _id: "message-quota", userId: "buyer", action: "message", windowStart: rateWindow(Date.now(), RATE_LIMITS.message.windowMs), count: RATE_LIMITS.message.count });
  await assert.rejects(f.mutate(requests.open, { vehicleId, views }), /Too many requests/);
  assert.equal(f.rows("photoRequests").length, 0);
});

test("eligibility distinguishes reservation modes and rejects blocked or suspended actors", async () => {
  const f = fixture();
  f.rows("vehicles")[0].status = "reserved";
  assert.match((await requests.getEligibility._handler(f.ctx, { vehicleId })).reason, /pause during this reservation/);
  f.rows("offerCycles").push({ _id: "cycle-1", vehicleId, winner: "offer-1" });
  f.rows("offerThreads").push({ _id: "offer-1", vehicleId, buyerId: "other", status: "reserved" });
  assert.match((await requests.getEligibility._handler(f.ctx, { vehicleId })).reason, /accepted buyer/);
  f.rows("offerThreads")[0].buyerId = "buyer";
  assert.equal((await requests.getEligibility._handler(f.ctx, { vehicleId })).canOpen, true);
  f.rows("userBlocks").push({ _id: "block-1", userId: "seller", blockedUserId: "buyer", createdAt: Date.now() });
  assert.equal((await requests.getEligibility._handler(f.ctx, { vehicleId })).reason, "Messaging unavailable");
  await assert.rejects(f.mutate(requests.open, { vehicleId, views }), /unavailable between these accounts/);
  f.rows("userBlocks").length = 0;
  f.rows("users").find(user => user._id === "buyer").suspendedAt = Date.now();
  await assert.rejects(f.mutate(requests.open, { vehicleId, views }), /suspended/);
});

test("closed and Sold requests retain private history but cannot be followed up", async () => {
  const f = fixture();
  const { requestId, conversationId } = await f.mutate(requests.open, { vehicleId, views });
  f.as("seller"); await f.mutate(requests.reply, { requestId, content: "Here is the requested view." });
  f.rows("vehicles")[0].status = "sold";
  f.as("buyer"); await assert.rejects(f.mutate(requests.followUp, { requestId, content: "Please add one more." }), /unavailable/);
  await f.mutate(requests.close, { requestId });
  assert.equal(f.rows("photoRequestPairs")[0].openRequestId, undefined);
  assert.equal((await requests.listHistory._handler(f.ctx, { conversationId, paginationOpts: { numItems: 10, cursor: null } })).page[0].status, "closed");
  assert.equal((await requests.listEntries._handler(f.ctx, { requestId, paginationOpts: { numItems: 10, cursor: null } })).page.length, 2);
  f.rows("vehicles")[0].status = "active";
  await f.mutate(requests.open, { vehicleId, views: ["Spare tire"] });
});

test("seller can preempt photo requests for an existing conversation without blocking ordinary messages", async () => {
  const f = fixture();
  f.rows("conversations").push({ _id: "conversation-1", vehicleId, participant1Id: "buyer", participant2Id: "seller", createdAt: Date.now(), lastMessageAt: Date.now() });
  f.as("seller");
  await f.mutate(requests.setDisabled, { vehicleId, buyerId: "buyer", disabled: true });
  assert.ok(f.rows("photoRequestPairs")[0].disabledAt);
  f.as("buyer");
  assert.equal((await requests.getEligibility._handler(f.ctx, { vehicleId })).disabled, true);
  await assert.rejects(f.mutate(requests.open, { vehicleId, views }), /unavailable/);
  assert.equal(f.rows("conversations").length, 1);
  f.as("seller");
  await f.mutate(requests.setDisabled, { vehicleId, buyerId: "buyer", disabled: false });
  f.as("buyer");
  await f.mutate(requests.open, { vehicleId, views });
});

test("seller deletion tombstone blocks a new request before listing cleanup finishes", async () => {
  const f = fixture();
  f.rows("users").find(user => user._id === "seller").deletedAt = Date.now();
  assert.equal((await requests.getEligibility._handler(f.ctx, { vehicleId })).canOpen, false);
  await assert.rejects(f.mutate(requests.open, { vehicleId, views }), /unavailable/);
  assert.equal(f.rows("photoRequests").length, 0);
});

test("buyer follow-up controls track live reservation, listing and contact eligibility", async () => {
  const f = fixture();
  const { requestId, conversationId } = await f.mutate(requests.open, { vehicleId, views });
  f.as("seller"); await f.mutate(requests.reply, { requestId, content: "I will send the requested views." });
  f.as("buyer");
  assert.equal((await requests.getForConversation._handler(f.ctx, { conversationId })).canFollowUp, true);
  f.rows("vehicles")[0].status = "reserved";
  assert.equal((await requests.getForConversation._handler(f.ctx, { conversationId })).canFollowUp, false);
  f.rows("offerCycles").push({ _id: "cycle-1", vehicleId, winner: "offer-1" });
  f.rows("offerThreads").push({ _id: "offer-1", vehicleId, buyerId: "buyer", status: "reserved" });
  assert.equal((await requests.getForConversation._handler(f.ctx, { conversationId })).canFollowUp, true);
  f.rows("userBlocks").push({ _id: "block-1", userId: "seller", blockedUserId: "buyer" });
  assert.equal((await requests.getForConversation._handler(f.ctx, { conversationId })).canFollowUp, false);
  f.rows("userBlocks").length = 0;
  f.rows("vehicles")[0].status = "sold";
  assert.equal((await requests.getForConversation._handler(f.ctx, { conversationId })).canFollowUp, false);
});

test("mismatched conversation recipient cannot open a photo request from that page", async () => {
  const f = fixture();
  const eligibility = await requests.getEligibility._handler(f.ctx, { vehicleId, expectedSellerId: "other" });
  assert.equal(eligibility.canOpen, false);
  assert.equal(eligibility.reason, "Listing unavailable");
  assert.equal((await requests.getEligibility._handler(f.ctx, { vehicleId, expectedSellerId: "seller" })).canOpen, true);
});

test("accepted buyer may open while Reserved, but another buyer cannot follow up on an existing request", async () => {
  const f = fixture();
  f.as("other");
  const otherRequest = await f.mutate(requests.open, { vehicleId, views: ["Front tire"] });
  f.rows("vehicles")[0].status = "reserved";
  f.rows("offerCycles").push({ _id: "cycle-1", vehicleId, winner: "offer-1" });
  f.rows("offerThreads").push({ _id: "offer-1", vehicleId, buyerId: "buyer", status: "reserved" });
  f.as("seller"); await f.mutate(requests.reply, { requestId: otherRequest.requestId, content: "Front tire photo is ready." });
  f.as("other"); await assert.rejects(f.mutate(requests.followUp, { requestId: otherRequest.requestId, content: "Please show the rear tire." }), /unavailable/);
  f.as("buyer");
  const winnerRequest = await f.mutate(requests.open, { vehicleId, views: ["Rear tire"] });
  assert.equal(f.rows("photoRequests").find(row => row._id === winnerRequest.requestId).status, "requested");
  f.as("seller"); await f.mutate(requests.decline, { requestId: otherRequest.requestId });
  await f.mutate(requests.decline, { requestId: winnerRequest.requestId });
  assert.equal(f.rows("photoRequestPairs").filter(row => row.openRequestId).length, 0);
});

test("manual reservation preserves seller replies and declines; reactivation starts only fresh requests", async () => {
  const f = fixture();
  const first = await f.mutate(requests.open, { vehicleId, views: ["Dashboard"] });
  f.rows("vehicles")[0].status = "reserved";
  f.as("seller"); await f.mutate(requests.reply, { requestId: first.requestId, content: "The dashboard view is ready." });
  f.as("buyer"); await assert.rejects(f.mutate(requests.followUp, { requestId: first.requestId, content: "A second angle please." }), /unavailable/);
  f.as("seller"); await f.mutate(requests.decline, { requestId: first.requestId });
  f.as("buyer"); await assert.rejects(f.mutate(requests.open, { vehicleId, views: ["Second angle"] }), /unavailable/);
  f.rows("vehicles")[0].status = "active";
  await assert.rejects(f.mutate(requests.followUp, { requestId: first.requestId, content: "A second angle please." }), /unavailable/);
  const second = await f.mutate(requests.open, { vehicleId, views: ["Second angle"] });
  assert.notEqual(second.requestId, first.requestId);
});

test("stale buyer controls cannot open or follow up after a reservation transition", async () => {
  for (const reservation of ["manual", "accepted for another buyer"]) {
    const f = fixture();
    const { requestId, conversationId } = await f.mutate(requests.open, { vehicleId, views: ["Front seats"] });
    f.as("seller");
    await f.mutate(requests.reply, { requestId, content: "Front seat photo is ready." });
    f.as("third");
    assert.equal((await requests.getEligibility._handler(f.ctx, { vehicleId })).canOpen, true);
    f.as("buyer");
    assert.equal((await requests.getForConversation._handler(f.ctx, { conversationId })).canFollowUp, true);
    assert.equal((await requests.getEligibility._handler(f.ctx, { vehicleId })).openRequestId, requestId);

    f.rows("vehicles")[0].status = "reserved";
    if (reservation === "accepted for another buyer") {
      f.rows("offerCycles").push({ _id: "cycle-1", vehicleId, winner: "offer-1" });
      f.rows("offerThreads").push({ _id: "offer-1", vehicleId, buyerId: "other", status: "reserved" });
    }
    const entryCount = f.rows("photoRequestEntries").length;
    await assert.rejects(f.mutate(requests.followUp, { requestId, content: "Please show another angle." }), /unavailable/);
    assert.equal(f.rows("photoRequestEntries").length, entryCount);
    assert.equal(f.rows("photoRequests")[0].status, "replied");

    f.as("third");
    await assert.rejects(f.mutate(requests.open, { vehicleId, views: ["Rear seats"] }), /unavailable/);
    assert.equal(f.rows("photoRequests").length, 1);

    f.as("other");
    if (reservation === "manual") {
      assert.equal((await requests.getEligibility._handler(f.ctx, { vehicleId })).canOpen, false);
      await assert.rejects(f.mutate(requests.open, { vehicleId, views: ["Rear seats"] }), /unavailable/);
    } else {
      assert.equal((await requests.getEligibility._handler(f.ctx, { vehicleId })).canOpen, true);
    }
    assert.equal(f.rows("photoRequests").length, 1);
  }
});

test("withdrawn and availability-expired listings deny new requests and follow-ups", async () => {
  for (const unavailableState of ["withdrawn", "expired"]) {
    const f = fixture();
    const { requestId } = await f.mutate(requests.open, { vehicleId, views: ["Rear seat"] });
    f.as("seller"); await f.mutate(requests.reply, { requestId, content: "Here is the rear seat." });
    f.as("buyer");
    if (unavailableState === "withdrawn") f.rows("vehicles")[0].status = "withdrawn";
    else f.rows("vehicles")[0].availabilityDueAt = Date.now() - 1;
    await assert.rejects(f.mutate(requests.followUp, { requestId, content: "Show the other seat." }), /unavailable/);
    await assert.rejects(f.mutate(requests.open, { vehicleId, views: ["Other seat"] }), /unavailable/);
  }
});
