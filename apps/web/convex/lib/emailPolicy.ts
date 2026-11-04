export const EMAIL_MAX_ATTEMPTS = 5;
export const EMAIL_LEASE_MS = 2 * 60_000;
export const EMAIL_TOKEN_TTL_MS = 90 * 86400_000;

export function normalizedEmail(email: string) { return email.trim().toLowerCase(); }
export function isEmailAddress(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/[\r\n]/.test(email); }
export function emailAllowed(user: { suspendedAt?: number; emailVerified?: boolean; notificationPreferences?: { emailEnabled: boolean; messages: boolean; listings: boolean; favorites: boolean; events: boolean } }, category: string) {
  if (user.suspendedAt !== undefined || !user.emailVerified || !["messages", "listings", "favorites", "events"].includes(category)) return false;
  const prefs = user.notificationPreferences;
  return !prefs || (prefs.emailEnabled && prefs[category as "messages" | "listings" | "favorites" | "events"]);
}
export function retryDelay(attempt: number, retryAfter: string | null, now = Date.now()) {
  const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : retryAfter ? Date.parse(retryAfter) - now : 0;
  return Math.min(86400_000, Math.max(30_000 * 2 ** Math.max(0, attempt - 1), Number.isFinite(seconds) ? seconds : 0));
}
export function safeOrigin(value: string | undefined) {
  if (!value) throw new Error("Email configuration is incomplete");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:";
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid email origin configuration");
  return url.origin;
}
export function safeNotificationPath(path: string) { return /^\/(?!\/)[^\r\n\\]*$/.test(path); }
export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!)); }
export function webhookStatus(type: string) {
  return ({ "email.sent": "accepted", "email.delivered": "delivered", "email.deferred": "deferred", "email.bounced": "bounced", "email.spam_reported": "complained" } as Record<string, string>)[type];
}
// Delivery events can arrive out of order. Terminal delivery failures never regress.
export function mergeDeliveryStatus(current: string, incoming: string) {
  const rank: Record<string, number> = { accepted: 1, deferred: 2, delivered: 3, bounced: 4, complained: 5 };
  return (rank[incoming] ?? 0) >= (rank[current] ?? 0) ? incoming : current;
}
