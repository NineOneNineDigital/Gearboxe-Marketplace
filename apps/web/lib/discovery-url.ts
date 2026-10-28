/** The URL is the shareable source of truth for inventory discovery. */
import { isVehicleFacetValue, type VehicleFacetFilters } from "./vehicle-facets";

export interface DiscoveryFilters extends VehicleFacetFilters {
  search?: string;
  make?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  maxMileage?: number;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
}
export const discoverySorts = [
  "newest",
  "price-low",
  "price-high",
  "mileage-low",
  "mileage-high",
  "year-new",
  "year-old",
] as const;
export type DiscoverySort = (typeof discoverySorts)[number];
export interface DiscoveryState {
  filters: DiscoveryFilters;
  sort: DiscoverySort;
}

export function readDiscoveryUrl(
  params: Pick<URLSearchParams, "get">,
): DiscoveryState {
  const filters: DiscoveryFilters = {};
  for (const key of ["search", "make", "model"] as const) {
    const value = params
      .get(key)
      ?.trim()
      .slice(0, key === "search" ? 120 : 60);
    if (value) filters[key] = value;
  }
  for (const field of ["bodyStyle", "fuelType", "transmission", "titleStatus"] as const) {
    const value = params.get(field)?.trim();
    if (value && isVehicleFacetValue(field, value)) filters[field] = value;
  }
  for (const key of [
    "minPrice",
    "maxPrice",
    "minYear",
    "maxYear",
    "maxMileage",
  ] as const) {
    const raw = params.get(key);
    const value = raw === null || raw.trim() === "" ? NaN : Number(raw);
    const min = key.includes("Year") ? 1886 : 0;
    const max = key.includes("Year")
      ? new Date().getFullYear() + 1
      : key === "maxMileage"
        ? 2_000_000
        : 100_000_000;
    if (
      Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!key.includes("Year") || Number.isInteger(value))
    )
      filters[key] = value;
  }
  if (
    filters.minPrice !== undefined &&
    filters.maxPrice !== undefined &&
    filters.minPrice > filters.maxPrice
  )
    delete filters.maxPrice;
  if (
    filters.minYear !== undefined &&
    filters.maxYear !== undefined &&
    filters.minYear > filters.maxYear
  )
    delete filters.maxYear;
  const state = params.get("state")?.trim().toUpperCase();
  if (state && /^[A-Z]{2}$/.test(state)) filters.state = state;
  const latitudeRaw = params.get("latitude"),
    longitudeRaw = params.get("longitude");
  const latitude = latitudeRaw?.trim() ? Number(latitudeRaw) : NaN;
  const longitude = longitudeRaw?.trim() ? Number(longitudeRaw) : NaN;
  if (
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
  ) {
    filters.latitude = latitude;
    filters.longitude = longitude;
    const radiusRaw = params.get("radiusMiles");
    const radius = radiusRaw?.trim() ? Number(radiusRaw) : NaN;
    filters.radiusMiles =
      Number.isFinite(radius) && radius >= 1 && radius <= 500 ? radius : 50;
    const zip = params.get("zip")?.trim();
    if (zip && /^\d{5}$/.test(zip)) filters.zip = zip;
  }
  const requestedSort = params.get("sort");
  const sort: DiscoverySort =
    discoverySorts.find((value) => value === requestedSort) ?? "newest";
  return { filters, sort };
}

export function discoveryUrl(
  filters: DiscoveryFilters,
  sort: DiscoverySort = "newest",
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  if (sort !== "newest") params.set("sort", sort);
  const normalized = readDiscoveryUrl(params);
  const clean = new URLSearchParams();
  for (const [key, value] of Object.entries(normalized.filters))
    clean.set(key, String(value));
  if (normalized.sort !== "newest") clean.set("sort", normalized.sort);
  return `/vehicles${clean.size ? `?${clean}` : ""}`;
}
