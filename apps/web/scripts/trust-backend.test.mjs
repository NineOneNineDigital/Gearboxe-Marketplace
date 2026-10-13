import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getFunctionName } from "convex/server";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    for (const suffix of [".ts", ".js"]) {
      const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
} });
const records = await import("../convex/trustDocuments.ts");
const trust = await import("../convex/trust.ts");
const guards = await import("../convex/lib/trustGuards.ts");
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
    runQuery: async (ref, args) => records[getFunctionName(ref).split(":")[1]]._handler(ctx, args),
  };
  return { ctx, user, tables, blobs, deleted, scheduled };
}
test("private upload leases bind uploader, expire, and can only be claimed once", async () => {
 const f=fixture(); f.tables.ownershipUploadLeases=[{_id:"lease",userId:"owner",token:"token",expiresAt:Date.now()+10000,used:false}];
 await records.claimUpload._handler(f.ctx,{token:"token"});
 await assert.rejects(records.claimUpload._handler(f.ctx,{token:"token"}),/expired/);
 f.tables.ownershipUploadLeases[0].used=false; f.tables.ownershipUploadLeases[0].userId="other";
 await assert.rejects(records.claimUpload._handler(f.ctx,{token:"token"}),/expired/);
 f.tables.ownershipUploadLeases[0].userId="owner"; f.tables.ownershipUploadLeases[0].expiresAt=0;
 await assert.rejects(records.claimUpload._handler(f.ctx,{token:"token"}),/expired/);
});
test("private documents require ownership/admin authorization; moderator reads are audited", async()=>{
 const f=fixture(); f.tables.ownershipDocuments=[{_id:"document",userId:"other",storageId:"file",expiresAt:Date.now()+10000}];
 await assert.rejects(records.authorizeDownload._handler(f.ctx,{documentId:"document"}),/unavailable/);
 f.user.role="admin"; assert.equal(await records.authorizeDownload._handler(f.ctx,{documentId:"document"}),"file");
 assert.equal(f.tables.adminAuditLog[0].action,"ownership_document_accessed");
 f.tables.ownershipDocuments[0].expiresAt=0;await assert.rejects(records.authorizeDownload._handler(f.ctx,{documentId:"document"}),/unavailable/);
});
test("document HTTP uploads reject fake MIME signatures and oversized streamed bodies",async()=>{
 process.env.APP_URL="https://gearboxe.test";
 for(const body of ["not-a-pdf",new Uint8Array(10*1024*1024+1)]){
  const f=fixture();f.tables.ownershipUploadLeases=[{_id:"lease",userId:"owner",token:"token",expiresAt:Date.now()+10000,used:false}];
  const request=new Request("https://deployment.convex.site/trust/document",{method:"POST",headers:{Origin:process.env.APP_URL,"Content-Type":"application/pdf","X-Upload-Token":"token"},body});
  const response=await records.documentUpload._handler(f.ctx,request);assert.equal(response.status,400);assert.equal(f.blobs.size,0);
 }
});
test("private upload records no public bearer URL and expires after 30 days",async()=>{
 process.env.APP_URL="https://gearboxe.test";const f=fixture();f.tables.ownershipUploadLeases=[{_id:"lease",userId:"owner",token:"token",expiresAt:Date.now()+10000,used:false}];
 f.ctx.storage.getUrl=()=>{throw new Error("must not issue bearer URLs");};
 const response=await records.documentUpload._handler(f.ctx,new Request("https://deployment.convex.site/trust/document",{method:"POST",headers:{Origin:process.env.APP_URL,"Content-Type":"application/pdf","X-Upload-Token":"token"},body:"%PDF-1.7 document"}));
 assert.equal(response.status,200);const document=f.tables.ownershipDocuments[0];assert.equal(document.expiresAt-document.createdAt,30*86400000);assert.equal(f.tables.ownershipUploadLeases.length,0);
 const mine=await trust.getMySafety._handler(f.ctx,{});assert.equal("storageId" in mine.documents[0],false);
});
test("message rate quota and bidirectional blocks apply on server",async()=>{
 const f=fixture();f.tables.users.push({_id:"other",role:"user"});
 for(let i=0;i<30;i++)await guards.consumeRateLimit(f.ctx,"owner","message");
 await assert.rejects(guards.consumeRateLimit(f.ctx,"owner","message"),/Too many/);
 f.tables.userBlocks=[{userId:"other",blockedUserId:"owner"}];await assert.rejects(guards.assertCanContact(f.ctx,"owner","other"),/unavailable/);
 f.tables.userBlocks=[];f.user.suspendedAt=1;await assert.rejects(guards.assertCanContact(f.ctx,"owner","other"),/cannot send/);
});
test("nonadministrators cannot moderate reports or suspend users",async()=>{
 const f=fixture();await assert.rejects(trust.moderateReport._handler(f.ctx,{reportId:"case",status:"resolved",reason:"spam",note:"reviewed"}),/Administrator/);
 await assert.rejects(trust.setSuspension._handler(f.ctx,{targetUserId:"other",suspended:true,reason:"spam"}),/Administrator/);
});
test("expired documents and tagged orphan files are removed without deleting other storage",async()=>{
 const f=fixture();const storageId=await f.ctx.storage.store(new Blob(["old"],{type:"application/pdf; gearboxe=ownership-document"}));
 f.tables.ownershipDocuments=[{_id:"document",storageId,expiresAt:0}];await trust.cleanupDocuments._handler(f.ctx,{});assert.equal(f.blobs.size,0);
 const orphan=await f.ctx.storage.store(new Blob(["orphan"],{type:"application/pdf; gearboxe=ownership-document"}));f.tables._storage.find(x=>x._id===orphan)._creationTime=0;
 const keep=await f.ctx.storage.store(new Blob(["keep"],{type:"application/pdf"}));await trust.cleanupDocumentStorage._handler(f.ctx,{cursor:null});assert.equal(f.blobs.has(orphan),false);assert.equal(f.blobs.has(keep),true);
});
test("suspended accounts retain appeal access while unauthenticated uploads fail before storage", async () => {
  const f = fixture();
  f.user.suspendedAt = Date.now();
  await trust.submitAppeal._handler(f.ctx, { message: "Please review my suspension." });
  assert.equal(f.tables.trustAppeals[0].status, "open");
  await assert.rejects(trust.requestIdentityReview._handler(f.ctx, {}), /suspended/);
  f.ctx.auth.getUserIdentity = async () => null;
  const response = await records.documentUpload._handler(f.ctx, new Request("https://deployment.convex.site/trust/document", {
    method: "POST", headers: { Origin: process.env.APP_URL, "Content-Type": "application/pdf", "X-Upload-Token": "token" }, body: "%PDF-1.7 document",
  }));
  assert.equal(response.status, 400);
  assert.equal(f.blobs.size, 0);
});
test("reports require visible third-party listings and preserve moderation audit entries", async () => {
  const f = fixture();
  f.tables.vehicles = [{ _id: "listing", userId: "other", status: "draft" }];
  await assert.rejects(trust.reportListing._handler(f.ctx, { vehicleId: "listing", reason: "spam", details: "Repeated advertising" }), /unavailable/);
  f.tables.vehicles[0].status = "active";
  const id = await trust.reportListing._handler(f.ctx, { vehicleId: "listing", reason: "spam", details: "Repeated advertising" });
  assert.equal(f.tables.trustReports[0].status, "open");
  f.user.role = "admin";
  await trust.moderateReport._handler(f.ctx, { reportId: id, status: "escalated", reason: "spam", note: "Escalated to specialist review" });
  await trust.moderateReport._handler(f.ctx, { reportId: id, status: "resolved", reason: "spam", note: "Review completed" });
  assert.deepEqual(f.tables.adminAuditLog.map(row => row.action), ["report_escalated", "report_resolved"]);
  assert.equal(f.tables.trustNotes.length, 2);
});

const complete = {
  title: "2022 Chevrolet Silverado", make: "Chevrolet", model: "Silverado 1500", year: 2022,
  vin: "3GCUDHEL3NG668790", mileage: 12000, price: 40000, trim: "ZR2", bodyStyle: "Truck", engine: "V8",
  transmission: "Automatic", drivetrain: "4WD", fuelType: "Gasoline", exteriorColor: "Blue", interiorColor: "Black",
  mileageUnit: "mi", odometerStatus: "actual", titleStatus: "clean", sellerState: "NC", condition: "good",
  mechanicalIssues: "None known", accidentDisclosure: "Unknown", damageDisclosure: "None known",
  serviceRecords: "partial", modifications: "None", sellerType: "private", location: { city: "Raleigh", state: "NC" },
  features: [], negotiable: true, description: "Well maintained vehicle with service records.", contactInfo: "Private contact", photos: [],
};

test("restoration clears moderation removal marker and requires an active verified seller", async () => {
  const f = fixture();
  f.tables.users.push({ _id: "admin", externalId: "clerk-admin", role: "admin" });
  f.ctx.auth.getUserIdentity = async () => ({ subject: "clerk-admin" });
  f.user.emailVerified = true;
  f.user.phoneVerified = true;
  f.tables.vehicles = [{ _id: "listing", userId: "owner", status: "archived", createdAt: 1, updatedAt: 2, ownershipAttestedAt: 1, moderationRemovedAt: 5, ...complete, media: [{ id: "photo", caption: "Front" }] }];
  f.tables.vehicleMedia = [{ _id: "photo", userId: "owner", vehicleId: "listing", status: "ready", thumbnailId: "thumb", detailId: "detail" }];
  f.tables._storage.push({ _id: "thumb" }, { _id: "detail" });
  f.ctx.db.system.get = f.ctx.db.get;
  f.user.suspendedAt = 1;
  await assert.rejects(trust.restoreListing._handler(f.ctx, { vehicleId: "listing", reason: "Appeal accepted" }), /suspended/);
  assert.equal(f.tables.vehicles[0].moderationRemovedAt, 5);
  delete f.user.suspendedAt;
  await trust.restoreListing._handler(f.ctx, { vehicleId: "listing", reason: "Appeal accepted" });
  assert.equal(f.tables.vehicles[0].status, "pending");
  assert.equal(f.tables.vehicles[0].moderationRemovedAt, undefined);
  assert.equal(f.tables.listingNotifications.length, 1);
  assert.equal(f.tables.vehicles[0].moderationHistory.length, 1);
});
test("failed document signatures consume upload ticket issuance quota", async () => {
  process.env.CONVEX_SITE_URL = "https://deployment.convex.site";
  const f = fixture();
  for (let i = 0; i < 5; i++) {
    const ticket = await trust.createDocumentUpload._handler(f.ctx, {});
    const response = await records.documentUpload._handler(f.ctx, new Request(ticket.uploadUrl, {
      method: "POST", headers: { Origin: process.env.APP_URL, "Content-Type": "application/pdf", "X-Upload-Token": ticket.token }, body: i % 2 ? "fake PDF" : "",
    }));
    assert.equal(response.status, 400);
  }
  await assert.rejects(trust.createDocumentUpload._handler(f.ctx, {}), /Too many/);
  assert.equal(f.blobs.size, 0);
});
