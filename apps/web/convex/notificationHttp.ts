import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { escapeHtml } from "./lib/emailPolicy";
import { verifyAutosendSignature, webhookFingerprint } from "./lib/autosend";

const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff" };
const validToken = (token: string) => /^[a-f0-9-]{72}$/.test(token);
export const unsubscribe = httpAction(async (ctx, request) => {
  if (request.method === "GET") {
    const token = new URL(request.url).searchParams.get("token") || "";
    if (!validToken(token)) return new Response("Invalid unsubscribe link", { status: 400, headers });
    return new Response(`<html><body><h1>Turn off notification emails?</h1><p>You can still view notifications in your account and change email preferences there.</p><form method="POST" action="/notifications/unsubscribe"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">Turn off emails</button></form></body></html>`, { headers });
  }
  if (request.method !== "POST") return new Response(null, { status: 405, headers });
  // Email links are bearer capabilities. Confirming with POST prevents mail scanners
  // and link previews from changing preferences merely by fetching the link.
  const body = await readLimitedBody(request, 2048);
  if (body === null) return new Response("Request too large", { status: 413, headers });
  const token = new URLSearchParams(body).get("token") || "";
  if (!validToken(token)) return new Response("Invalid unsubscribe link", { status: 400, headers });
  const result = await ctx.runMutation(internal.emailRecords.unsubscribe, { token });
  return new Response(result ? "Notification emails are turned off. You can change this in your account preferences." : "This link has expired. Change email preferences in your account.", { status: result ? 200 : 400, headers });
});

export async function readLimitedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > limit) { await reader.cancel(); return null; }
    chunks.push(result.value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(combined);
}

export const autosendWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.AUTOSEND_WEBHOOK_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  const body = await readLimitedBody(request, 65536);
  if (body === null) return new Response(null, { status: 413 });
  if (!await verifyAutosendSignature(body, request.headers.get("X-Webhook-Signature"), secret)) return new Response(null, { status: 401 });
  let event: { type?: string; createdAt?: string; data?: { emailId?: string; to?: { email?: string }; bounceType?: string; test?: boolean } };
  try { event = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
  if (!event || typeof event !== "object" || typeof event.type !== "string" || !event.data || typeof event.data !== "object") return new Response(null, { status: 400 });
  if (event.data.test === true) return new Response(null, { status: 200 });
  if (!["email.sent", "email.delivered", "email.deferred", "email.bounced", "email.spam_reported", "email.unsubscribed", "email.group_unsubscribed"].includes(event.type)) return new Response(null, { status: 200 });
  if (typeof event.data.emailId !== "string" || !event.data.emailId || event.data.emailId.length > 256) return new Response(null, { status: 400 });
  // AutoSend signs only the body, not delivery-ID/timestamp headers. Hash the signed
  // body for replay deduplication; unsigned headers cannot supply the dedupe key.
  await ctx.runMutation(internal.emailRecords.recordWebhook, { eventKey: await webhookFingerprint(body), providerId: event.data.emailId, type: event.type, recipientEmail: typeof event.data.to?.email === "string" ? event.data.to.email : undefined, permanentBounce: event.data.bounceType === "Permanent" });
  return new Response(null, { status: 200 });
});
