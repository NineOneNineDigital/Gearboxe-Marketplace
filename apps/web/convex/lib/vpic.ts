import type { DecodedVehicle, VinDecoder } from "./vinDecoder";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseVpicResponse(payload: unknown, vin: string): DecodedVehicle {
  if (!payload || typeof payload !== "object") throw new Error("VIN decoder returned an invalid response");
  const results = (payload as { Results?: unknown }).Results;
  if (!Array.isArray(results) || results.length !== 1 || !results[0] || typeof results[0] !== "object") {
    throw new Error("VIN decoder returned an invalid response");
  }
  const data = results[0] as Record<string, unknown>;
  // A partial decode, suggested VIN, or checksum/identity error must never confer verification.
  if (data.VIN !== vin || text(data.ErrorCode) !== "0" || text(data.SuggestedVIN)) {
    throw new Error("VIN decoder could not uniquely validate this VIN; enter specifications for manual review");
  }
  const year = Number(data.ModelYear);
  const make = text(data.Make); const model = text(data.Model);
  if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1 || !make || !model) {
    throw new Error("VIN decoder returned incomplete vehicle identity");
  }
  const result: DecodedVehicle = { vin, year, make, model };
  for (const [key, source] of [["trim", "Trim"], ["bodyStyle", "BodyClass"], ["transmission", "TransmissionStyle"], ["drivetrain", "DriveType"], ["fuelType", "FuelTypePrimary"]] as const) {
    const value = text(data[source]);
    if (value) result[key] = value;
  }
  const engine = [text(data.DisplacementL) ? `${text(data.DisplacementL)} L` : undefined,
    text(data.EngineCylinders) ? `${text(data.EngineCylinders)} cylinders` : undefined,
    text(data.EngineConfiguration), text(data.EngineModel)].filter(Boolean).join(" · ");
  if (engine) result.engine = engine;
  return result;
}

export async function fetchVpicDecode(vin: string, request: typeof fetch = fetch): Promise<DecodedVehicle> {
  let response: Response;
  try {
    response = await request(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new Error("VIN decoding is temporarily unavailable; try again or enter details manually"); }
  if (!response.ok) {
    if (response.status === 429) throw new Error("VIN decoder rate limit reached; try again later");
    if (response.status === 400 || response.status === 404) throw new Error("VIN decoder could not decode this VIN");
    throw new Error("VIN decoding is temporarily unavailable; enter details manually");
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error("VIN decoder returned an invalid response"); }
  return parseVpicResponse(payload, vin);
}

export function vpicDecoder(): VinDecoder {
  return { decode: vin => fetchVpicDecode(vin) };
}
