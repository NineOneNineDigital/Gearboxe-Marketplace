import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertUploadMetadata, MAX_UPLOAD_BYTES } from "./lib/mediaPolicy";
import type { Id } from "./_generated/dataModel";

export const upload = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin");
  let allowed: string | undefined;
  try { if (process.env.APP_URL) allowed = new URL(process.env.APP_URL).origin; }
  catch { /* Missing/invalid configuration fails closed below. */ }
  const headers = { "Access-Control-Allow-Origin": allowed ?? "", "Vary": "Origin", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if (!allowed || origin !== allowed) return new Response("Upload origin not allowed", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600" } });
  let mediaId: Id<"vehicleMedia"> | undefined;
  let sourceId: Id<"_storage"> | undefined;
  try {
    const mime = request.headers.get("Content-Type") ?? "";
    // Check declared type immediately; the actual bounded stream and decoded
    // image are checked separately, so spoofed headers never make a public photo.
    assertUploadMetadata(mime, 1);
    const length = request.headers.get("Content-Length");
    if (length !== null) assertUploadMetadata(mime, Number(length));
    const token = new URL(request.url).searchParams.get("token");
    if (!token || !/^[0-9a-f-]{36}$/.test(token)) throw new Error("Invalid upload link");
    mediaId = await ctx.runMutation(internal.mediaRecords.claimUpload, { token });
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Photo data is missing");
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let total = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_UPLOAD_BYTES) { await reader.cancel(); throw new Error("Photos must be no larger than 10 MiB"); }
      chunks.push(new Uint8Array(part.value));
    }
    assertUploadMetadata(mime, total);
    sourceId = await ctx.storage.store(new Blob(chunks, { type: `${mime}; gearboxe=vehicle-media` }));
    await ctx.runMutation(internal.mediaRecords.recordSource, { mediaId, storageId: sourceId });
    return Response.json({ storageId: sourceId }, { headers });
  } catch {
    if (sourceId) await ctx.storage.delete(sourceId);
    if (mediaId) await ctx.runMutation(internal.mediaRecords.discard, { mediaId });
    return Response.json({ error: "Upload failed. Use a JPEG, PNG or WebP photo up to 10 MiB and retry." }, { status: 400, headers });
  }
});
