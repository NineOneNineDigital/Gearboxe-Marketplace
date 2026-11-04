import type { Metadata } from "next";

export function appOrigin(): URL {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) throw new Error("NEXT_PUBLIC_APP_URL is required for canonical URLs");
  const url = new URL(value);
  const mode = process.env.MARKETPLACE_ENV || (process.env.NODE_ENV === "development" ? "development" : "");
  const local = ["localhost", "127.0.0.1"].includes(url.hostname) &&
    ["development", "ci"].includes(mode);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a trusted application origin");
  }
  return url;
}

export function absoluteUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Canonical paths must be application-relative");
  return new URL(path, appOrigin()).href;
}

export function vehicleBrowseMetadata(filtered = false): Metadata {
  const title = "Vehicles for sale | Gearboxe";
  const description = "Find your next vehicle. Browse local listings by make, model, price, mileage, and location on Gearboxe.";
  const url = absoluteUrl("/vehicles");
  const image = absoluteUrl("/opengraph-image");
  return {
    title, description, alternates: { canonical: url },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, type: "website", url, siteName: "Gearboxe", images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
