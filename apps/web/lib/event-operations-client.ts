export type PendingCheckIn = { eventId: string; registrationId: string; requestId: string; expectedRevision: number; queuedAt: number };
export const MAX_PENDING_CHECK_INS = 40;
export const PENDING_CHECK_IN_TTL = 15 * 60_000;
export function readPendingCheckIns(serialized: string | null, eventId: string, now: number): PendingCheckIn[] {
  try {
    const rows: unknown = JSON.parse(serialized ?? "[]");
    if (!Array.isArray(rows)) return [];
    return rows.filter((row): row is PendingCheckIn => !!row && typeof row === "object" && row.eventId === eventId && typeof row.registrationId === "string" && row.registrationId.length <= 100 && typeof row.requestId === "string" && /^[a-f0-9-]{36}$/i.test(row.requestId) && Number.isInteger(row.expectedRevision) && row.expectedRevision >= 0 && Number.isFinite(row.queuedAt) && row.queuedAt <= now && row.queuedAt > now - PENDING_CHECK_IN_TTL).slice(0, MAX_PENDING_CHECK_INS).map(row => ({ eventId: row.eventId, registrationId: row.registrationId, requestId: row.requestId, expectedRevision: row.expectedRevision, queuedAt: row.queuedAt }));
  } catch { return []; }
}
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function isNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch failed|failed to fetch|connection|offline|socket|timed? ?out/i.test(message) && !/unauthor|forbidden|permission|access denied/i.test(message);
}
