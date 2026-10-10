export interface DecodedVehicle {
  vin: string; year: number; make: string; model: string;
  trim?: string; bodyStyle?: string; engine?: string; transmission?: string; drivetrain?: string; fuelType?: string;
}
export function normalizeVin(vin: string) {
  const normalized = vin.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) throw new Error("Enter a valid 17-character VIN to decode");
  return normalized;
}
export function parseDecodeResponse(payload: unknown, vin: string): DecodedVehicle {
  if (!payload || typeof payload !== "object") throw new Error("Auto.dev returned an invalid response");
  const data = payload as Record<string, unknown>;
  const vehicle = data.vehicle as Record<string, unknown> | undefined;
  if (data.vinValid !== true || data.ambiguous === true || data.yearAmbiguous === true || data.vin !== vin || !vehicle || vehicle.vin !== vin || !Number.isInteger(vehicle.year) || Number(vehicle.year) < 1886 || Number(vehicle.year) > new Date().getFullYear() + 1) throw new Error("Auto.dev could not uniquely validate this VIN; enter specifications for manual review");
  const make = vehicle.make; const model = vehicle.model;
  if (typeof make !== "string" || !make.trim() || typeof model !== "string" || !model.trim()) throw new Error("Auto.dev returned incomplete vehicle identity");
  const result: DecodedVehicle = { vin, year: Number(vehicle.year), make, model };
  for (const [key, source] of [["trim", "trim"], ["bodyStyle", "body"], ["engine", "engine"], ["transmission", "transmission"], ["drivetrain", "drive"], ["fuelType", "fuelType"]] as const) {
    if (typeof data[source] === "string" && data[source].trim()) result[key] = data[source];
  }
  return result;
}
export async function fetchDecode(vin: string, apiKey: string, request: typeof fetch = fetch): Promise<DecodedVehicle> {
  let response: Response;
  try {
    response = await request(`https://api.auto.dev/vin/${normalizeVin(vin)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new Error("VIN decoding is temporarily unavailable; try again or enter details manually"); }
  if (!response.ok) {
    if (response.status === 404 || response.status === 400) throw new Error("Auto.dev could not decode this VIN");
    if (response.status === 429) throw new Error("VIN decoder rate limit reached; try again later");
    throw new Error("VIN decoding is temporarily unavailable; enter details manually");
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error("Auto.dev returned an invalid response"); }
  return parseDecodeResponse(payload, vin);
}
