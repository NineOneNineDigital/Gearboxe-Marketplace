export interface VehicleValues {
  title?: string; make?: string; model?: string; year?: number; mileage?: number; price?: number;
  vin?: string; photos?: string[]; description?: string; contactInfo?: string;
  trim?: string; bodyStyle?: string; engine?: string; transmission?: string; drivetrain?: string;
  fuelType?: string; exteriorColor?: string; interiorColor?: string; mileageUnit?: string;
  odometerStatus?: string; titleStatus?: string; sellerState?: string; condition?: string;
  mechanicalIssues?: string; accidentDisclosure?: string; damageDisclosure?: string;
  numberOfOwners?: number; serviceRecords?: string; modifications?: string; sellerType?: string;
  location?: {city: string; state: string; postalCode?: string; latitude?: number; longitude?: number}; features?: string[]; negotiable?: boolean;
}
export function validateVehicle(values: VehicleValues, complete = false) {
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" && value.length > 10_000) throw new Error(`${key} is too long`);
  }
  if (complete) {
    for (const field of ["title", "make", "model", "vin", "trim", "bodyStyle", "engine", "transmission", "drivetrain", "fuelType", "exteriorColor", "interiorColor", "mileageUnit", "odometerStatus", "titleStatus", "sellerState", "condition", "mechanicalIssues", "accidentDisclosure", "damageDisclosure", "serviceRecords", "modifications", "sellerType", "description", "contactInfo"] as const) {
      if (!values[field]?.trim()) throw new Error(`${field} is required; declare unknown or none where appropriate`);
    }
    if (!values.location?.city.trim() || !values.location.state.trim()) throw new Error("City and state are required");
    if (values.negotiable === undefined || !values.features) throw new Error("Features and negotiability must be declared");
    if (values.sellerType !== "private") throw new Error("The marketplace currently accepts private sellers only");
  }
  for (const [key, min, max] of [["title", 3, 120], ["make", 1, 60], ["model", 1, 60], ["description", 20, 10_000], ["contactInfo", 3, 320]] as const) {
    const value = values[key];
    if (value !== undefined && (value.length > max || (complete && value.trim().length < min))) throw new Error(`${key} must contain between ${min} and ${max} characters`);
  }
  if (values.year !== undefined && (!Number.isInteger(values.year) || values.year < (complete ? 1886 : 0) || values.year > new Date().getFullYear() + 1)) throw new Error("Vehicle year is invalid");
  if (values.mileage !== undefined && (!Number.isFinite(values.mileage) || values.mileage < 0 || values.mileage > 2_000_000)) throw new Error("Mileage is invalid");
  if (values.price !== undefined && (!Number.isFinite(values.price) || values.price < (complete ? 0.01 : 0) || values.price > 100_000_000)) throw new Error("Price is invalid");
  if (values.vin && (values.vin.length > 30 || (complete && !(values.year && values.year < 1981 ? /^[A-Z0-9-]{3,30}$/i : /^[A-HJ-NPR-Z0-9]{17}$/i).test(values.vin)))) throw new Error("VIN must be a valid 17-character VIN (pre-1981 vehicles may use a serial number)");
  if (values.numberOfOwners !== undefined && (!Number.isInteger(values.numberOfOwners) || values.numberOfOwners < 1 || values.numberOfOwners > 100)) throw new Error("Number of owners is invalid");
  for (const state of [values.sellerState, values.location?.state]) if (state && (state.length > 2 || (complete && !/^[A-Z]{2}$/.test(state)))) throw new Error("State must use its two-letter uppercase code");
  if (values.location && (values.location.city.length > 120 || (values.location.postalCode && (values.location.postalCode.length > 10 || (complete && !/^\d{5}(-\d{4})?$/.test(values.location.postalCode)))))) throw new Error("Location is invalid");
  if (values.location) {
    const { latitude, longitude } = values.location;
    if ((latitude === undefined) !== (longitude === undefined) || latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) || longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw new Error("Provide a valid pair of approximate location coordinates");
  }
  if (values.features && (values.features.length > 100 || values.features.some(f => !f.trim() || f.length > 120))) throw new Error("Features must contain at most 100 entries of 1–120 characters");
  if (values.photos && (values.photos.length > 30 || values.photos.some(p => p.length > 2048))) throw new Error("At most 30 valid photo references are allowed");
}
export function assertStatusTransition(from: string, to: string, admin: boolean, reason?: string) {
  if (from === "approved") from = "active";
  const transitions: Record<string, string[]> = {
    draft: ["pending", "withdrawn", "archived"], pending: ["draft", "active", "rejected", "withdrawn", "archived"],
    active: ["pending", "reserved", "sold", "withdrawn", "archived", "rejected"], rejected: ["draft", "pending", "withdrawn", "archived"],
    reserved: ["pending", "active", "sold", "withdrawn", "archived", "rejected"], sold: ["archived"], withdrawn: ["draft", "archived"], archived: ["draft"],
  };
  if (!transitions[from]?.includes(to)) throw new Error("Invalid listing status transition");
  if (!admin && (to === "rejected" || (to === "active" && from !== "reserved"))) throw new Error("Administrator approval is required");
  if (to === "rejected" && (!reason?.trim() || reason.length > 2000)) throw new Error("A rejection reason of 1–2,000 characters is required");
  if (reason && reason.length > 2000) throw new Error("Status reason is too long");
}
