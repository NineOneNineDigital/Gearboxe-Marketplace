import type { Metadata } from "next";
import { absoluteUrl, serializeJsonLd } from "@/lib/seo";
import { getPublicListingMetadata } from "@/lib/public-listing-seo";
import { isTrustedImageUrl } from "@/lib/trusted-images";
import VehicleDetailClient from "./vehicle-detail-client";

interface Props { params: Promise<{ id: string }> }
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { vehicle } = await getPublicListingMetadata(id);
  const url = absoluteUrl(`/vehicles/${encodeURIComponent(id)}`);
  if (!vehicle) return {
    title: "Vehicle listing | Gearboxe", alternates: { canonical: url },
    robots: { index: false, follow: true },
  };
  const title = `${vehicle.title} | Gearboxe`;
  const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(vehicle.price);
  const description = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""} for sale at ${price}. ${vehicle.mileage.toLocaleString("en-US")} ${vehicle.mileageUnit === "km" ? "kilometers" : "miles"}${vehicle.location ? ` in ${vehicle.location.city}, ${vehicle.location.state}` : ""}. Connect with the seller on Gearboxe.`;
  const image = vehicle.photoUrl && isTrustedImageUrl(vehicle.photoUrl) ? vehicle.photoUrl : absoluteUrl("/opengraph-image");
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, type: "website", url, siteName: "Gearboxe", images: [{ url: image, alt: vehicle.title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function VehiclePage({ params }: Props) {
  const { id } = await params;
  const { vehicle } = await getPublicListingMetadata(id);
  const jsonLd = vehicle ? {
    "@context": "https://schema.org", "@type": "Car", name: vehicle.title,
    brand: { "@type": "Brand", name: vehicle.make }, model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    mileageFromOdometer: { "@type": "QuantitativeValue", value: vehicle.mileage, unitCode: vehicle.mileageUnit === "km" ? "KMT" : "SMI" },
    ...(vehicle.photoUrl && isTrustedImageUrl(vehicle.photoUrl) ? { image: vehicle.photoUrl } : {}),
    offers: { "@type": "Offer", price: vehicle.price, priceCurrency: "USD", availability: "https://schema.org/InStock", url: absoluteUrl(`/vehicles/${encodeURIComponent(id)}`) },
  } : null;
  return <>
    {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}
    <VehicleDetailClient id={id} />
  </>;
}
