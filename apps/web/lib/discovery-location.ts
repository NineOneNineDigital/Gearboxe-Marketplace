import type { DiscoveryFilters } from "./discovery-url";

export const REMEMBERED_ZIP_KEY = "gearboxe.discovery.zip";

export function withoutGeography(filters: DiscoveryFilters): DiscoveryFilters {
  const next = { ...filters };
  delete next.state;
  delete next.zip;
  delete next.latitude;
  delete next.longitude;
  delete next.radiusMiles;
  return next;
}

export function readRememberedZip(storage: Pick<Storage, "getItem">): string | null {
  const zip = storage.getItem(REMEMBERED_ZIP_KEY);
  return zip && /^\d{5}$/.test(zip) ? zip : null;
}
