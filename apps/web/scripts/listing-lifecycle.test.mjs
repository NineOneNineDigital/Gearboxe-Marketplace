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
  lienStatus: "none", vehicleCategory: "truck", mechanicalIssues: "None known", accidentDisclosure: "Unknown", damageDisclosure: "None known",
  serviceRecords: "partial", modifications: "None", sellerType: "private", location: { city: "Raleigh", state: "NC", postalCode: "27601", latitude: 35.78, longitude: -78.64 },
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
        const builder = { eq(field, value) { predicates.push(row => row[field] === value); return builder; }, lt(field, value) { predicates.push(row => row[field] < value); return builder; }, lte(field, value) { predicates.push(row => row[field] !== undefined && row[field] <= value); return builder; } };
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
    scheduler: { runAfter: async () => "scheduled", runAt: async () => "scheduled" },
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
    const row = { _id: "vehicle", userId: "owner", ownershipAttestedAt: 1, ownershipRole: "owner", status, createdAt: 1, updatedAt: 2, ...clone(complete), media: ["front", "rear", "left side", "right side", "interior"].map((view, index) => ({ id: `photo-${index}`, caption: "", view })), ...overrides };
    tables.vehicles.push(row);
    for (let index = 0; index < 5; index++) {
      tables.vehicleMedia.push({ _id: `photo-${index}`, userId: "owner", vehicleId: row._id, status: "ready", thumbnailId: `thumbnail-${index}`, detailId: `detail-${index}`, expiresAt: Number.MAX_SAFE_INTEGER });
      tables._storage.push({ _id: `thumbnail-${index}` }, { _id: `detail-${index}` });
    }
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

test("five distinct photos and each labeled view are required at submission and re-review", async () => {
  const f = fixture(); f.listing();
  const vehicle = f.rows("vehicles")[0];
  const removed = vehicle.media.pop();
  await assert.rejects(f.mutate(vehicles.submitVehicle, { id: "vehicle" }), /five distinct ready permanent photos.*interior/i);
  assert.equal(vehicle.status, "draft");
  // Fetch after rollback, since the fixture replaces its table snapshot.
  f.rows("vehicles")[0].media.push(removed);
  f.rows("vehicles")[0].media[4].view = "front";
  await assert.rejects(f.mutate(vehicles.submitVehicle, { id: "vehicle" }), /missing views: interior/i);
  f.rows("vehicles")[0].media[4].view = "interior";
  f.rows("vehicles")[0].media[4].id = f.rows("vehicles")[0].media[0].id;
  await assert.rejects(f.mutate(vehicles.submitVehicle, { id: "vehicle" }), /distinct/i);
  f.rows("vehicles")[0].media[4].id = removed.id;
  await f.mutate(vehicles.submitVehicle, { id: "vehicle" });
  assert.equal(f.rows("vehicles")[0].status, "pending");

  const legacy = fixture(); legacy.listing("active", { media: [] });
  assert.equal((await vehicles.getVehicleById._handler(legacy.ctx, { id: "vehicle" })).status, "active");
  await assert.rejects(legacy.mutate(vehicles.updateVehicle, { id: "vehicle", title: "Changed title", expectedUpdatedAt: 2 }), /photo/i);
  assert.equal(legacy.rows("vehicles")[0].status, "active");
});

test("blank disclosure submissions and material changes follow moderation", async () => {
  const f = fixture();
  f.listing("draft", { mechanicalIssues: "", accidentDisclosure: " \n", damageDisclosure: "" });
  await f.mutate(vehicles.submitVehicle, { id: "vehicle" });
  f.as("admin");
  await f.mutate(vehicles.rejectVehicle, { id: "vehicle", reason: "Photos show damage; please describe it" });
  assert.match(f.rows("vehicles")[0].moderationReason, /damage/);
  f.as("owner");
  await f.mutate(vehicles.saveDraft, { ...complete, mechanicalIssues: "Oil leak", accidentDisclosure: "Rear collision", damageDisclosure: "Rear bumper dent", media: f.rows("vehicles")[0].media, id: "vehicle", expectedUpdatedAt: f.rows("vehicles")[0].updatedAt });
  await f.mutate(vehicles.submitVehicle, { id: "vehicle" });
  f.as("admin"); await f.mutate(vehicles.approveVehicle, { id: "vehicle" });
  f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
  f.as("owner");
  await f.mutate(vehicles.updateVehicle, { id: "vehicle", damageDisclosure: "Repaired rear bumper", expectedUpdatedAt: f.rows("vehicles")[0].updatedAt });
  assert.equal(f.rows("vehicles")[0].status, "pending");
  assert.equal(f.rows("conversations").length, 1);
  f.as("buyer");
  assert.equal(await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }), null);
});

test("direct submission requires an eligible category; specialty enters manual review", async () => {
  const trust = await import("../convex/trust.ts");
  for (const category of [undefined, "motorcycle", "rv", "parts"]) {
    const f = fixture(); f.listing("draft", { vehicleCategory: category });
    await assert.rejects(f.mutate(vehicles.submitVehicle, { id: "vehicle" }), /category/i);
    assert.equal(f.rows("vehicles")[0].status, "draft");
  }
  const specialty = fixture(); specialty.listing("draft", { vehicleCategory: "specialty" });
  await specialty.mutate(vehicles.submitVehicle, { id: "vehicle" });
  assert.equal(specialty.rows("vehicles")[0].status, "pending");
  specialty.as("admin");
  const review = await trust.getListingReview._handler(specialty.ctx, { vehicleId: "vehicle" });
  assert.ok(review.triggers.includes("specialty_eligibility"));
  await assert.rejects(specialty.mutate(vehicles.approveVehicle, { id: "vehicle" }), /enhanced review/);
  await specialty.mutate(trust.resolveListingReview, {
    vehicleId: "vehicle", expectedRevision: review.revision,
    reason: "Reviewed road registration and transfer eligibility for this specialty vehicle.",
  });
  specialty.as("owner");
  const beforeEdit = specialty.rows("vehicles")[0].updatedAt;
  await specialty.mutate(vehicles.updateVehicle, { id: "vehicle", description: "Updated specialty vehicle details.", expectedUpdatedAt: beforeEdit });
  specialty.as("admin");
  await assert.rejects(specialty.mutate(vehicles.approveVehicle, { id: "vehicle" }), /enhanced review/);
  const revised = await trust.getListingReview._handler(specialty.ctx, { vehicleId: "vehicle" });
  await specialty.mutate(trust.resolveListingReview, {
    vehicleId: "vehicle", expectedRevision: revised.revision,
    reason: "Rechecked registration and transfer eligibility after the seller's edit.",
  });
  await specialty.mutate(vehicles.approveVehicle, { id: "vehicle" });
  assert.equal(specialty.rows("vehicles")[0].status, "active");
  assert.equal(specialty.rows("adminAuditLog").filter(row => row.action === "listing_enhanced_review_cleared").length, 2);
  const legacy = fixture(); legacy.listing("active", { vehicleCategory: undefined });
  assert.equal((await vehicles.getVehicleById._handler(legacy.ctx, { id: "vehicle" })).vehicleCategory, undefined);
  await assert.rejects(legacy.mutate(vehicles.updateVehicle, { id: "vehicle", title: "Changed title", expectedUpdatedAt: 2 }), /category/i);
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

test("availability reminder, confirmation, expiry and restoration are idempotent", async () => {
  const realNow = Date.now;
  let now = 2_000_000_000_000;
  Date.now = () => now;
  try {
    const day = 24 * 60 * 60 * 1000;
    const f = fixture(); f.listing("pending"); f.as("admin");
    await f.mutate(vehicles.approveVehicle, { id: "vehicle" });
    let due = f.rows("vehicles")[0].availabilityDueAt;
    assert.equal(due, now + 45 * day);
    f.as("owner");
    await assert.rejects(f.mutate(vehicles.confirmAvailability, { id: "vehicle", expectedDueAt: due }), /seven days/);
    now += 38 * day - 1;
    await f.mutate(vehicles.checkAvailability, { id: "vehicle", dueAt: due });
    assert.equal(f.rows("notifications").filter(row => row.kind === "availability_reminder").length, 0);
    now++;
    const runAfter = f.ctx.scheduler.runAfter;
    f.ctx.scheduler.runAfter = async () => { throw new Error("delivery unavailable"); };
    await assert.rejects(f.mutate(vehicles.checkAvailability, { id: "vehicle", dueAt: due }), /delivery unavailable/);
    assert.equal(f.rows("notifications").filter(row => row.kind === "availability_reminder").length, 0);
    assert.equal(f.rows("vehicles")[0].availabilityDueAt, due);
    f.ctx.scheduler.runAfter = runAfter;
    await f.mutate(vehicles.checkAvailability, { id: "vehicle", dueAt: due });
    await f.mutate(vehicles.checkAvailability, { id: "vehicle", dueAt: due });
    assert.equal(f.rows("notifications").filter(row => row.kind === "availability_reminder").length, 1);
    assert.equal(f.rows("emailOutbox").filter(row => row.subject.includes("availability")).length, 1);
    f.as("buyer"); await assert.rejects(f.mutate(vehicles.confirmAvailability, { id: "vehicle", expectedDueAt: due }), /not found/);
    f.as("owner"); assert.equal(await f.mutate(vehicles.confirmAvailability, { id: "vehicle", expectedDueAt: due }), true);
    const renewed = f.rows("vehicles")[0].availabilityDueAt;
    assert.equal(renewed, now + 45 * day);
    assert.equal(await f.mutate(vehicles.confirmAvailability, { id: "vehicle", expectedDueAt: due }), false);
    assert.equal(f.rows("vehicles")[0].availabilityDueAt, renewed);
    await f.mutate(vehicles.checkAvailability, { id: "vehicle", dueAt: due });
    assert.equal(f.rows("vehicles")[0].status, "active");
    now = renewed + 2 * day; // Delayed jobs record the actual 45-day boundary.
    f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
    await assert.rejects(f.mutate(vehicles.confirmAvailability, { id: "vehicle", expectedDueAt: renewed }), /expired/);
    await assert.rejects(f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "reserved" }), /expired/);
    await f.mutate(vehicles.checkAvailability, { id: "vehicle", dueAt: renewed });
    await f.mutate(vehicles.checkAvailability, { id: "vehicle", dueAt: renewed });
    assert.equal(f.rows("vehicles")[0].status, "archived");
    assert.deepEqual(f.rows("vehicleModerationLog").at(-1), {
      _id: f.rows("vehicleModerationLog").at(-1)._id,
      vehicleId: "vehicle", fromStatus: "active", toStatus: "archived",
      reason: "Listing expired after availability was not confirmed", source: "system", createdAt: renewed,
    });
    assert.equal(f.rows("vehicles")[0].moderationHistory.at(-1).source, "system");
    assert.equal(f.rows("vehicles")[0].availabilityExpiredAt, renewed);
    assert.equal(f.rows("vehicles")[0].availabilityHistory.filter(event => event.kind === "expired").length, 1);
    assert.equal(f.rows("vehicles")[0].availabilityHistory.at(-1).at, renewed);
    assert.equal(f.rows("conversations").length, 1);
    f.as("buyer"); assert.equal(await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }), null);
    f.as("owner"); await f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "draft" });
    assert.equal(f.rows("vehicles")[0].status, "draft");
    assert.equal(f.rows("vehicles")[0].availabilityHistory.at(-1).kind, "reopened");
    assert.equal(f.rows("vehicles")[0].availabilityExpiredAt, undefined);
    await f.mutate(vehicles.submitVehicle, { id: "vehicle" });
    f.as("admin"); await f.mutate(vehicles.approveVehicle, { id: "vehicle" });
    assert.equal(f.rows("vehicles")[0].availabilityDueAt, now + 45 * day);
  } finally { Date.now = realNow; }
});

test("reserved clock pauses, release restarts it, and legacy records initialize", async () => {
  const realNow = Date.now;
  let now = 2_000_000_000_000; Date.now = () => now;
  try {
    const day = 24 * 60 * 60 * 1000;
    const f = fixture(); f.listing("active", { availabilityDueAt: now + day, availabilityNextCheckAt: now });
    await f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "reserved" });
    now += 50 * day;
    await f.mutate(vehicles.checkAvailability, { id: "vehicle", dueAt: now - 49 * day });
    assert.equal(f.rows("vehicles")[0].status, "reserved");
    await f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "active" });
    assert.equal(f.rows("vehicles")[0].availabilityDueAt, now + 45 * day);
    const disabled = fixture(); disabled.listing("active", { availabilityDueAt: now + 7 * day, availabilityNextCheckAt: now });
    disabled.rows("users")[0].notificationPreferences = { emailEnabled: false, messages: true, listings: true, favorites: true, events: true };
    await disabled.mutate(vehicles.checkAvailability, { id: "vehicle", dueAt: now + 7 * day });
    assert.equal(disabled.rows("notifications").filter(row => row.kind === "availability_reminder").length, 1);
    assert.equal(disabled.rows("emailOutbox").length, 0);
    const legacy = fixture(); legacy.listing("approved");
    await legacy.mutate(vehicles.sweepAvailability, {});
    assert.equal(legacy.rows("vehicles")[0].availabilityDueAt, now + 45 * day);
    assert.equal(legacy.rows("vehicles")[0].status, "approved");
  } finally { Date.now = realNow; }
});

test("seller state transitions retain conversations and event registrations", async () => {
  const f = fixture(); f.listing("active");
  f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
  f.add("registrations", { _id: "registration", vehicleId: "vehicle", eventId: "event" });
  await f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "reserved" });
  assert.equal(f.rows("vehicleCatalog").length, 1);
  assert.ok(f.rows("vehicleSearchTerms").length > 0);
  await f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "active" });
  assert.equal(f.rows("vehicleCatalog").length, 1);
  await f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "withdrawn" });
  assert.equal(f.rows("vehicleCatalog").length, 0);
  assert.equal(f.rows("vehicleSearchTerms").length, 0);
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
      assert.equal(f.rows("_storage").length, 10);
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

test("reserved listings allow new availability inquiries; sold and withdrawn listings preserve only existing threads", async () => {
  for (const status of ["reserved", "sold", "withdrawn"]) {
    const f = fixture(); f.listing(status);
    f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
    f.as("buyer");
    await f.mutate(messages.sendMessage, { recipientId: "owner", vehicleId: "vehicle", content: "Following up on our arrangement" });
    assert.equal(f.rows("messages")[0].conversationId, "thread");
    assert.equal(f.rows("conversations").length, 1);
    const publicListing = await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" });
    assert.equal(publicListing?.status ?? null, status === "reserved" ? "reserved" : null);
    if (publicListing) assert.equal(publicListing.contactInfo, "");
    const participantContext = await conversations.getVehicleContext._handler(f.ctx, { vehicleId: "vehicle", otherUserId: "owner" });
    assert.equal(participantContext._id, "vehicle");
    assert.equal(participantContext.status, status);
    assert.equal(await f.mutate(conversations.getOrCreateConversation, { vehicleId: "vehicle", otherUserId: "owner" }), "thread");
    assert.equal((await messages.getMessagesByConversation._handler(f.ctx, { conversationId: "thread", paginationOpts: { numItems: 30, cursor: null } })).page.length, 1);
    f.as("other");
    if (status === "reserved") {
      const newThread = await f.mutate(conversations.getOrCreateConversation, { vehicleId: "vehicle", otherUserId: "owner" });
      await f.mutate(messages.sendMessage, { recipientId: "owner", vehicleId: "vehicle", content: "Please let me know if this becomes available again" });
      assert.equal(f.rows("messages").find(row => row.content?.includes("becomes available"))?.conversationId, newThread);
    } else {
      await assert.rejects(f.mutate(messages.sendMessage, { recipientId: "owner", vehicleId: "vehicle", content: "New inquiry" }), /new conversations/);
      await assert.rejects(f.mutate(conversations.getOrCreateConversation, { vehicleId: "vehicle", otherUserId: "owner" }), /new conversations/);
    }
    assert.equal((await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }))?.status ?? null, status === "reserved" ? "reserved" : null);
    f.as(null); assert.equal((await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }))?.status ?? null, status === "reserved" ? "reserved" : null);
  }
});

test("conversation context cannot expose draft, pending, rejected or closed private specifications and new photos", async () => {
  for (const status of ["draft", "pending", "rejected", "sold", "withdrawn", "archived"]) {
    const f = fixture(); f.listing(status, { moderationReason: "Private review reason", moderationHistory: [{ reason: "Private history" }], description: "New unpublished description" });
    f.add("conversations", { _id: "thread", vehicleId: "vehicle", participant1Id: "buyer", participant2Id: "owner" });
    f.as("buyer");
    assert.equal(await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }), null);
    const context = await conversations.getVehicleContext._handler(f.ctx, { vehicleId: "vehicle", otherUserId: "owner" });
    assert.deepEqual(context, { _id: "vehicle", title: "Listing no longer public", status });
    const inbox = await conversations.getConversationsByUser._handler(f.ctx, {});
    assert.equal(inbox[0].vehicleTitle, "Listing no longer public");
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
  assert.equal(f.rows("engagementPairs").length, 1);
  assert.equal(f.rows("engagementPairs")[0].kind, "active");
  assert.equal(f.rows("engagementPairs")[0].respondedAt, undefined);
  f.as("owner");
  await f.mutate(messages.sendMessage, { recipientId: "buyer", vehicleId: "vehicle", content: "Yes, you can inspect it" });
  assert.ok(f.rows("engagementPairs")[0].respondedAt >= f.rows("engagementPairs")[0].firstAt);
  f.as("other"); assert.deepEqual(await conversations.getConversationsByUser._handler(f.ctx, {}), []);
});

test("buyer email verification gates new contact while existing threads remain readable", async () => {
  const f = fixture(); f.listing("active"); f.as("buyer");
  const buyer = () => f.rows("users").find(row => row._id === "buyer");
  buyer().emailVerified = false;
  buyer().phoneVerified = false;
  await assert.rejects(f.mutate(conversations.getOrCreateConversation, { vehicleId: "vehicle", otherUserId: "owner" }), /Verify your email/);
  await assert.rejects(f.mutate(messages.sendMessage, { recipientId: "owner", vehicleId: "vehicle", content: "Can I inspect it?" }), /Verify your email/);
  assert.deepEqual(await conversations.getContactState._handler(f.ctx, { otherUserId: "owner", vehicleId: "vehicle" }), { canContact: false, needsEmailVerification: true });
  assert.equal(f.rows("conversations").length, 0);
  buyer().emailVerified = true;
  const thread = await f.mutate(conversations.getOrCreateConversation, { vehicleId: "vehicle", otherUserId: "owner" });
  await f.mutate(messages.sendMessage, { recipientId: "owner", vehicleId: "vehicle", content: "Can I inspect it?" });
  assert.equal(f.rows("messages").length, 1); // Buyer phone is still unverified.
  buyer().emailVerified = false;
  assert.equal((await conversations.getConversationsByUser._handler(f.ctx, {})).length, 1);
  assert.equal((await messages.getMessagesByConversation._handler(f.ctx, { conversationId: thread, paginationOpts: { numItems: 10, cursor: null } })).page.length, 1);
  await assert.rejects(f.mutate(messages.sendMessage, { recipientId: "owner", vehicleId: "vehicle", content: "Another question" }), /Verify your email/);
  f.as(null);
  await assert.rejects(f.mutate(conversations.getOrCreateConversation, { vehicleId: "vehicle", otherUserId: "owner" }), /Authentication/);
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

test("ordinary sellers can verify, submit, correct and publish listings nationally after a separate review", async () => {
  const { upsertFromClerk } = await import("../convex/users.ts");
  const { attestOwnership } = await import("../convex/trust.ts");
  for (const [city, state, latitude, longitude] of [["Raleigh", "NC", 35.78, -78.64], ["Washington", "DC", 38.9, -77.04], ["Anchorage", "AK", 61.22, -149.9]]) {
    const f = fixture();
    const clerkUser = {
      id: "clerk-new-seller", first_name: "New", last_name: "Seller",
      primary_email_address_id: "email", primary_phone_number_id: "phone",
      email_addresses: [{ id: "email", email_address: "seller@example.test", verification: { status: "verified" } }],
      phone_numbers: [{ id: "phone", phone_number: "+12025550123", verification: { status: "unverified" } }],
    };
    await f.mutate(upsertFromClerk, { data: clerkUser });
    const seller = f.rows("users").find(row => row.externalId === clerkUser.id);
    assert.equal(seller.role, "user");
    f.as("new-seller");
    const { id, updatedAt } = await f.mutate(vehicles.saveDraft, { ...incomplete, clientRequestId: "first-draft" });
    const media = ["front", "rear", "left side", "right side", "interior"].map((view, index) => {
      const photoId = `upload-${index}`, thumbnailId = `thumb-${index}`, detailId = `detail-${index}`;
      f.add("vehicleMedia", { _id: photoId, thumbnailId, detailId, userId: seller._id, status: "ready", expiresAt: Date.now() + 60_000 });
      f.add("_storage", { _id: thumbnailId }); f.add("_storage", { _id: detailId });
      return { id: photoId, view, caption: "" };
    });
    const values = { ...complete, sellerState: state, location: { city, state, latitude, longitude }, media };
    await f.mutate(vehicles.saveDraft, { ...values, id, expectedUpdatedAt: updatedAt });
    await assert.rejects(f.mutate(vehicles.submitVehicle, { id }), /verify your email and phone/i);
    clerkUser.phone_numbers[0].verification.status = "verified";
    await f.mutate(upsertFromClerk, { data: clerkUser });
    await assert.rejects(f.mutate(vehicles.submitVehicle, { id }), /own this vehicle/i);
    await f.mutate(attestOwnership, { vehicleId: id, role: "owner" });
    f.as(null);
    const publicView = () => vehicles.getVehicleById._handler(f.ctx, { id });
    assert.equal(await publicView(), null);
    f.as("new-seller");
    await f.mutate(vehicles.submitVehicle, { id });
    await assert.rejects(f.mutate(vehicles.approveVehicle, { id }), /Administrator/);
    f.as(null); assert.equal(await publicView(), null);
    f.as("admin");
    await f.mutate(vehicles.rejectVehicle, { id, reason: "Clarify the maintenance history." });
    f.as(null); assert.equal(await publicView(), null);
    f.as("new-seller");
    const rejected = await f.ctx.db.get(id);
    await f.mutate(vehicles.saveDraft, { ...values, description: "Service records from 2022 to present are available.", id, expectedUpdatedAt: rejected.updatedAt });
    await f.mutate(vehicles.submitVehicle, { id });
    f.as("admin");
    await f.mutate(vehicles.approveVehicle, { id });
    f.as(null);
    assert.equal((await publicView()).location.state, state);
    assert.ok(f.rows("vehicleSearchTerms").some(row => row.vehicleId === id && row.scope === ""));
  }
});

test("moderators selling their own vehicles cannot approve through either mutation", async () => {
  for (const mutation of [vehicles.approveVehicle, vehicles.changeVehicleStatus]) {
    const f = fixture();
    f.listing("pending");
    await f.ctx.db.patch("owner", { role: "admin" });
    await assert.rejects(f.mutate(mutation, mutation === vehicles.approveVehicle ? { id: "vehicle" } : { id: "vehicle", status: "active" }), /Another moderator/);
    assert.equal((await f.ctx.db.get("vehicle")).status, "pending");
    assert.equal(f.rows("vehicleCatalog").length, 0);
  }
});

test("submission and moderator approval both enforce private seller and US jurisdictions", async () => {
  for (const [change, expected] of [
    [{ sellerType: "dealer" }, /private sellers only/],
    [{ sellerState: "PR" }, /U.S. state/],
    [{ location: { city: "Toronto", state: "ON" } }, /U.S. state/],
  ]) {
    const f = fixture();
    f.listing("draft", change);
    await assert.rejects(f.mutate(vehicles.submitVehicle, { id: "vehicle" }), expected);
    await f.ctx.db.patch("vehicle", { status: "pending" });
    f.as("admin");
    await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), expected);
    assert.equal(f.rows("vehicleCatalog").length, 0);
  }
});

test("authorized sellers need independently accepted evidence for this vehicle and current revision", async () => {
  const trust = await import("../convex/trust.ts");
  const f = fixture();
  f.listing();
  await f.mutate(trust.attestOwnership, { vehicleId: "vehicle", role: "authorized" });
  await f.mutate(vehicles.submitVehicle, { id: "vehicle" });
  f.as("admin");
  const review = () => trust.getListingReview._handler(f.ctx, { vehicleId: "vehicle" });
  const resolve = async (documentId) => f.mutate(trust.resolveListingReview, { vehicleId: "vehicle", expectedRevision: (await review()).revision, documentId, reason: "Signed owner authorization matches the vehicle and named seller." });
  const approve = () => f.mutate(vehicles.approveVehicle, { id: "vehicle" });
  assert.equal((await review()).requiresDocument, true);
  await assert.rejects(approve(), /enhanced review/);
  await assert.rejects(f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status: "active" }), /enhanced review/);
  await assert.rejects(resolve(), /verified, unexpired/);
  const doc = { _id: "proof", userId: "owner", vehicleId: "vehicle", vehicleVin: complete.vin, status: "pending", expiresAt: Date.now() + 86400000 };
  f.add("ownershipDocuments", doc);
  await assert.rejects(resolve("proof"), /verified, unexpired/);
  await f.mutate(trust.reviewDocument, { documentId: "proof", verified: false, reason: "Authorization page is missing." });
  await assert.rejects(resolve("proof"), /verified, unexpired/);
  f.add("ownershipDocuments", { ...doc, _id: "other-proof", vehicleId: "other-listing", status: "verified", reviewedAt: Date.now(), reviewerId: "admin" });
  await assert.rejects(resolve("other-proof"), /verified, unexpired/);
  f.add("ownershipDocuments", { ...doc, _id: "old-vin", vehicleVin: "1HGCM82633A004352" });
  await f.mutate(trust.reviewDocument, { documentId: "old-vin", verified: false, reason: "Evidence names another vehicle." });
  await assert.rejects(f.mutate(trust.reviewDocument, { documentId: "old-vin", verified: true, reason: "Rechecking the old upload." }), /current vehicle VIN/);
  f.add("ownershipDocuments", { ...doc, _id: "replacement" });
  await f.mutate(trust.reviewDocument, { documentId: "replacement", verified: true, reason: "Authority matches the listing." });
  f.as("owner");
  await f.ctx.db.patch("owner", { role: "admin" });
  await assert.rejects(f.mutate(trust.resolveListingReview, { vehicleId: "vehicle", expectedRevision: (await review()).revision, reason: "Own decision", documentId: "replacement" }), /independent moderator/);
  await assert.rejects(f.mutate(trust.reviewDocument, { documentId: "replacement", verified: true, reason: "Own evidence" }), /unavailable/);
  f.as("admin");
  await resolve("replacement");
  assert.equal((await review()).cleared, true);
  await f.ctx.db.patch("replacement", { expiresAt: Date.now() });
  await assert.rejects(approve(), /enhanced review/);
  f.add("ownershipDocuments", { ...doc, _id: "fresh" });
  await f.mutate(trust.reviewDocument, { documentId: "fresh", verified: true, reason: "Fresh document matches." });
  await resolve("fresh");
  await approve();
  assert.equal((await f.ctx.db.get("vehicle")).status, "active");
  assert.ok(f.rows("adminAuditLog").some(row => row.action === "listing_enhanced_review_cleared" && row.reason.includes("fresh")));
});

test("an evidence request immediately withdraws public discovery and survives changed declarations", async () => {
  const trust = await import("../convex/trust.ts");
  const f = fixture(); f.listing("active"); f.as("admin");
  await f.mutate(trust.requestListingEvidence, { vehicleId: "vehicle", expectedRevision: 2, trigger: "vin_identity", reason: "Upload the title page showing the vehicle identifier." });
  assert.equal((await f.ctx.db.get("vehicle")).status, "pending");
  f.as(null);
  assert.equal(await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }), null);
  f.as("buyer");
  await assert.rejects(trust.getMyListingReview._handler(f.ctx, { vehicleId: "vehicle" }), /unavailable/);
  await assert.rejects(trust.getListingReview._handler(f.ctx, { vehicleId: "vehicle" }), /Administrator/);
  f.as("owner");
  assert.match((await trust.getMyListingReview._handler(f.ctx, { vehicleId: "vehicle" })).request, /Upload the title page/);
  await f.mutate(trust.attestOwnership, { vehicleId: "vehicle", role: "authorized" });
  await f.mutate(trust.attestOwnership, { vehicleId: "vehicle", role: "owner" });
  f.as("admin");
  const review = await trust.getListingReview._handler(f.ctx, { vehicleId: "vehicle" });
  assert.ok(review.triggers.includes("authorized_seller"));
  assert.equal(review.requiresDocument, true);
  await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), /enhanced review/);
});

test("branded titles and outstanding liens require audited revision-specific decisions; uncertain liens cannot clear", async () => {
  const trust = await import("../convex/trust.ts");
  const f = fixture();
  f.listing("draft", { titleStatus: "rebuilt", lienStatus: "uncertain" });
  await f.mutate(vehicles.submitVehicle, { id: "vehicle" });
  f.as("admin");
  const revision = async () => (await f.ctx.db.get("vehicle")).updatedAt;
  const resolve = async (expectedRevision) => f.mutate(trust.resolveListingReview, { vehicleId: "vehicle", expectedRevision, reason: "Reviewed title brand and lender payoff and transfer instructions." });
  await assert.rejects(resolve(await revision()), /clarify the lien/);
  await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), /clarify the lien/);
  f.as("owner");
  await f.mutate(vehicles.updateVehicle, { id: "vehicle", lienStatus: "outstanding", lienPayoffPlan: "Seller obtains lien release from lender at closing." });
  f.as("admin");
  const reviewed = await revision();
  await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), /enhanced review/);
  await resolve(reviewed);
  f.as("owner");
  await f.mutate(vehicles.updateVehicle, { id: "vehicle", lienPayoffPlan: "Seller pays lender in advance and provides the released title." });
  f.as("admin");
  await assert.rejects(resolve(reviewed), /changed in another session/);
  await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), /enhanced review/);
  await resolve(await revision());
  await f.mutate(vehicles.approveVehicle, { id: "vehicle" });
  assert.equal((await f.ctx.db.get("vehicle")).status, "active");
});

test("title-only risk, legacy declarations and later evidence rejection preserve the publication hold", async () => {
  const trust = await import("../convex/trust.ts");
  const f = fixture();
  f.listing("pending", { ownershipRole: undefined, titleStatus: "salvage" });
  f.as("admin");
  await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), /own this vehicle|declare/i);
  f.as("owner");
  await f.mutate(trust.attestOwnership, { vehicleId: "vehicle", role: "owner" });
  f.as("admin");
  const review = () => trust.getListingReview._handler(f.ctx, { vehicleId: "vehicle" });
  assert.deepEqual((await review()).triggers, ["title"]);
  assert.equal((await review()).requiresDocument, false);
  await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), /enhanced review/);
  f.add("ownershipDocuments", { _id: "brand-doc", status: "pending", vehicleVin: complete.vin, vehicleId: "vehicle", userId: "owner", expiresAt: Date.now() + 60000 });
  await f.mutate(trust.reviewDocument, { documentId: "brand-doc", verified: true, reason: "Title brand matches private evidence." });
  await f.mutate(trust.resolveListingReview, { vehicleId: "vehicle", expectedRevision: (await review()).revision, documentId: "brand-doc", reason: "Reviewed branded title disclosure and evidence." });
  await f.mutate(vehicles.approveVehicle, { id: "vehicle" });
  await f.mutate(trust.reviewDocument, { documentId: "brand-doc", verified: false, reason: "Document relates to a different title." });
  f.as(null);
  assert.equal(await vehicles.getVehicleById._handler(f.ctx, { id: "vehicle" }), null);
  f.as("admin");
  assert.equal((await review()).requiresDocument, true);
  await assert.rejects(f.mutate(vehicles.approveVehicle, { id: "vehicle" }), /enhanced review/);
});

test("generic administrator transitions cannot close or release a structured reservation", async () => {
  for (const status of ["active", "sold", "withdrawn", "pending"]) {
    const f = fixture();
    f.listing("reserved");
    f.add("offerCycles", { _id: "cycle", vehicleId: "vehicle", winner: "thread" });
    f.as("admin");
    await assert.rejects(f.mutate(vehicles.changeVehicleStatus, { id: "vehicle", status }), /private offer/);
    assert.equal((await f.ctx.db.get("vehicle")).status, "reserved");
    assert.equal((await f.ctx.db.get("cycle")).winner, "thread");
  }
});
