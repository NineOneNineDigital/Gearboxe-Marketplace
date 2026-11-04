/** Listing-facing contract. Provider payloads and credentials stay inside adapters. */
export interface DecodedVehicle {
  vin: string; year: number; make: string; model: string;
  trim?: string; bodyStyle?: string; engine?: string; transmission?: string; drivetrain?: string; fuelType?: string;
}

export interface VinDecoder {
  decode(vin: string): Promise<DecodedVehicle>;
}

export function normalizeVin(vin: string) {
  const normalized = vin.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) throw new Error("Enter a valid 17-character VIN to decode");
  return normalized;
}

export function selectVinDecoder(
  configuration: { VIN_DECODER_PROVIDER?: string; AUTO_DEV_API_KEY?: string },
  providers: { auto_dev: (key: string) => VinDecoder; vpic: () => VinDecoder },
): VinDecoder {
  const provider = configuration.VIN_DECODER_PROVIDER?.trim() || "auto_dev";
  if (provider === "vpic") return providers.vpic();
  if (provider !== "auto_dev") throw new Error("VIN decoder provider is not configured correctly; enter details manually");
  if (!configuration.AUTO_DEV_API_KEY) throw new Error("VIN decoding is not configured; enter vehicle details manually");
  return providers.auto_dev(configuration.AUTO_DEV_API_KEY);
}
