export const vehicleFacetOptions = {
  bodyStyle: [
    ["suv", "SUV / crossover"],
    ["truck", "Truck"],
    ["sedan", "Sedan"],
    ["coupe", "Coupe"],
    ["hatchback", "Hatchback"],
    ["wagon", "Wagon"],
    ["convertible", "Convertible"],
    ["van", "Van / minivan"],
  ],
  fuelType: [
    ["gasoline", "Gasoline"],
    ["hybrid", "Hybrid"],
    ["plug-in-hybrid", "Plug-in hybrid"],
    ["electric", "Electric"],
    ["diesel", "Diesel"],
  ],
  transmission: [
    ["automatic", "Automatic"],
    ["manual", "Manual"],
  ],
  titleStatus: [
    ["clean", "Clean"],
    ["rebuilt", "Rebuilt"],
    ["salvage", "Salvage"],
    ["flood", "Flood"],
    ["lemon", "Lemon"],
    ["other", "Other"],
  ],
} as const;

export type VehicleFacet = keyof typeof vehicleFacetOptions;
export type VehicleFacetFilters = Partial<Record<VehicleFacet, string>>;

export function isVehicleFacetValue(field: VehicleFacet, value: string) {
  return vehicleFacetOptions[field].some(([option]) => option === value);
}

export function vehicleFacetLabel(field: VehicleFacet, value: string) {
  return vehicleFacetOptions[field].find(([option]) => option === value)?.[1] ?? value;
}

function bodyStyle(value: string) {
  if (/\bsuv\b|\bcuv\b|crossover|sport utility/i.test(value)) return "suv";
  if (/pickup|truck/i.test(value)) return "truck";
  if (/hatchback/i.test(value)) return "hatchback";
  if (/convertible|cabriolet|roadster/i.test(value)) return "convertible";
  if (/minivan|\bvan\b/i.test(value)) return "van";
  if (/wagon/i.test(value)) return "wagon";
  if (/coupe/i.test(value)) return "coupe";
  if (/sedan|saloon/i.test(value)) return "sedan";
  return "";
}

function fuelType(value: string) {
  if (/plug.?in.?hybrid|\bphev\b/i.test(value)) return "plug-in-hybrid";
  if (/electric/i.test(value) && /gasoline|\bgas\b|petrol/i.test(value)) return "hybrid";
  if (/hybrid|\bhev\b/i.test(value)) return "hybrid";
  if (/diesel/i.test(value)) return "diesel";
  if (/electric|\bbev\b/i.test(value)) return "electric";
  if (/gasoline|\bgas\b|petrol|flex.?fuel|\be85\b/i.test(value)) return "gasoline";
  return "";
}

function transmission(value: string) {
  if (/automatic|\bcvt\b|continuously variable|dual.?clutch|\bdct\b|automated/i.test(value)) return "automatic";
  if (/manual|stick/i.test(value)) return "manual";
  return "";
}

export function matchesVehicleFacets(
  vehicle: { bodyStyle?: string; fuelType?: string; transmission?: string; titleStatus?: string },
  filters: VehicleFacetFilters,
) {
  return (!filters.bodyStyle || bodyStyle(vehicle.bodyStyle ?? "") === filters.bodyStyle) &&
    (!filters.fuelType || fuelType(vehicle.fuelType ?? "") === filters.fuelType) &&
    (!filters.transmission || transmission(vehicle.transmission ?? "") === filters.transmission) &&
    (!filters.titleStatus || vehicle.titleStatus === filters.titleStatus);
}
