export const WANTED_LIFETIME_MS = 30 * 86_400_000;
export const WANTED_REMINDER_LEAD_MS = 3 * 86_400_000;

export function wantedExpiry(now: number) { return now + WANTED_LIFETIME_MS; }
export function wantedIsPublic(request: { status: string; expiresAt: number }, now: number) {
  return request.status === "active" && request.expiresAt > now;
}
export function wantedReminderDue(request: { status: string; expiresAt: number; remindedForExpiryAt?: number }, now: number) {
  return wantedIsPublic(request, now) && request.expiresAt - WANTED_REMINDER_LEAD_MS <= now && request.remindedForExpiryAt !== request.expiresAt;
}

export function wantedText(value: string, name: string, max: number) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > max) throw new Error(`${name} must be 1–${max} characters.`);
  return clean;
}
export function wantedPublicText(value: string, name: string, max: number, privateZip: string) {
  const clean = wantedText(value, name, max);
  if (clean.includes(privateZip) || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(clean) || /(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/.test(clean)) {
    throw new Error(`${name} cannot include your ZIP or contact information.`);
  }
  return clean;
}
export function wantedOptionalText(value: string | undefined, name: string, max: number) {
  return value?.trim() ? wantedText(value, name, max) : undefined;
}
export function wantedOptionalPublicText(value: string | undefined, name: string, max: number, privateZip: string) {
  return value?.trim() ? wantedPublicText(value, name, max, privateZip) : undefined;
}
export function wantedInteger(value: number, name: string, min: number, max: number) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
  return value;
}
export function wantedPublicProjection(request: {
  _id: string; title: string; maxBudget: number; area: string; radiusMiles?: number;
  make?: string; model?: string; yearMin?: number; yearMax?: number;
  maxMileage?: number; transmission?: string; details?: string; createdAt: number; expiresAt: number;
}) {
  const { _id, title, maxBudget, area, radiusMiles, make, model, yearMin, yearMax, maxMileage, transmission, details, createdAt, expiresAt } = request;
  return { _id, title, maxBudget, area, radiusMiles, make, model, yearMin, yearMax, maxMileage, transmission, details, createdAt, expiresAt };
}
