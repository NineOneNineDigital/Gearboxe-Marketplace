// Investigation cues only. They never decide eligibility or change a listing.
export const DEALER_RISK_SAMPLE_LIMIT = 100;
export const DEALER_RISK_WINDOW_MS = 90 * 86_400_000;

type ListingEvidence = {
  status: string;
  createdAt: number;
  vin?: string;
  location?: { city: string; state: string };
  moderationHistory?: { toStatus: string; createdAt: number }[];
};

export function summarizeDealerRisk(rows: ListingEvidence[], openReports: number, now: number, truncated: boolean) {
  const current = rows.filter(row => ["pending", "active", "approved", "reserved"].includes(row.status));
  const recent = rows.filter(row => row.createdAt >= now - DEALER_RISK_WINDOW_MS ||
    row.moderationHistory?.some(entry => entry.toStatus === "pending" && entry.createdAt >= now - DEALER_RISK_WINDOW_MS));
  const vins = new Set<string>();
  let repeatedVin = false;
  const locations = new Map<string, number>();
  for (const row of current) {
    const vin = row.vin?.trim().toUpperCase();
    if (vin) { if (vins.has(vin)) repeatedVin = true; vins.add(vin); }
    const city = row.location?.city.trim().toLowerCase();
    const state = row.location?.state.trim().toUpperCase();
    if (city && state) {
      const key = `${city}|${state}`;
      locations.set(key, (locations.get(key) ?? 0) + 1);
    }
  }
  const sharedLocationCount = Math.max(0, ...locations.values());
  const flagged = current.length >= 5 || recent.length >= 5 ||
    (current.length >= 3 && (repeatedVin || openReports > 0));
  return { flagged, currentCount: current.length, recentCount: recent.length, repeatedVin,
    sharedLocationCount, openReports, truncated };
}
