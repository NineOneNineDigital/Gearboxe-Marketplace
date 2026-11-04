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
const vehicles = await import("../convex/vehicles.ts");
const notifications = await import("../convex/notifications.ts");
const messages = await import("../convex/messages.ts");
const conversations = await import("../convex/conversations.ts");
const { assertSubmitReady } = await import("../convex/lib/listingLifecycle.ts");

const complete = {
  title: "2022 Chevrolet Silverado", make: "Chevrolet", model: "Silverado 1500", year: 2022,
  vin: "3GCUDHEL3NG668790", mileage: 12000, price: 40000, trim: "ZR2", bodyStyle: "Truck", engine: "V8",
  transmission: "Automatic", drivetrain: "4WD", fuelType: "Gasoline", exteriorColor: "Blue", interiorColor: "Black",
  mileageUnit: "mi", odometerStatus: "actual", titleStatus: "clean", sellerState: "NC", condition: "good",
  mechanicalIssues: "None known", accidentDisclosure: "Unknown", damageDisclosure: "None known",
  serviceRecords: "partial", modifications: "None", sellerType: "private", location: { city: "Raleigh", state: "NC" },
  features: [], negotiable: true, description: "Well maintained vehicle with service records.", contactInfo: "Private contact", photos: [],
};
const incomplete = { title: "Work in progress", make: "", model: "", year: 2022, mileage: 0, price: 0, photos: [], description: "", contactInfo: "" };

function fixture() {
  let actor = "owner", sequence = 0;
  let tables = { users: ["owner", "buyer", "other"].map(id => ({ _id: id, externalId: `clerk-${id}`, role: "user", emailVerified: true, phoneVerified: true })), vehicles: [], vehicleMedia: [], _storage: [] };
  tables.users.push({ _id: "admin", externalId: "clerk-admin", role: "admin" });
  const clone = value => structuredClone(value);
  const get = async id => clone(Object.values(tables).flat().find(row => row._id === id) ?? null);
  const query = table => {
    const predicates = [];
    let direction;
    const q = {
      withIndex(_index, callback) {
        const builder = { eq(field, value) { predicates.push(row => row[field] === value); return builder; }, lt(field, value) { predicates.push(row => row[field] < value); return builder; } };
        callback(builder); return q;
      },
      order(value) { direction = value; return q; },
      collect: async () => {
        const rows = (tables[table] ?? []).filter(row => predicates.every(p => p(row)));
        if (direction === "desc") rows.reverse();
        return clone(rows);
      },
      first: async () => (await q.collect())[0] ?? null,
      unique: async () => { const rows = await q.collect(); assert.ok(rows.length <= 1); return rows[0] ?? null; },
      take: async count => (await q.collect()).slice(0, count),
      paginate: async ({ numItems, cursor }) => {
        const rows = await q.collect(), start = Number(cursor ?? 0), end = start + numItems;
        return { page: rows.slice(start, end), isDone: end >= rows.length, continueCursor: String(end) };
      },
    };
    return q;
  };
  const ctx = {
    scheduler: { runAfter: async () => "scheduled" },
    auth: { getUserIdentity: async () => actor ? { subject: `clerk-${actor}` } : null },
    db: {
      query, get, system: { get, query },
      insert: async (table, row) => { const id = `record-${++sequence}`; (tables[table] ??= []).push({ _id: id, ...clone(row) }); return id; },
      patch: async (id, fields) => { const row = Object.values(tables).flat().find(row => row._id === id); assert.ok(row); Object.assign(row, clone(fields)); },
      delete: async id => { for (const rows of Object.values(tables)) { const index = rows.findIndex(row => row._id === id); if (index >= 0) rows.splice(index, 1); } },
    },
    storage: { delete: async id => ctx.db.delete(id), getUrl: async id => await get(id) ? `https://test.convex.cloud/api/storage/${id}` : null },
  };
  const mutate = async (fn, args) => {
    // Convex mutations roll all writes back when validation throws.
    const snapshot = clone(tables);
    try { return await fn._handler(ctx, args); } catch (error) { tables = snapshot; throw error; }
  };
  const listing = (status = "draft", overrides = {}) => {
    const row = { _id: "vehicle", userId: "owner", ownershipAttestedAt: 1, status, createdAt: 1, updatedAt: 2, ...clone(complete), media: [{ id: "photo", caption: "Front" }], ...overrides };
    tables.vehicles.push(row);
    tables.vehicleMedia.push({ _id: "photo", userId: "owner", vehicleId: row._id, status: "ready", thumbnailId: "thumbnail", detailId: "detail", expiresAt: Number.MAX_SAFE_INTEGER });
    tables._storage.push({ _id: "thumbnail" }, { _id: "detail" });
    return row;
  };
  return { ctx, mutate, listing, as: value => { actor = value; }, rows: table => tables[table] ?? [], add: (table, row) => { (tables[table] ??= []).push(clone(row)); } };
}

test("incomplete drafts autosave once per request, reject stale revisions, and avoid notification spam", async () => {
  const f = fixture();
  const first = await f.mutate(vehicles.saveDraft, { ...incomplete, clientRequestId: "draft-request" });
  const retry = await f.mutate(vehicles.saveDraft, { ...incomplete, clientRequestId: "draft-request" });
  assert.equal(retry.id, first.id); assert.equal(retry.reused, true);
  assert.equal(f.rows("vehicles").length, 1);
  const saved = await f.mutate(vehicles.saveDraft, { ...incomplete, title: "Updated draft", id: first.id, expectedUpdatedAt: first.updatedAt });
  assert.ok(saved.updatedAt > first.updatedAt);
  await assert.rejects(f.mutate(vehicles.saveDraft, { ...incomplete, id: first.id, expectedUpdatedAt: first.updatedAt }), /another session/);
  await assert.rejects(f.mutate(vehicles.saveDraft, { ...incomplete, id: first.id }), /Reload/);
  assert.equal(f.rows("vehicles")[0].title, "Updated draft");
  assert.equal(f.rows("vehicleModerationLog").length, 1);
  assert.equal(f.rows("listingNotifications").length, 1);
  await assert.rejects(f.mutate(vehicles.submitVehicle, { id: first.id }), /required/);
});

test("rejected edits preserve moderation feedback until explicit resubmission", async () => {
  const f = fixture(); f.listing("pending"); f.as("admin");
  await f.mutate(vehicles.rejectVehicle, { id: "vehicle", reason: "Please replace the blurry exterior photo" });
  f.as("owner"); const rejected = f.rows("vehicles")[0];
  await f.mutate(vehicles.saveDraft, { ...complete, media: rejected.media, id: "vehicle", expectedUpdatedAt: rejected.updatedAt });
  assert.equal(f.rows("vehicles")[0].status, "rejected");
  assert.equal(f.rows("vehicles")[0].moderationReason, "Please replace the blurry exterior photo");
  assert.equal(f.rows("listingNotifications").length, 1);
  await f.mutate(vehicles.submitVehicle, { id: "vehicle", expectedUpdatedAt: f.rows("vehicles")[0].updatedAt });
  assert.equal(f.rows("vehicles")[0].status, "pending");
  assert.match(f.rows("vehicles")[0].moderationReason, /resubmitted/);
  assert.equal(f.rows("vehicleModerationLog").length, 2);
});

test("submission and approval require owned attached ready media and both durable variants", async () => {
  const cases = [
    f => { f.rows("vehicles")[0].media = []; },
    f => { f.rows("vehicles")[0].photos = ["https://images.unsplash.com/legacy"]; },
    f => { f.rows("vehicleMedia").splice(0); },
    f => { f.rows("vehicleMedia")[0].status = "processing"; },
    f => { f.rows("vehicleMedia")[0].userId = "other"; },
    f => { f.rows("vehicleMedia")[0].vehicleId = "other-vehicle"; },
    f => { delete f.rows("vehicleMedia")[0].thumbnailId; f.rows("vehicleMedia")[0].sourceId = "source-only"; },
    f => { f.rows("_storage").splice(0, 1); },
    f => { f.rows("_storage").splice(1, 1); },
  ];
  for (const corrupt of cases) {
    const f = fixture(); f.listing(); corrupt(f);
    await assert.rejects(f.mutate(vehicles.submitVehicle, { id: "vehicle" }), /photo|upload/i);
    assert.equal(f.rows("vehicles")[0].status, "draft");
    assert.equal(f.rows("listingNotifications").length, 0);
    f.rows("vehicles")[0].status = "pending"; f.as("admin");
    await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), /photo|upload/i);
    assert.equal(f.rows("vehicles")[0].status, "pending");
  }
  const f = fixture(); const ready = f.listing();
  await assertSubmitReady(f.ctx, ready);
  await f.mutate(vehicles.submitVehicle, { id: "vehicle" }); f.as("admin");
  await f.mutate(vehicles.approveVehicle, { id: "vehicle" });
  assert.equal(f.rows("vehicles")[0].status, "active");
});

test("active edits cannot enter review with a missing stored photo; failed writes roll back", async () => {
  const f = fixture(); f.listing("active"); f.rows("_storage").pop();
  await assert.rejects(f.mutate(vehicles.updateVehicle, { id: "vehicle", title: "Changed title", expectedUpdatedAt: 2 }), /stored listing photo/);
  assert.equal(f.rows("vehicles")[0].title, complete.title);
  assert.equal(f.rows("vehicles")[0].status, "active");
  assert.equal(f.rows("listingNotifications").length, 0);
});

test("new submissions fail atomically without permanent photos while draft ownership stays protected", async () => {
  const f = fixture();
  await assert.rejects(f.mutate(vehicles.createVehicle, { ...complete, status: "pending" }), /permanent photo/);
  assert.equal(f.rows("vehicles").length, 0);
  assert.equal(f.rows("vehicleModerationLog").length, 0);
  assert.equal(f.rows("listingNotifications").length, 0);
  const draft = await f.mutate(vehicles.saveDraft, { ...incomplete });
  f.as("buyer");
  await assert.rejects(f.mutate(vehicles.saveDraft, { ...incomplete, id: draft.id, expectedUpdatedAt: draft.updatedAt }), /not found/);
  await assert.rejects(f.mutate(vehicles.submitVehicle, { id: draft.id }), /not found/);
  assert.equal(f.rows("vehicles")[0].status, "draft");
});

test("duplicate VIN detection blocks submitted inventory, including case-insensitive legacy VINs", async () => {
  for (const status of ["pending", "active", "approved", "reserved"]) {
    for (const indexed of [true, false]) {
      const f = fixture(); f.listing();
      f.add("vehicles", { _id: "existing", status, vin: ` ${complete.vin.toLowerCase()} `, ...(indexed ? { vinKey: complete.vin } : {}) });
      assert.deepEqual(await vehicles.checkDuplicateVin._handler(f.ctx, { vin: complete.vin.toLowerCase(), excludeId: "vehicle" }), { duplicate: true });
      await assert.rejects(f.mutate(vehicles.submitVehicle, { id: "vehicle" }), /VIN already/);
    }
  }
  for (const status of ["draft", "rejected", "sold", "withdrawn", "archived"]) {
    const f = fixture(); f.listing(); f.add("vehicles", { _id: "old", status, vin: complete.vin, vinKey: complete.vin });
    await f.mutate(vehicles.submitVehicle, { id: "vehicle" });
  }
});

test("seller state transitions retain conversations and event registrations", async () => {
  const f = fixture(); f.listing("active");
  f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
  f.add("registrations", { _id: "registration", vehicleId: "vehicle", eventId: "event" });
  await f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "reserved" });
  await f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "active" });
  await f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "withdrawn" });
  assert.equal(f.rows("vehicles")[0].status, "withdrawn");
  assert.equal(f.rows("conversations").length, 1); assert.equal(f.rows("registrations").length, 1);
  await assert.rejects(f.mutate(vehicles.deleteVehicle, { id: "vehicle" }), /Withdraw/);
  const sold = fixture(); sold.listing("active");
  await sold.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "sold" });
  await assert.rejects(sold.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "active" }), /Invalid/);
});

test("even draft and rejected deletion protects any linked thread or registration", async () => {
  for (const status of ["draft", "rejected"]) {
    for (const table of ["conversations", "registrations"]) {
      const f = fixture(); f.listing(status); f.add(table, { _id: "linked", vehicleId: "vehicle" });
      await assert.rejects(f.mutate(vehicles.deleteVehicle, { id: "vehicle" }), /cannot be deleted/);
      assert.equal(f.rows("vehicles").length, 1); assert.equal(f.rows(table).length, 1);
      assert.equal(f.rows("_storage").length, 2);
    }
  }
});

test("moderation notifications persist only on successful transitions and remain seller-private", async () => {
  const f = fixture(); f.listing("pending");
  await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), /Administrator/);
  f.as("admin"); await assert.rejects(f.mutate(vehicles.rejectVehicle, { id: "vehicle", reason: "" }), /reason/);
  assert.equal(f.rows("listingNotifications").length, 0);
  await f.mutate(vehicles.rejectVehicle, { id: "vehicle", reason: "Missing detail photo" });
  const notification = f.rows("listingNotifications")[0];
  assert.equal(notification.userId, "owner"); assert.equal(notification.kind, "rejected");
  assert.match(notification.message, /Missing detail photo/);
  f.as("buyer"); assert.deepEqual((await notifications.legacyList._handler(f.ctx, {})), []);
  await assert.rejects(f.mutate(notifications.markRead, { id: notification._id }), /not found/);
  f.as("owner"); assert.equal((await notifications.legacyList._handler(f.ctx, {})).length, 1);
  await f.mutate(notifications.markRead, { id: notification._id });
  assert.ok(f.rows("listingNotifications")[0].readAt);
});

test("seller analytics deduplicate daily views, exclude owner/admin, and count inbound inquiries", async () => {
  const f = fixture(); f.listing("active");
  const visitorKey = "11111111-1111-4111-8111-111111111111";
  await f.mutate(vehicles.recordView, { id: "vehicle", visitorKey }); f.as("admin");
  await f.mutate(vehicles.recordView, { id: "vehicle", visitorKey });
  assert.equal(f.rows("listingViews").length, 0); f.as(null);
  await f.mutate(vehicles.recordView, { id: "vehicle", visitorKey });
  await f.mutate(vehicles.recordView, { id: "vehicle", visitorKey });
  assert.equal(f.rows("vehicles")[0].viewCount, 1);
  f.add("favorites", { _id: "favorite", vehicleId: "vehicle", userId: "buyer" });
  f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
  f.add("messages", { _id: "inbound", conversationId: "thread", senderId: "buyer", recipientId: "owner" });
  f.add("messages", { _id: "outbound", conversationId: "thread", senderId: "owner", recipientId: "buyer" });
  f.as("owner"); assert.deepEqual(await vehicles.getSellerAnalytics._handler(f.ctx, {}), [{ vehicleId: "vehicle", views: 1, favorites: 1, conversations: 1, inquiries: 1 }]);
  f.as("buyer"); assert.deepEqual(await vehicles.getSellerAnalytics._handler(f.ctx, {}), []);
  f.as(null); await assert.rejects(vehicles.getSellerAnalytics._handler(f.ctx, {}), /Authentication/);
});

test("existing participants can keep messaging after reservation, sale, and withdrawal without creating new threads", async () => {
  for (const status of ["reserved", "sold", "withdrawn"]) {
    const f = fixture(); f.listing(status);
    f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
    f.as("buyer");
    await f.mutate(messages.sendMessage, { recipientId: "owner", vehicleId: "vehicle", content: "Following up on our arrangement" });
    assert.equal(f.rows("messages")[0].conversationId, "thread");
    assert.equal(f.rows("conversations").length, 1);
    assert.equal(await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }), null);
    const participantContext = await conversations.getVehicleContext._handler(f.ctx, { vehicleId: "vehicle", otherUserId: "owner" });
    assert.equal(participantContext._id, "vehicle");
    assert.equal(participantContext.status, status);
    assert.equal(await f.mutate(conversations.getOrCreateConversation, { vehicleId: "vehicle", otherUserId: "owner" }), "thread");
    assert.equal((await messages.getMessagesByConversation._handler(f.ctx, { conversationId: "thread", paginationOpts: { numItems: 30, cursor: null } })).page.length, 1);
    f.as("other"); await assert.rejects(f.mutate(messages.sendMessage, { recipientId: "owner", vehicleId: "vehicle", content: "New inquiry" }), /new conversations/);
    await assert.rejects(f.mutate(conversations.getOrCreateConversation, { vehicleId: "vehicle", otherUserId: "owner" }), /new conversations/);
    assert.equal(await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }), null);
    f.as(null); assert.equal(await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }), null);
  }
});

test("conversation context cannot expose draft, pending, rejected or closed private specifications and new photos", async () => {
  for (const status of ["draft", "pending", "rejected", "reserved", "sold", "withdrawn", "archived"]) {
    const f = fixture(); f.listing(status, { moderationReason: "Private review reason", moderationHistory: [{ reason: "Private history" }], description: "New unpublished description" });
    f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
    f.as("buyer");
    assert.equal(await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }), null);
    const context = await conversations.getVehicleContext._handler(f.ctx, { vehicleId: "vehicle", otherUserId: "owner" });
    assert.deepEqual(Object.keys(context).sort(), ["_id", "title", "year", "make", "model", "mileage", "mileageUnit", "price", "status"].sort());
    for (const field of ["vin", "photos", "media", "contactInfo", "description", "mechanicalIssues", "damageDisclosure", "moderationReason", "moderationHistory"]) assert.equal(context[field], undefined);
    assert.equal(await conversations.getVehicleContext._handler(f.ctx, { vehicleId: "vehicle", otherUserId: "other" }), null);
    f.as("other"); assert.equal(await conversations.getVehicleContext._handler(f.ctx, { vehicleId: "vehicle", otherUserId: "owner" }), null);
    f.as(null); await assert.rejects(conversations.getVehicleContext._handler(f.ctx, { vehicleId: "vehicle", otherUserId: "owner" }), /Authentication/);
    f.as("owner"); assert.equal((await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" })).description, "New unpublished description");
  }
});


test("seller verification and vehicle ownership are required even for moderator approval", async () => {
  for (const field of ["emailVerified", "phoneVerified"]) {
    const f = fixture(); f.listing("pending"); f.rows("users")[0][field] = false; f.as("admin");
    await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), /Verify your email and phone/);
    assert.equal(f.rows("vehicles")[0].status, "pending");
  }
  const f = fixture(); f.listing("draft", { ownershipAttestedAt: undefined });
  await assert.rejects(f.mutate(vehicles.submitVehicle, { id: "vehicle" }), /own this vehicle/);
});

test("suspended senders and either direction of blocking prevent messages", async () => {
  const f = fixture(); f.listing("active"); f.as("buyer");
  const args = { recipientId: "owner", vehicleId: "vehicle", content: "Hello" };
  f.rows("users").find(row => row._id === "buyer").suspendedAt = 1;
  await assert.rejects(f.mutate(messages.sendMessage, args), /suspended/);
  f.rows("users").find(row => row._id === "buyer").suspendedAt = undefined;
  f.add("userBlocks", { _id: "block", userId: "owner", blockedUserId: "buyer" });
  await assert.rejects(f.mutate(messages.sendMessage, args), /unavailable between/);
  assert.equal(f.rows("messages").length, 0);
});

test("duplicate messages and server message quota are enforced", async () => {
  const f = fixture(); f.listing("active"); f.as("buyer");
  const args = { recipientId: "owner", vehicleId: "vehicle", content: "Hello" };
  await f.mutate(messages.sendMessage, args);
  await assert.rejects(f.mutate(messages.sendMessage, args), /same message/);
  for (let index = 1; index < 30; index++) {
    await f.mutate(messages.sendMessage, { ...args, content: `Question ${index}` });
    if (index === 21) await assert.rejects(f.mutate(messages.sendMessage, args), /same message/);
  }
  await assert.rejects(f.mutate(messages.sendMessage, { ...args, content: "Over quota" }), /Too many requests/);
  assert.equal(f.rows("messages").length, 30);
});


test("moderation removal requires appeal restoration and cannot be reset by seller status controls", async () => {
  const f = fixture(); f.listing("archived", { moderationRemovedAt: 1 });
  await assert.rejects(f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "draft" }), /removed by moderation/);
  assert.equal(f.rows("vehicles")[0].status, "archived");
});


test("message pagination caps pages at 50, returns newest first and keeps threads private", async () => {
  const f = fixture(); f.listing("active");
  f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
  f.add("conversations", { _id: "other-thread", vehicleId: "vehicle", participant1Id: "other", participant2Id: "owner" });
  for (let index = 0; index < 73; index++) f.add("messages", { _id: `m-${index}`, conversationId: "thread", senderId: "owner", recipientId: "buyer", content: `Message ${index}`, read: false, createdAt: index });
  f.add("messages", { _id: "private", conversationId: "other-thread", senderId: "other", recipientId: "owner", content: "Private", read: false });
  f.as("buyer");
  const first = await messages.getMessagesByConversation._handler(f.ctx, { conversationId: "thread", paginationOpts: { numItems: 1000, cursor: null } });
  assert.equal(first.page.length, 50); assert.equal(first.page[0]._id, "m-72"); assert.equal(first.page.at(-1)._id, "m-23"); assert.equal(first.isDone, false);
  const second = await messages.getMessagesByConversation._handler(f.ctx, { conversationId: "thread", paginationOpts: { numItems: 50, cursor: first.continueCursor } });
  assert.equal(second.page.length, 23); assert.equal(second.page[0]._id, "m-22"); assert.equal(second.isDone, true);
  assert.equal(new Set([...first.page, ...second.page].map(row => row._id)).size, 73);
  await assert.rejects(messages.getMessagesByConversation._handler(f.ctx, { conversationId: "other-thread", paginationOpts: { numItems: 30, cursor: null } }), /Conversation not found/);
  f.as(null); await assert.rejects(messages.getMessagesByConversation._handler(f.ctx, { conversationId: "thread", paginationOpts: { numItems: 30, cursor: null } }), /Authentication/);
});

test("message sender and conversation self participant come from authentication", async () => {
  const f = fixture(); f.listing("active"); f.as("buyer");
  const thread = await f.mutate(conversations.getOrCreateConversation, { vehicleId: "vehicle", otherUserId: "owner" });
  const messageId = await f.mutate(messages.sendMessage, { recipientId: "owner", vehicleId: "vehicle", content: "A private question" });
  assert.equal(f.rows("messages")[0].senderId, "buyer");
  assert.equal(f.rows("messages")[0].conversationId, thread);
  assert.equal((await conversations.getConversationsByUser._handler(f.ctx, {}))[0].otherUserId, "owner");
  const notification = f.rows("notifications").find(row => row.dedupeKey === `message:${messageId}`);
  assert.equal(notification.userId, "owner"); assert.equal(notification.conversationId, thread); assert.doesNotMatch(notification.message, /private question/);
  f.as("other"); assert.deepEqual(await conversations.getConversationsByUser._handler(f.ctx, {}), []);
});

test("marking loaded messages read is bounded and cannot mark another recipient or thread", async () => {
  const f = fixture();
  f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
  f.add("messages", { _id: "received", conversationId: "thread", senderId: "owner", recipientId: "buyer", read: false });
  f.add("messages", { _id: "sent", conversationId: "thread", senderId: "buyer", recipientId: "owner", read: false });
  f.add("messages", { _id: "other", conversationId: "other-thread", senderId: "owner", recipientId: "buyer", read: false });
  f.as("buyer");
  assert.equal(await f.mutate(messages.markConversationAsRead, { conversationId: "thread", messageIds: ["received", "received", "sent", "other"] }), 1);
  assert.equal(f.rows("messages").find(row => row._id === "sent").read, false);
  assert.equal(f.rows("messages").find(row => row._id === "other").read, false);
  await assert.rejects(f.mutate(messages.markConversationAsRead, { conversationId: "thread", messageIds: Array(51).fill("received") }), /at most 50/);
  f.as("other"); await assert.rejects(f.mutate(messages.markConversationAsRead, { conversationId: "thread", messageIds: ["received"] }), /Conversation not found/);
});

test("contact state disables composing for either block direction and suspension", async () => {
  for (const blockingUser of ["buyer", "owner"]) {
    const f = fixture(); f.as("buyer");
    f.add("userBlocks", { _id: "block", userId: blockingUser, blockedUserId: blockingUser === "buyer" ? "owner" : "buyer" });
    assert.deepEqual(await conversations.getContactState._handler(f.ctx, { otherUserId: "owner" }), { canContact: false });
  }
  const f = fixture(); f.as("buyer");
  assert.deepEqual(await conversations.getContactState._handler(f.ctx, { otherUserId: "owner" }), { canContact: true });
  f.rows("users").find(row => row._id === "buyer").suspendedAt = 1;
  assert.deepEqual(await conversations.getContactState._handler(f.ctx, { otherUserId: "owner" }), { canContact: false });
  f.rows("users").find(row => row._id === "buyer").suspendedAt = undefined;
  f.rows("users").find(row => row._id === "owner").suspendedAt = 1;
  assert.deepEqual(await conversations.getContactState._handler(f.ctx, { otherUserId: "owner" }), { canContact: false });
});
