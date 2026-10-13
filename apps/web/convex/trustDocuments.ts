import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCurrentUser, isAdmin, requireCurrentUser } from "./lib/authorization";
import { DOCUMENT_RETENTION_MS, MAX_DOCUMENT_BYTES } from "./lib/trustPolicy";

export const claimUpload = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const lease = await ctx.db.query("ownershipUploadLeases").withIndex("by_token", q => q.eq("token", args.token)).unique();
    if (!lease || lease.userId !== user._id || lease.used || lease.expiresAt < Date.now())
      throw new Error("Upload expired");
    await ctx.db.patch(lease._id, { used: true });
    return lease;
  }
});

export const recordDocument = internalMutation({
  args: { leaseId: v.id("ownershipUploadLeases"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const lease = await ctx.db.get(args.leaseId);
    if (!lease || !lease.used || lease.userId !== user._id || lease.expiresAt < Date.now())
      throw new Error("Upload expired");
    const id = await ctx.db.insert("ownershipDocuments", {
      userId: user._id, vehicleId: lease.vehicleId, storageId: args.storageId, status: "pending", createdAt: Date.now(), expiresAt: Date.now() + DOCUMENT_RETENTION_MS
    });
    await ctx.db.delete(lease._id);
    return id;
  }
});

export const authorizeDownload = internalMutation({
  args: { documentId: v.id("ownershipDocuments") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const document = await ctx.db.get(args.documentId);
    if (!user || !document || document.expiresAt < Date.now() || (document.userId !== user._id && !isAdmin(user)))
      throw new Error("Document unavailable");
    if (isAdmin(user))
      await ctx.db.insert("adminAuditLog", {
        actorId: user._id, targetUserId: document.userId, vehicleId: document.vehicleId, action: "ownership_document_accessed", source: "moderation", reason: "Authenticated private document review", createdAt: Date.now()
      });
    return document.storageId;
  }
});

export const authenticate = internalQuery({ args: {},
  handler: async (ctx) => { await requireCurrentUser(ctx); return true; } });
function responseHeaders(request: Request) {
  let allowed = "";
  try {
    if (process.env.APP_URL)
      allowed = new URL(process.env.APP_URL).origin;
  }
  catch { /* fail closed */ }
  const origin = request.headers.get("Origin");
  if (!allowed || (origin !== null && origin !== allowed))
    throw new Error("Origin unavailable");
  return {
    "Access-Control-Allow-Origin": allowed, "Vary": "Origin", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff"
  };
}

export const documentUpload = httpAction(async (ctx, request) => {
  let storageId;
  try {
    const headers = responseHeaders(request);
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204, headers: {
          ...headers, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Upload-Token"
        }
      });
    await ctx.runQuery(internal.trustDocuments.authenticate, {});
    const mime = request.headers.get("Content-Type")?.split(";")[0];
    if (!mime || !["application/pdf", "image/jpeg", "image/png"].includes(mime))
      throw new Error("Unsupported document type");
    const token = request.headers.get("X-Upload-Token");
    if (!token)
      throw new Error("Upload token missing");
    const declared = Number(request.headers.get("Content-Length"));
    if (declared > MAX_DOCUMENT_BYTES)
      throw new Error("Document too large");
    const lease = await ctx.runMutation(internal.trustDocuments.claimUpload, { token });
    const reader = request.body?.getReader();
    if (!reader)
      throw new Error("Document missing");
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let total = 0;
    while (true) {
      const part = await reader.read();
      if (part.done)
        break;
      total += part.value.byteLength;
      if (total > MAX_DOCUMENT_BYTES) {
        await reader.cancel();
        throw new Error("Document too large");
      }
      chunks.push(new Uint8Array(part.value));
    }
    if (!total)
      throw new Error("Document missing");
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const valid = mime === "application/pdf" ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-" : mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    if (!valid)
      throw new Error("Document format mismatch");
    storageId = await ctx.storage.store(new Blob([bytes], { type: `${mime}; gearboxe=ownership-document` }));
    const documentId = await ctx.runMutation(internal.trustDocuments.recordDocument, { leaseId: lease._id, storageId });
    return Response.json({ documentId }, { headers });
  }
  catch {
    if (storageId)
      await ctx.storage.delete(storageId);
    return Response.json({ error: "Upload failed. Retry with a PDF, JPEG or PNG up to 10 MiB." }, { status: 400 });
  }
});

export const documentDownload = httpAction(async (ctx, request) => {
  try {
    const headers = responseHeaders(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id)
      throw new Error("Document missing");
    const storageId = await ctx.runMutation(internal.trustDocuments.authorizeDownload, { documentId: id as import("./_generated/dataModel").Id<"ownershipDocuments"> });
    const blob = await ctx.storage.get(storageId);
    if (!blob)
      throw new Error("Document missing");
    return new Response(blob, {
      headers: {
        ...headers, "Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=ownership-document"
      }
    });
  }
  catch {
    return new Response("Document unavailable", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
});
