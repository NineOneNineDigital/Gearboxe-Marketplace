export async function wantedAreaForZip(zip: string): Promise<string> {
  if (!/^\d{5}$/.test(zip)) throw new Error("Enter a five-digit ZIP code.");
  const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (response.status === 404) throw new Error("ZIP code not found.");
  if (!response.ok) throw new Error("ZIP lookup is unavailable. Try again.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("places" in data)) throw new Error("ZIP lookup is unavailable. Try again.");
  const place = Array.isArray(data.places) ? data.places[0] : undefined;
  const city = place?.["place name"];
  const state = place?.["state abbreviation"];
  if (typeof city !== "string" || typeof state !== "string" || !/^[A-Z]{2}$/.test(state)) throw new Error("ZIP lookup is unavailable. Try again.");
  return `${city}, ${state}`;
}
