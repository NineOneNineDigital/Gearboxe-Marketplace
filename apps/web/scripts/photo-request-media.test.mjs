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

const media = await import("../convex/photoRequestMedia.ts");
const moderation = await import("../convex/photoRequestModeration.ts");
const mediaHttp = await import("../convex/photoRequestMediaHttp.ts");

function fixture() {
  let actor = "seller", seq = 0;
  const tables = {
    users: [
      { _id: "seller", externalId: "clerk-seller", role: "user" },
      { _id: "buyer", externalId: "clerk-buyer", role: "user" },
      { _id: "other", externalId: "clerk-other", role: "user" },
      { _id: "admin", externalId: "clerk-admin", role: "admin" },
    ],
    vehicles: [{ _id: "vehicle", userId: "seller", title: "Honda Pilot", status: "active", createdAt: 100, updatedAt: 101, photos: [], media: [] }],
    photoRequests: [{ _id: "request", vehicleId: "vehicle", conversationId: "conversation", buyerId: "buyer", sellerId: "seller", status: "requested" }],
    photoRequestEntries: [{ _id: "entry", requestId: "request", senderId: "seller", kind: "reply", content: "Photos", photoIds: ["photo"], createdAt: 200 }],
    photoRequestPhotos: [{ _id: "photo", userId: "seller", requestId: "request", entryId: "entry", token: "", status: "ready", detailId: "private-storage", createdAt: 200, expiresAt: Number.MAX_SAFE_INTEGER }],
    photoPublicSelections: [], vehicleMedia: [], userBlocks: [], adminAuditLog: [],
  };
  const query = table => {
    const predicates = []; let desc = false;
    const builder = { eq(field, value) { predicates.push(row => row[field] === value); return builder; }, lt(field, value) { predicates.push(row => row[field] < value); return builder; } };
    const rows = () => { const found = (tables[table] ?? []).filter(row => predicates.every(fn => fn(row))); return structuredClone(desc ? [...found].reverse() : found); };
    const q = { withIndex(_name, filter) { filter(builder); return q; }, order(value) { desc = value === "desc"; return q; },
      collect: async () => rows(), unique: async () => { const found = rows(); assert.ok(found.length <= 1); return found[0] ?? null; },
      first: async () => rows()[0] ?? null, take: async count => rows().slice(0, count) };
    return q;
  };
  const ctx = { auth: { getUserIdentity: async () => actor ? { subject: `clerk-${actor}` } : null },
    db: { get: async id => structuredClone(Object.values(tables).flat().find(row => row._id === id) ?? null), query,
      insert: async (table, fields) => { const id = `row-${++seq}`; (tables[table] ??= []).push({ _id: id, ...structuredClone(fields) }); return id; },
      patch: async (id, fields) => { const row = Object.values(tables).flat().find(item => item._id === id); assert.ok(row); Object.assign(row, structuredClone(fields)); },
      delete: async id => { for (const rows of Object.values(tables)) { const index = rows.findIndex(row => row._id === id); if (index >= 0) rows.splice(index, 1); } } },
    storage: { delete: async () => {} } };
  return { ctx, rows: table => tables[table], as: id => { actor = id; } };
}

test("private photo is visible only to participants and audited support", async () => {
  const f = fixture();
  assert.equal(await media.authorizePhoto._handler(f.ctx, { photoId: "photo" }), "private-storage");
  f.as("buyer"); assert.equal(await media.authorizePhoto._handler(f.ctx, { photoId: "photo" }), "private-storage");
  f.as("other"); await assert.rejects(media.authorizePhoto._handler(f.ctx, { photoId: "photo" }), /unavailable/);
  f.as(null); await assert.rejects(media.authorizePhoto._handler(f.ctx, { photoId: "photo" }), /Authentication/);
  f.as("admin"); assert.equal(await media.authorizePhoto._handler(f.ctx, { photoId: "photo" }), "private-storage");
  assert.equal(f.rows("adminAuditLog").length, 1);
  f.rows("vehicles")[0].status = "sold";
  f.as("buyer"); assert.equal(await media.authorizePhoto._handler(f.ctx, { photoId: "photo" }), "private-storage");
});

test("private photo attachment checks owner, readiness, and ten-photo ceiling", async () => {
  const f = fixture();
  await assert.rejects(media.attachPhotos(f.ctx, Array.from({ length: 11 }, (_, index) => `p${index}`), "seller", "request"), /at most 10/);
  await assert.rejects(media.attachPhotos(f.ctx, ["photo"], "buyer", "request"), /unavailable/);
  await assert.rejects(media.attachPhotos(f.ctx, ["photo"], "seller", "request"), /unavailable/);
  f.rows("photoRequestPhotos")[0].entryId = undefined;
  assert.deepEqual(await media.attachPhotos(f.ctx, ["photo"], "seller", "request"), ["photo"]);
});

test("seller selection is private until independent approval and stale listing edits reject", async () => {
  const f = fixture();
  const selectionId = await moderation.select._handler(f.ctx, { photoId: "photo", caption: "Engine bay" });
  assert.equal(f.rows("vehicles")[0].media.length, 0);
  f.as("buyer"); await assert.rejects(moderation.mySelections._handler(f.ctx, { requestId: "request" }), /unavailable/);
  f.as("admin");
  assert.equal((await moderation.adminQueue._handler(f.ctx, {}))[0].photoId, "photo");
  const snapshot = await moderation.approvalSnapshot._handler(f.ctx, { selectionId });
  f.rows("vehicles")[0].updatedAt += 1;
  assert.equal(await moderation.completeApproval._handler(f.ctx, { selectionId, revision: snapshot.revision, vehicleRevision: snapshot.vehicleRevision, detailId: "public-detail", thumbnailId: "public-thumb" }), false);
  assert.equal(f.rows("vehicles")[0].media.length, 0);
  assert.equal(f.rows("photoPublicSelections")[0].status, "stale");
  f.as("seller"); await moderation.select._handler(f.ctx, { photoId: "photo", caption: "Engine bay after edit" });
  f.as("admin");
  const fresh = await moderation.approvalSnapshot._handler(f.ctx, { selectionId });
  assert.equal(await moderation.completeApproval._handler(f.ctx, { selectionId, revision: fresh.revision, vehicleRevision: fresh.vehicleRevision, detailId: "public-detail", thumbnailId: "public-thumb" }), true);
  assert.equal(f.rows("vehicles")[0].media.length, 1);
  assert.equal(f.rows("vehicles")[0].media[0].caption, "Engine bay after edit");
  assert.equal(f.rows("photoRequestPhotos")[0].detailId, "private-storage");
  f.as("seller"); await assert.rejects(moderation.select._handler(f.ctx, { photoId: "photo", caption: "Again" }), /already public/);
});

test("seller cannot select a private photo for public review without a caption", async () => {
  const f = fixture();
  await assert.rejects(moderation.select._handler(f.ctx, { photoId: "photo", caption: "   " }), /Add a caption/);
  assert.equal(f.rows("photoPublicSelections").length, 0);
  assert.equal(f.rows("vehicles")[0].media.length, 0);
});

test("private browser download preflight includes bearer authorization and no-store", async () => {
  const old = process.env.APP_URL, oldAdmin = process.env.ADMIN_PORTAL_URL;
  process.env.APP_URL = "https://market.example"; process.env.ADMIN_PORTAL_URL = "https://admin.example";
  try {
    const response = await mediaHttp.download._handler({}, new Request("https://convex.example/photo-request-media/photo?id=photo", { method: "OPTIONS", headers: { Origin: "https://market.example" } }));
    assert.equal(response.status, 204);
    assert.match(response.headers.get("Access-Control-Allow-Headers"), /Authorization/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const admin = await mediaHttp.download._handler({}, new Request("https://convex.example/photo-request-media/photo?id=photo", { method: "OPTIONS", headers: { Origin: "https://admin.example" } }));
    assert.equal(admin.status, 204);
    assert.equal(admin.headers.get("Access-Control-Allow-Origin"), "https://admin.example");
    const foreign = await mediaHttp.download._handler({}, new Request("https://convex.example/photo-request-media/photo?id=photo", { method: "OPTIONS", headers: { Origin: "https://foreign.example" } }));
    assert.equal(foreign.status, 404);
  } finally {
    if (old === undefined) delete process.env.APP_URL; else process.env.APP_URL = old;
    if (oldAdmin === undefined) delete process.env.ADMIN_PORTAL_URL; else process.env.ADMIN_PORTAL_URL = oldAdmin;
  }
});

test("an administrator selling the vehicle cannot approve their own selected photo", async () => {
  const f = fixture();
  f.rows("users").find(row => row._id === "seller").role = "admin";
  const selectionId = await moderation.select._handler(f.ctx, { photoId: "photo", caption: "Rear seats" });
  await assert.rejects(moderation.approvalSnapshot._handler(f.ctx, { selectionId }), /Another moderator/);
  assert.equal(f.rows("vehicles")[0].media.length, 0);
});

test("seller deletion during approval prevents public photo publication", async () => {
  const f = fixture();
  const selectionId = await moderation.select._handler(f.ctx, { photoId: "photo", caption: "Rear seats" });
  f.as("admin");
  const snapshot = await moderation.approvalSnapshot._handler(f.ctx, { selectionId });
  f.rows("users").find(row => row._id === "seller").deletedAt = Date.now();
  assert.equal(await moderation.completeApproval._handler(f.ctx, { selectionId, revision: snapshot.revision,
    vehicleRevision: snapshot.vehicleRevision, detailId: "public-detail", thumbnailId: "public-thumb" }), false);
  assert.equal(f.rows("vehicles")[0].media.length, 0);
  await assert.rejects(moderation.approvalSnapshot._handler(f.ctx, { selectionId }), /Seller account unavailable|Selection changed/);
});

test("seller suspension before or during review prevents public photo publication", async () => {
  for (const timing of ["before snapshot", "after snapshot"]) {
    const f = fixture();
    const selectionId = await moderation.select._handler(f.ctx, { photoId: "photo", caption: "Rear seats" });
    f.as("admin");
    if (timing === "before snapshot") {
      f.rows("users").find(row => row._id === "seller").suspendedAt = Date.now();
      await assert.rejects(moderation.approvalSnapshot._handler(f.ctx, { selectionId }), /Seller account unavailable/);
    } else {
      const snapshot = await moderation.approvalSnapshot._handler(f.ctx, { selectionId });
      f.rows("users").find(row => row._id === "seller").suspendedAt = Date.now();
      assert.equal(await moderation.completeApproval._handler(f.ctx, { selectionId, revision: snapshot.revision,
        vehicleRevision: snapshot.vehicleRevision, detailId: "public-detail", thumbnailId: "public-thumb" }), false);
      assert.equal(f.rows("photoPublicSelections")[0].status, "stale");
    }
    assert.equal(f.rows("vehicles")[0].media.length, 0);
    assert.equal(f.rows("vehicleMedia").length, 0);
  }
});

test("surviving buyer retains private photo access after seller deletion", async () => {
  const f = fixture();
  f.rows("users").find(row => row._id === "seller").deletedAt = Date.now();
  f.as("buyer");
  assert.equal(await media.authorizePhoto._handler(f.ctx, { photoId: "photo" }), "private-storage");
  f.as("seller"); await assert.rejects(media.authorizePhoto._handler(f.ctx, { photoId: "photo" }), /Authentication/);
  f.as("other"); await assert.rejects(media.authorizePhoto._handler(f.ctx, { photoId: "photo" }), /unavailable/);
});

test("withdrawal and a full listing reject stale public-photo approval without publishing", async () => {
  for (const change of ["withdrawn", "full"]) {
    const f = fixture();
    const selectionId = await moderation.select._handler(f.ctx, { photoId: "photo", caption: "Rear seats" });
    f.as("admin");
    const snapshot = await moderation.approvalSnapshot._handler(f.ctx, { selectionId });
    if (change === "withdrawn") f.rows("vehicles")[0].status = "withdrawn";
    else f.rows("vehicles")[0].photos = Array.from({ length: 30 }, (_, index) => `photo-${index}`);
    assert.equal(await moderation.completeApproval._handler(f.ctx, { selectionId, revision: snapshot.revision,
      vehicleRevision: snapshot.vehicleRevision, detailId: "public-detail", thumbnailId: "public-thumb" }), false);
    assert.equal(f.rows("vehicles")[0].media.length, 0);
    assert.equal(f.rows("vehicleMedia").length, 0);
    assert.equal(f.rows("photoPublicSelections")[0].status, "stale");
  }
});

test("private storage sweep removes interrupted orphan but keeps referenced and recent files", async () => {
  const old = Date.now() - 25 * 60 * 60 * 1000;
  const files = [
    { _id: "orphan", contentType: "image/webp; gearboxe=photo-request-private", _creationTime: old },
    { _id: "source", contentType: "image/jpeg; gearboxe=photo-request-private", _creationTime: old },
    { _id: "detail", contentType: "image/webp; gearboxe=photo-request-private", _creationTime: old },
    { _id: "fresh", contentType: "image/webp; gearboxe=photo-request-private", _creationTime: Date.now() },
    { _id: "other", contentType: "image/webp; gearboxe=vehicle-media", _creationTime: old },
  ];
  const refs = [{ sourceId: "source", detailId: "detail" }];
  const deleted = [], scheduled = [];
  const ctx = {
    db: {
      system: { query: table => { assert.equal(table, "_storage"); return { paginate: async ({ cursor, numItems }) => {
        assert.equal(cursor, null); assert.equal(numItems, 100);
        return { page: files, isDone: true, continueCursor: "done" };
      } }; } },
      query: table => { assert.equal(table, "photoRequestPhotos"); return { withIndex: (_name, filter) => {
        let field, value;
        filter({ eq: (name, expected) => { field = name; value = expected; return this; } });
        return { first: async () => refs.find(row => row[field] === value) ?? null };
      } }; },
    },
    storage: { delete: async id => { deleted.push(id); } },
    scheduler: { runAfter: async (...args) => { scheduled.push(args); } },
  };
  await media.cleanupStorage._handler(ctx, { cursor: null });
  assert.deepEqual(deleted, ["orphan"]);
  assert.equal(scheduled.length, 0);
});
