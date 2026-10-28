import { v } from "convex/values";
import { isVehicleFacetValue, type VehicleFacetFilters } from "../../lib/vehicle-facets";

export const discoveryFilters = v.object({
  search: v.optional(v.string()), make: v.optional(v.string()), model: v.optional(v.string()),
  bodyStyle: v.optional(v.string()), fuelType: v.optional(v.string()), transmission: v.optional(v.string()), titleStatus: v.optional(v.string()),
  minPrice: v.optional(v.number()), maxPrice: v.optional(v.number()),
  minYear: v.optional(v.number()), maxYear: v.optional(v.number()), maxMileage: v.optional(v.number()),
  state: v.optional(v.string()), zip: v.optional(v.string()), latitude: v.optional(v.number()), longitude: v.optional(v.number()), radiusMiles: v.optional(v.number()),
});
export const discoverySort = v.union(v.literal("newest"), v.literal("price-low"), v.literal("price-high"), v.literal("mileage-low"), v.literal("mileage-high"), v.literal("year-new"), v.literal("year-old"));
export type DiscoveryFilters = VehicleFacetFilters & { search?: string; make?: string; model?: string; minPrice?: number; maxPrice?: number; minYear?: number; maxYear?: number; maxMileage?: number; state?: string; zip?: string; latitude?: number; longitude?: number; radiusMiles?: number };
export type DiscoverySort = "newest" | "price-low" | "price-high" | "mileage-low" | "mileage-high" | "year-new" | "year-old";
export function words(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? []; }
export function key(value: string) { return words(value).join(" "); }
export function scopeKey(filters: DiscoveryFilters) {
  return [filters.make ? `m:${key(filters.make)}` : "", filters.state ? `s:${filters.state}` : ""].filter(Boolean).join("|");
}
export function validateFilters(input: DiscoveryFilters): DiscoveryFilters {
  for (const field of ["search", "make", "model"] as const) if (input[field] !== undefined && input[field]!.length > (field === "search" ? 120 : 60)) throw new Error(`${field} is too long`);
  const f = { ...input, search: input.search?.trim() || undefined, make: input.make?.trim() || undefined, model: input.model?.trim() || undefined, state: input.state?.trim().toUpperCase() || undefined };
  for (const [field, min, max] of [["minPrice", 0, 100_000_000], ["maxPrice", 0, 100_000_000], ["minYear", 1886, new Date().getFullYear() + 1], ["maxYear", 1886, new Date().getFullYear() + 1], ["maxMileage", 0, 2_000_000], ["latitude", -90, 90], ["longitude", -180, 180], ["radiusMiles", 1, 500]] as const) {
    const n = f[field]; if (n !== undefined && (!Number.isFinite(n) || n < min || n > max || ((field === "minYear" || field === "maxYear") && !Number.isInteger(n)))) throw new Error(`Invalid ${field}`);
  }
  if (f.minPrice !== undefined && f.maxPrice !== undefined && f.minPrice > f.maxPrice) throw new Error("Minimum price must not exceed maximum price");
  if (f.minYear !== undefined && f.maxYear !== undefined && f.minYear > f.maxYear) throw new Error("Minimum year must not exceed maximum year");
  if (f.state && !/^[A-Z]{2}$/.test(f.state)) throw new Error("Use a two-letter state code");
  for (const field of ["bodyStyle", "fuelType", "transmission", "titleStatus"] as const) {
    if (f[field] !== undefined && !isVehicleFacetValue(field, f[field])) throw new Error(`Invalid ${field}`);
  }
  if (f.zip !== undefined && !/^\d{5}$/.test(f.zip)) throw new Error("Use a five-digit ZIP code");
  const coordinates = [f.latitude, f.longitude, f.radiusMiles].filter(n => n !== undefined).length;
  if (coordinates !== 0 && coordinates !== 3) throw new Error("Distance search requires latitude, longitude and radius");
  if (f.zip !== undefined && coordinates !== 3) throw new Error("ZIP search requires a distance");
  return f;
}
export function distanceMiles(a: number, b: number, c: number, d: number) {
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
const geoWidths = [2, 8, 32, 128];
export function geoScopes(latitude: number, longitude: number) {
  return geoWidths.flatMap(width => {
    const y = Math.floor((latitude + 90) / width), x = Math.floor((longitude + 180) / width);
    return [`g:${width}:${y}:${x}`, `gy:${width}:${y}`];
  });
}
// Choose one indexed rectangle/latitude strip containing the entire circle.
// Exact distance is still checked afterward; boundary points are never lost.
export function geoScope(f: DiscoveryFilters) {
  if (f.radiusMiles === undefined) return "";
  const angular = f.radiusMiles / 3958.7613;
  const degrees = angular * 180 / Math.PI;
  const south = Math.max(-90, f.latitude! - degrees), north = Math.min(90, f.latitude! + degrees);
  const longitudeDelta = angular >= (90 - Math.abs(f.latitude!)) * Math.PI / 180 ? 180 : Math.asin(Math.min(1, Math.sin(angular) / Math.cos(f.latitude! * Math.PI / 180))) * 180 / Math.PI;
  const west = f.longitude! - longitudeDelta, east = f.longitude! + longitudeDelta;
  if (west >= -180 && east <= 180) for (const width of geoWidths) {
    const y = Math.floor((south + 90) / width), x = Math.floor((west + 180) / width);
    if (y === Math.floor((north + 90) / width) && x === Math.floor((east + 180) / width)) return `g:${width}:${y}:${x}`;
  }
  for (const width of geoWidths) {
    const y = Math.floor((south + 90) / width);
    if (y === Math.floor((north + 90) / width)) return `gy:${width}:${y}`;
  }
  return "";
}
export function matches(row: { searchWords: string[]; makeKey: string; state: string; modelKey: string; price: number; year: number; mileageMiles: number; latitude?: number; longitude?: number }, f: DiscoveryFilters) {
  if (f.make && row.makeKey !== key(f.make) || f.state && row.state !== f.state) return false;
  if (f.search && !words(f.search).every(word => row.searchWords.includes(word))) return false;
  if (f.model && row.modelKey !== key(f.model)) return false;
  if (f.minPrice !== undefined && row.price < f.minPrice || f.maxPrice !== undefined && row.price > f.maxPrice || f.minYear !== undefined && row.year < f.minYear || f.maxYear !== undefined && row.year > f.maxYear || f.maxMileage !== undefined && row.mileageMiles > f.maxMileage) return false;
  if (f.radiusMiles !== undefined && (row.latitude === undefined || row.longitude === undefined || distanceMiles(f.latitude!, f.longitude!, row.latitude, row.longitude) > f.radiusMiles)) return false;
  return true;
}
