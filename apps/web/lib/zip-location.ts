export interface ZipLocation {
  latitude: number;
  longitude: number;
}

export async function lookupZip(zip: string): Promise<ZipLocation> {
  if (!/^\d{5}$/.test(zip)) throw new Error("Enter a five-digit ZIP code.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      signal: controller.signal,
    });
    if (response.status === 404) throw new Error("ZIP code not found.");
    if (!response.ok) throw new Error("ZIP lookup is unavailable. Try again.");

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("places" in data)) {
      throw new Error("ZIP lookup is unavailable. Try again.");
    }
    const places = data.places;
    const place = Array.isArray(places) ? places[0] : undefined;
    const rawLatitude = place?.latitude;
    const rawLongitude = place?.longitude;
    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    if (
      !place ||
      (typeof rawLatitude !== "string" && typeof rawLatitude !== "number") ||
      (typeof rawLongitude !== "string" && typeof rawLongitude !== "number") ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new Error("ZIP lookup is unavailable. Try again.");
    }
    return { latitude, longitude };
  } catch (error) {
    if (error instanceof Error && /^(Enter a five-digit ZIP code|ZIP code not found|ZIP lookup is unavailable)/.test(error.message)) {
      throw error;
    }
    throw new Error("ZIP lookup is unavailable. Try again.");
  } finally {
    clearTimeout(timeout);
  }
}
