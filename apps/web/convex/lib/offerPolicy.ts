export const RESPONSE_MS = 48 * 60 * 60 * 1000;
export const REVIEW_MS = 7 * 24 * 60 * 60 * 1000;

export function priceInCents(dollars: number) {
  if (!Number.isSafeInteger(dollars) || dollars < 1 || dollars > 100_000_000)
    throw new Error("Enter a whole-dollar price between $1 and $100,000,000");
  return dollars * 100;
}

// Six UTC calendar months, clamped to the last day of the destination month.
export function purgeDeadline(closedAt: number) {
  const date = new Date(closedAt);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const end = new Date(date);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(day, end.getUTCDate()));
  return date.getTime();
}

export function effectiveClosure(expiresAt: number, cycleClosedAt: number | undefined, now: number) {
  if (expiresAt <= now && (cycleClosedAt === undefined || expiresAt <= cycleClosedAt))
    return { status: "expired" as const, at: expiresAt };
  if (cycleClosedAt !== undefined && cycleClosedAt <= now)
    return { status: "listing_closed" as const, at: cycleClosedAt };
  return null;
}
