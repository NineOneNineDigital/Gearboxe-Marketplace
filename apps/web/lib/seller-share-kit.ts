export type SellerShareListing = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  transmission?: string;
  drivetrain?: string;
  fuelType?: string;
  price: number;
  mileage: number;
  mileageUnit?: "mi" | "km";
  city?: string;
  state?: string;
  leadPhotoUrl?: string;
};

function present(value?: string) {
  return value?.trim() || undefined;
}

export function sellerShareLocation(listing: SellerShareListing): string | undefined {
  const city = present(listing.city);
  const state = present(listing.state);
  return city && state ? `${city}, ${state}` : undefined;
}

export function sellerShareName(listing: SellerShareListing): string {
  return [listing.year, present(listing.make), present(listing.model), present(listing.trim)]
    .filter(Boolean).join(" ");
}

export function sellerSharePrice(listing: SellerShareListing): string {
  return `$${listing.price.toLocaleString("en-US")}`;
}

export function sellerSharePost(listing: SellerShareListing, canonicalUrl: string): string {
  const facts = [
    sellerSharePrice(listing),
    `${listing.mileage.toLocaleString("en-US")} ${listing.mileageUnit ?? "mi"}`,
    present(listing.transmission),
    present(listing.drivetrain),
    present(listing.fuelType),
    sellerShareLocation(listing),
  ].filter(Boolean);
  return `${sellerShareName(listing)}\n${facts.join(" · ")}\nView listing: ${canonicalUrl}`;
}

export function sellerCardText(listing: SellerShareListing) {
  return {
    name: [listing.year, present(listing.make), present(listing.model)].filter(Boolean).join(" "),
    price: sellerSharePrice(listing),
    city: present(listing.city) || "",
  };
}
