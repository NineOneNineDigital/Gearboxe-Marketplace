import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    for (const suffix of [".ts", ".js"]) {
      const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
} });

const { sellerSharePost, sellerCardText } = await import("../lib/seller-share-kit.ts");
const vehicles = await import("../convex/vehicles.ts");
const listing = {
  _id: "listing", userId: "seller", year: 2022, make: "Toyota", model: "RAV4", trim: "XLE",
  price: 26900, mileage: 41500, mileageUnit: "mi", transmission: "Automatic", drivetrain: "AWD",
  fuelType: "Gasoline", status: "active", photos: ["https://images.unsplash.com/approved-photo"],
  media: [], location: { city: "Raleigh", state: "NC", postalCode: "27601", latitude: 35.78 },
  vin: "PRIVATEVIN", contactInfo: "seller@example.com", description: "Private draft detail",
  availabilityDueAt: Date.now() + 86_400_000,
};

function context(actor = "seller", row = listing, userOverrides = {}) {
  return {
    auth: { getUserIdentity: async () => actor ? { subject: `clerk-${actor}` } : null },
    db: {
      get: async id => id === row._id ? row : null,
      query: () => ({ withIndex: () => ({ unique: async () => ({ _id: actor, externalId: `clerk-${actor}`, ...userOverrides }) }) }),
    },
    storage: { getUrl: async () => null },
  };
}

test("seller post and card use approved public fields and omit unavailable values", () => {
  const data = { id: "listing", year: 2022, make: "Toyota", model: "RAV4", trim: "XLE", price: 26900, mileage: 41500, city: "Raleigh", state: "NC" };
  const post = sellerSharePost(data, "https://gearboxemarket.com/vehicles/listing");
  assert.match(post, /2022 Toyota RAV4 XLE/);
  assert.match(post, /\$26,900 · 41,500 mi · Raleigh, NC/);
  assert.match(post, /https:\/\/gearboxemarket.com\/vehicles\/listing/);
  assert.doesNotMatch(post, /undefined|available|VIN|contact/i);
  assert.deepEqual(sellerCardText(data), { name: "2022 Toyota RAV4", price: "$26,900", city: "Raleigh" });
});

test("seller share projection rejects another account and any private or expired listing", async () => {
  const own = await vehicles.getSellerShareListing._handler(context(), { id: "listing" });
  assert.equal(own.leadPhotoUrl, listing.photos[0]);
  assert.deepEqual(Object.keys(own).sort(), ["id", "year", "make", "model", "trim", "transmission", "drivetrain", "fuelType", "price", "mileage", "mileageUnit", "city", "state", "leadPhotoUrl"].sort());
  const serialized = JSON.stringify(own);
  for (const secret of ["27601", "PRIVATEVIN", "seller@example.com", "latitude", "Private draft detail"]) assert.equal(serialized.includes(secret), false);
  assert.equal(await vehicles.getSellerShareListing._handler(context("other"), { id: "listing" }), null);
  for (const status of ["draft", "pending", "rejected", "sold", "withdrawn", "archived"]) {
    assert.equal(await vehicles.getSellerShareListing._handler(context("seller", { ...listing, status }), { id: "listing" }), null);
  }
  assert.equal(await vehicles.getSellerShareListing._handler(context("seller", { ...listing, availabilityDueAt: Date.now() - 1 }), { id: "listing" }), null);
  assert.equal(await vehicles.getSellerShareListing._handler(context("seller", { ...listing, moderationRemovedAt: Date.now() }), { id: "listing" }), null);
});

test("reserved public sharing omits availability, and seller deletion disables new share content", async () => {
  const reserved = await vehicles.getSellerShareListing._handler(context("seller", { ...listing, status: "reserved" }), { id: "listing" });
  assert.ok(reserved);
  assert.equal("status" in reserved, false);
  assert.doesNotMatch(sellerSharePost(reserved, "https://gearboxemarket.com/vehicles/listing"), /reserved|available/i);
  await assert.rejects(vehicles.getSellerShareListing._handler(context("seller", listing, { deletedAt: Date.now() }), { id: "listing" }), /Authentication required/);
});
