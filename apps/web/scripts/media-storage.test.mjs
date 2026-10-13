import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getFunctionName } from "convex/server";
import sharp from "sharp";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    for (const suffix of [".ts", ".js"]) {
      const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
} });
const records = await import("../convex/mediaRecords.ts");
const media = await import("../convex/media.ts");
const { upload } = await import("../convex/mediaUpload.ts");
const { processUpload } = await import("../convex/mediaProcessing.ts");
const { attachMedia, resolveVehicleMedia } = await import("../convex/lib/vehicleMedia.ts");
const { isTrustedImageUrl } = await import("../lib/trusted-images.ts");

function fixture() {
  const user = { _id: "owner", externalId: "clerk-owner", role: "user" };
  const tables = { users: [user], vehicleMedia: [], _storage: [] };
  const blobs = new Map();
  const deleted = [];
  const scheduled = [];
  let sequence = 0;
  const query = table => {
    let predicates = [];
    const q = {
      withIndex(_index, callback) {
        const builder = { eq(field, value) { predicates.push(row => row[field] === value); return builder; }, lt(field, value) { predicates.push(row => row[field] < value); return builder; } };
        callback(builder); return q;
      },
      collect: async () => (tables[table] ?? []).filter(row => predicates.every(p => p(row))),
      first: async () => (await q.collect())[0] ?? null,
      unique: async () => { const rows = await q.collect(); assert.ok(rows.length <= 1); return rows[0] ?? null; },
      take: async count => (await q.collect()).slice(0, count),
      paginate: async () => ({ page: await q.collect(), isDone: true, continueCursor: "" }),
    };
    return q;
  };
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: "clerk-owner" }) },
    db: {
      query,
      system: { query },
      get: async id => Object.values(tables).flat().find(row => row._id === id) ?? null,
      insert: async (table, row) => { const id = `record-${++sequence}`; (tables[table] ??= []).push({ _id: id, ...row }); return id; },
      patch: async (id, fields) => { const row = await ctx.db.get(id); assert.ok(row); Object.assign(row, fields); },
      delete: async id => { for (const table of Object.values(tables)) { const index = table.findIndex(row => row._id === id); if (index >= 0) table.splice(index, 1); } },
    },
    storage: {
      store: async blob => { const id = `file-${++sequence}`; blobs.set(id, blob); tables._storage.push({ _id: id, _creationTime: Date.now(), contentType: blob.type }); return id; },
      get: async id => blobs.get(id) ?? null,
      getUrl: async id => blobs.has(id) ? `https://test.convex.cloud/api/storage/${id}` : null,
      delete: async id => { deleted.push(id); blobs.delete(id); await ctx.db.delete(id); },
    },
    scheduler: { runAfter: async (...args) => { scheduled.push(args); } },
    runMutation: async (ref, args) => { const name = getFunctionName(ref).split(":")[1]; return records[name]._handler(ctx, args); },
    runQuery: async () => user,
    runAction: async (_ref, args) => processUpload._handler(ctx, args),
  };
  const ready = async (id = "ready", owner = "owner") => {
    const thumbnailId = await ctx.storage.store(new Blob(["thumbnail"], { type: "image/webp; gearboxe=vehicle-media" }));
    const detailId = await ctx.storage.store(new Blob(["detail"], { type: "image/webp; gearboxe=vehicle-media" }));
    tables.vehicleMedia.push({ _id: id, userId: owner, status: "ready", token: "", createdAt: Date.now(), expiresAt: Date.now() + 86400000, thumbnailId, detailId });
    return { id, caption: "Front view" };
  };
  return { ctx, user, tables, blobs, deleted, scheduled, ready };
}

test("listing media rejects foreign, unprocessed, duplicate and injected photos", async () => {
  const { ctx, tables, ready } = fixture();
  const ref = await ready();
  const other = await ready("foreign", "other");
  await assert.rejects(attachMedia(ctx, "vehicle", "owner", [], [other]), /seller/);
  await assert.rejects(attachMedia(ctx, "vehicle", "owner", [], [ref, ref]), /distinct/);
  await assert.rejects(attachMedia(ctx, "vehicle", "owner", ["blob:local"], [ref]), /uploader/);
  await assert.rejects(attachMedia(ctx, "vehicle", "owner", [], [{ ...ref, caption: "x".repeat(201) }]), /captions/);
  tables.vehicleMedia[0].status = "uploaded";
  await assert.rejects(attachMedia(ctx, "vehicle", "owner", [], [ref]), /unavailable/);
});

test("saving preserves order/captions and replacement deletes old variants", async () => {
  const { ctx, ready, deleted } = fixture();
  const old = await ready("old"), replacement = await ready("new");
  const vehicle = { _id: "vehicle", photos: ["https://images.unsplash.com/legacy"], media: [old] };
  await attachMedia(ctx, vehicle._id, "owner", [], [old]);
  await attachMedia(ctx, vehicle._id, "owner", vehicle.photos, [replacement], vehicle);
  vehicle.media = [{ ...replacement, caption: "New exterior" }];
  const resolved = await resolveVehicleMedia(ctx, vehicle);
  assert.deepEqual(resolved.legacyPhotos, vehicle.photos);
  assert.equal(resolved.photos.length, 2);
  assert.deepEqual(resolved.photoCaptions, ["", "New exterior"]);
  assert.equal(resolved.media[0].id, "new");
  assert.equal(deleted.length, 2);
  await assert.rejects(media.deleteUpload._handler(ctx, { mediaId: "new" }), /unattached/);
});

test("upload lease cannot be reused, forged, or processed by another user", async () => {
  const { ctx, tables } = fixture();
  const mediaId = await records.createLease._handler(ctx, { token: "token" });
  await records.claimUpload._handler(ctx, { token: "token" });
  await assert.rejects(records.claimUpload._handler(ctx, { token: "token" }), /expired/);
  await records.recordSource._handler(ctx, { mediaId, storageId: "source" });
  await assert.rejects(records.claimProcessing._handler(ctx, { mediaId, storageId: "stolen" }), /unavailable/);
  tables.vehicleMedia[0].userId = "other";
  await assert.rejects(records.claimProcessing._handler(ctx, { mediaId, storageId: "source" }), /unavailable/);
});

test("authenticated direct upload produces permanent variants and removes original", async () => {
  const { ctx, tables, deleted, blobs } = fixture();
  const previousOrigin = process.env.APP_URL;
  process.env.APP_URL = "https://market.example";
  try {
    const token = "11111111-1111-4111-8111-111111111111";
    const mediaId = await records.createLease._handler(ctx, { token });
    const original = await sharp({ create: { width: 900, height: 600, channels: 3, background: "blue" } }).withExif({ IFD0: { Artist: "Private seller" } }).jpeg().toBuffer();
    const response = await upload._handler(ctx, new Request(`https://test.convex.site/vehicle-media/upload?token=${token}`, { method: "POST", headers: { Origin: process.env.APP_URL, "Content-Type": "image/jpeg" }, body: original }));
    assert.equal(response.status, 200);
    const { storageId } = await response.json();
    const result = await media.finalizeUpload._handler(ctx, { mediaId, storageId });
    assert.equal(result.id, mediaId);
    assert.match(result.url, /\/api\/storage\//);
    assert.ok(deleted.includes(storageId));
    const record = tables.vehicleMedia[0];
    assert.equal(record.status, "ready");
    const detail = await sharp(Buffer.from(await blobs.get(record.detailId).arrayBuffer())).metadata();
    const thumbnail = await sharp(Buffer.from(await blobs.get(record.thumbnailId).arrayBuffer())).metadata();
    assert.equal(detail.exif, undefined);
    assert.equal(thumbnail.width, 480);
    await media.deleteUpload._handler(ctx, { mediaId });
    assert.equal(blobs.size, 0);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_URL; else process.env.APP_URL = previousOrigin;
  }
});

test("orphan cleanup deletes expired and interrupted tagged uploads without affecting other storage", async () => {
  const { ctx, tables, ready, blobs } = fixture();
  await ready("abandoned");
  tables.vehicleMedia[0].expiresAt = Date.now() - 1;
  await ready("attached");
  tables.vehicleMedia[1].vehicleId = "vehicle";
  const unrelated = await ctx.storage.store(new Blob(["another feature"], { type: "image/webp" }));
  const interrupted = await ctx.storage.store(new Blob(["interrupted"], { type: "image/webp; gearboxe=vehicle-media" }));
  tables._storage.find(row => row._id === interrupted)._creationTime -= 86400001;
  await records.cleanup._handler(ctx, {});
  await records.cleanupStorage._handler(ctx, { cursor: null });
  assert.ok(blobs.has(unrelated));
  assert.equal(blobs.has(interrupted), false);
  assert.equal(tables.vehicleMedia.length, 1);
  assert.equal(tables.vehicleMedia[0]._id, "attached");
});

test("image rendering rejects browser URLs and untrusted hosts", () => {
  assert.equal(isTrustedImageUrl("https://images.unsplash.com/photo"), true);
  for (const url of ["blob:local", "data:image/png;base64,AAA", "https://evil.example/photo", "https://images.unsplash.com.evil.example/photo", "https://user:pass@images.unsplash.com/photo", "https://images.unsplash.com:8443/photo"]) assert.equal(isTrustedImageUrl(url), false);
});

test("HTTP upload checks origin, MIME and actual stream size before permanent storage", async () => {
  const { ctx, blobs } = fixture();
  const previousOrigin = process.env.APP_URL;
  process.env.APP_URL = "https://market.example";
  const request = (origin, mime, body, token = "11111111-1111-4111-8111-111111111111") => new Request(`https://test.convex.site/vehicle-media/upload?token=${token}`, { method: "POST", headers: { Origin: origin, "Content-Type": mime }, body });
  try {
    assert.equal((await upload._handler(ctx, request("https://evil.example", "image/jpeg", "data"))).status, 403);
    assert.equal((await upload._handler(ctx, request(process.env.APP_URL, "image/svg+xml", "<svg/>"))).status, 400);
    await records.createLease._handler(ctx, { token: "11111111-1111-4111-8111-111111111111" });
    const oversize = await upload._handler(ctx, request(process.env.APP_URL, "image/jpeg", new Uint8Array(10 * 1024 * 1024 + 1)));
    assert.equal(oversize.status, 400);
    assert.equal(blobs.size, 0);
    const options = await upload._handler(ctx, new Request("https://test.convex.site/vehicle-media/upload", { method: "OPTIONS", headers: { Origin: process.env.APP_URL } }));
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("Access-Control-Allow-Origin"), process.env.APP_URL);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_URL; else process.env.APP_URL = previousOrigin;
  }
});

test("failed server image processing removes original and upload record for a clean retry", async () => {
  const { ctx, tables, blobs } = fixture();
  const mediaId = await records.createLease._handler(ctx, { token: "token" });
  await records.claimUpload._handler(ctx, { token: "token" });
  const storageId = await ctx.storage.store(new Blob(["not an image"], { type: "image/jpeg; gearboxe=vehicle-media" }));
  await records.recordSource._handler(ctx, { mediaId, storageId });
  await assert.rejects(media.finalizeUpload._handler(ctx, { mediaId, storageId }), /could not be processed/);
  assert.equal(blobs.size, 0);
  assert.equal(tables.vehicleMedia.length, 0);
});
