// Prices and refund eligibility are computed on the server, never submitted by a buyer.
export const EVENT_FEE_CENTS = 4_900;
export const RESERVATION_MS = 35 * 60_000;
export function eventFee(event: { registrationFeeCents?: number }) {
  const configured = process.env.EVENT_REGISTRATION_PRICE_CENTS;
  if (event.registrationFeeCents === undefined && !configured?.trim()) throw new Error("Event registration fee is not configured");
  const amount = event.registrationFeeCents ?? Number(configured);
  if (!Number.isSafeInteger(amount) || amount < 50 || amount > 99_999_999) throw new Error("Invalid event registration fee");
  return amount;
}
function calendarDay(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(timestamp);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000;
}
// Seven calendar days before the event is inclusive through that local day.
export function canRefundEvent(event: { date: number; timeZone?: string }, now = Date.now()) {
  return calendarDay(event.date, event.timeZone ?? "America/New_York") - calendarDay(now, event.timeZone ?? "America/New_York") >= 7;
}

// A deadline closes new reservations. A previously authorized hold retains its
// original fee and 35-minute payment window, even when the deadline passes.
export function acceptsNewRegistrations(event: { date: number; cancelledAt?: number; registrationDeadline?: number }, now = Date.now()) {
  return event.cancelledAt === undefined && event.date > now && (event.registrationDeadline === undefined || event.registrationDeadline > now);
}
