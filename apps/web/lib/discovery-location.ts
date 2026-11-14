import { discoveryUrl, type DiscoveryFilters, type DiscoverySort } from "./discovery-url";

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

// Resolve the ZIP before displaying shared-link results. Never trust location
// coordinates supplied alongside a ZIP in a URL.
export function resolvedZipUrl(filters: DiscoveryFilters, sort: DiscoverySort, zip: string,
  location: { latitude: number; longitude: number }, radiusMiles = 50) {
  return discoveryUrl({ ...withoutGeography(filters), zip, ...location, radiusMiles }, sort);
}
