import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { syncDiscovery } from "./lib/discoveryIndex";

const sellerExternalId = "seed:pagination-test-seller";
const titlePrefix = "Pagination Test";
const totalListings = 60;
const batchSize = 10;
const templates = [
  ["Toyota", "Camry", "Sedan", "Gasoline", "Automatic"],
  ["Honda", "Civic", "Sedan", "Gasoline", "CVT"],
  ["Ford", "F-150", "Truck", "Gasoline", "Automatic"],
  ["Subaru", "Outback", "Wagon", "Gasoline", "CVT"],
  ["Tesla", "Model 3", "Sedan", "Electric", "Automatic"],
  ["Jeep", "Wrangler", "SUV", "Gasoline", "Manual"],
  ["BMW", "330i", "Sedan", "Gasoline", "Automatic"],
  ["Chevrolet", "Equinox", "SUV", "Gasoline", "Automatic"],
  ["Mazda", "CX-5", "SUV", "Gasoline", "Automatic"],
  ["Hyundai", "Tucson", "SUV", "Hybrid", "Automatic"],
] as const;

function requireDevelopment() {
  if (process.env.MARKETPLACE_ENV !== "development") {
    throw new Error("Pagination test listings are allowed only in development");
  }
}

export const status = internalQuery({
  args: {},
  handler: async (ctx) => {
    requireDevelopment();
    const seller = await ctx.db.query("users")
      .withIndex("byExternalId", (q) => q.eq("externalId", sellerExternalId))
      .unique();
    if (!seller) return { count: 0 };
    const vehicles = await ctx.db.query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", seller._id))
      .take(totalListings + 1);
    return { count: vehicles.filter((vehicle) => vehicle.title.startsWith(titlePrefix)).length };
  },
});

/** Run batches with starts 0, 10, 20, 30, 40 and 50; rerunning a batch is safe. */
export const addBatch = internalMutation({
  args: { start: v.number() },
  handler: async (ctx, { start }) => {
    requireDevelopment();
    if (!Number.isInteger(start) || start < 0 || start >= totalListings || start % batchSize !== 0) {
      throw new Error("Batch start must be 0, 10, 20, 30, 40 or 50");
    }
    let seller = await ctx.db.query("users")
      .withIndex("byExternalId", (q) => q.eq("externalId", sellerExternalId))
      .unique();
    if (!seller) {
      const id = await ctx.db.insert("users", {
        externalId: sellerExternalId,
        name: "Pagination Test Seller",
        email: "pagination-test@example.invalid",
        role: "user",
        createdAt: Date.now(),
      });
      seller = await ctx.db.get(id);
    }
    if (!seller) throw new Error("Unable to create test seller");

    const existing = await ctx.db.query("vehicles")
      .withIndex("by_user", (q) => q.eq("userId", seller._id))
      .take(totalListings + 1);
    const existingTitles = new Set(existing.map((vehicle) => vehicle.title));
    const now = Date.now();
    let created = 0;
    for (let index = start; index < start + batchSize; index++) {
      const [make, model, bodyStyle, fuelType, transmission] = templates[index % templates.length];
      const year = 2016 + (index % 10);
      const title = `${titlePrefix} ${year} ${make} ${model} #${String(index + 1).padStart(2, "0")}`;
      if (existingTitles.has(title)) continue;
      const vehicleId = await ctx.db.insert("vehicles", {
        userId: seller._id,
        title,
        make,
        model,
        year,
        bodyStyle,
        fuelType,
        transmission,
        titleStatus: index % 7 === 0 ? "rebuilt" : "clean",
        condition: index % 4 === 0 ? "excellent" : "good",
        mileage: 18_000 + index * 2_200,
        mileageUnit: "mi",
        price: 12_000 + index * 1_500,
        photos: [],
        description: "Synthetic listing for testing inventory pagination. This vehicle is not for sale.",
        contactInfo: "Test listing — no seller contact",
        sellerType: "private",
        sellerState: "NC",
        location: {
          city: "Raleigh",
          state: "NC",
          latitude: 35.78 + (index % 5) * 0.01,
          longitude: -78.64 - (index % 5) * 0.01,
        },
        status: "active",
        createdAt: now + index,
        updatedAt: now + index,
      });
      await syncDiscovery(ctx, vehicleId);
      created++;
    }
    return { created, batchStart: start };
  },
});
