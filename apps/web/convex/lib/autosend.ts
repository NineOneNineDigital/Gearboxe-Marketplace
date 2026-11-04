import { escapeHtml, isEmailAddress, retryDelay, safeNotificationPath, safeOrigin } from "./emailPolicy";

export type SendOutcome = { status: "accepted" | "failed" | "uncertain" | "pending"; providerId?: string; error?: string; delayMs?: number };
export function autosendConfiguration(env: Record<string, string | undefined>) {
  if (!env.AUTOSEND_API_KEY || !env.AUTOSEND_FROM_EMAIL || !isEmailAddress(env.AUTOSEND_FROM_EMAIL)) throw new Error("Email configuration is incomplete");
  return { key: env.AUTOSEND_API_KEY, from: { email: env.AUTOSEND_FROM_EMAIL, name: env.AUTOSEND_FROM_NAME || "Gearboxe" }, appOrigin: safeOrigin(env.APP_URL), siteOrigin: safeOrigin(env.CONVEX_SITE_URL) };
}
export async function sendAutosend(config: ReturnType<typeof autosendConfiguration>, mail: { recipientEmail: string; subject: string; message: string; path: string; unsubscribeToken: string; attempts: number }, fetcher: typeof fetch = fetch): Promise<SendOutcome> {
  if (!isEmailAddress(mail.recipientEmail) || !safeNotificationPath(mail.path)) return { status: "failed", error: "invalid_payload" };
  const href = config.appOrigin + mail.path;
  const unsubscribe = `${config.siteOrigin}/notifications/unsubscribe?token=${encodeURIComponent(mail.unsubscribeToken)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetcher("https://api.autosend.com/v1/mails/send", {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: { email: mail.recipientEmail }, subject: mail.subject,
        text: `${mail.message}\n\nView notification: ${href}\n\nTurn off notification emails: ${unsubscribe}`,
        html: `<p>${escapeHtml(mail.message)}</p><p><a href="${escapeHtml(href)}">View notification</a></p><p><a href="${escapeHtml(unsubscribe)}">Turn off notification emails</a></p>`,
        trackingClick: false, trackingOpen: false, bypassSuppressions: false }),
    });
    if (response.status === 429) return { status: "pending", error: "provider_rate_limited", delayMs: retryDelay(mail.attempts, response.headers.get("Retry-After")) };
    if (response.status >= 500 || response.status === 408) return { status: "uncertain", error: `provider_http_${response.status}` };
    if (!response.ok) return { status: "failed", error: `provider_http_${response.status}` };
    const body = await response.json() as { success?: boolean; data?: { emailId?: string } };
    if (body.success !== true || typeof body.data?.emailId !== "string" || !body.data.emailId) return { status: "uncertain", error: "provider_response_invalid" };
    return { status: "accepted", providerId: body.data.emailId };
  } catch { return { status: "uncertain", error: "provider_connection_uncertain" }; }
  finally { clearTimeout(timeout); }
}

export async function hmacHex(body: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function verifyAutosendSignature(body: string, signature: string | null, secret: string) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature) || !secret) return false;
  const expected = await hmacHex(body, secret);
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= expected.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
  return difference === 0;
}
export async function webhookFingerprint(body: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
