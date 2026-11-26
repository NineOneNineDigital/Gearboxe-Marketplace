import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertUploadMetadata, MAX_UPLOAD_BYTES } from "./lib/mediaPolicy";
import { allowedHttpOrigin } from "./lib/httpOrigin";
import type { Id } from "./_generated/dataModel";

function headersFor(request: Request) {
  const origin = request.headers.get("Origin");
  let allowed = allowedHttpOrigin(origin, { APP_URL: process.env.APP_URL,
    DEV_PREVIEW_APP_URL: process.env.DEV_PREVIEW_APP_URL, MARKETPLACE_ENV: process.env.MARKETPLACE_ENV }, true);
  if (!allowed && origin && process.env.ADMIN_PORTAL_URL) {
    try { if (new URL(process.env.ADMIN_PORTAL_URL).origin === origin) allowed = origin; }
    catch { /* Invalid administrator origin fails closed. */ }
  }
  if (!allowed) throw new Error("Origin unavailable");
  return { "Access-Control-Allow-Origin": allowed, Vary: "Origin", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
}

export const upload = httpAction(async (ctx, request) => {
  let sourceId: Id<"_storage"> | undefined;
  let photoId: Id<"photoRequestPhotos"> | undefined;
  try {
    const headers = headersFor(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
    const mime = request.headers.get("Content-Type")?.split(";")[0] ?? "";
    assertUploadMetadata(mime, 1);
    const declared = request.headers.get("Content-Length");
    if (declared) assertUploadMetadata(mime, Number(declared));
    const token = new URL(request.url).searchParams.get("token");
    if (!token || !/^[0-9a-f-]{36}$/.test(token)) throw new Error("Upload unavailable");
    photoId = await ctx.runMutation(internal.photoRequestMedia.claimUpload, { token });
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Photo missing");
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let total = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_UPLOAD_BYTES) { await reader.cancel(); throw new Error("Photo too large"); }
      chunks.push(new Uint8Array(part.value));
    }
    assertUploadMetadata(mime, total);
    sourceId = await ctx.storage.store(new Blob(chunks, { type: `${mime}; gearboxe=photo-request-private` }));
    await ctx.runMutation(internal.photoRequestMedia.recordSource, { photoId, storageId: sourceId });
    return Response.json({ storageId: sourceId }, { headers });
  } catch {
    if (sourceId) await ctx.storage.delete(sourceId);
    if (photoId) await ctx.runMutation(internal.photoRequestMedia.discard, { photoId });
    return Response.json({ error: "Upload failed. Use a JPEG, PNG or WebP photo up to 10 MiB and retry." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
});

export const download = httpAction(async (ctx, request) => {
  try {
    const headers = headersFor(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Authorization" } });
    const photoId = new URL(request.url).searchParams.get("id");
    if (!photoId) throw new Error("Photo unavailable");
    const storageId = await ctx.runMutation(internal.photoRequestMedia.authorizePhoto, { photoId: photoId as Id<"photoRequestPhotos"> });
    const blob = await ctx.storage.get(storageId);
    if (!blob) throw new Error("Photo unavailable");
    return new Response(blob, { headers: { ...headers, "Content-Type": "image/webp", "Content-Disposition": "inline; filename=private-vehicle-reply.webp" } });
  } catch {
    return new Response("Photo unavailable", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
});
