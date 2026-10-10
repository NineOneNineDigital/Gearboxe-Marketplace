import { v } from "convex/values";

export const listingStatus = v.union(v.literal("draft"), v.literal("pending"), v.literal("active"), v.literal("rejected"), v.literal("reserved"), v.literal("sold"), v.literal("archived"));
// Transitional read support; new writes never use approved.
export const storedListingStatus = v.union(listingStatus, v.literal("approved"));
export const specificationFields = {
  trim: v.string(), bodyStyle: v.string(), engine: v.string(), transmission: v.string(),
  drivetrain: v.string(), fuelType: v.string(), exteriorColor: v.string(), interiorColor: v.string(),
  mileageUnit: v.union(v.literal("mi"), v.literal("km")),
  odometerStatus: v.union(v.literal("actual"), v.literal("exempt"), v.literal("not_actual")),
  titleStatus: v.union(v.literal("clean"), v.literal("rebuilt"), v.literal("salvage"), v.literal("flood"), v.literal("lemon"), v.literal("other"), v.literal("unknown")),
  sellerState: v.string(), condition: v.union(v.literal("excellent"), v.literal("good"), v.literal("fair"), v.literal("poor")),
  mechanicalIssues: v.string(), accidentDisclosure: v.string(), damageDisclosure: v.string(),
  numberOfOwners: v.optional(v.number()),
  serviceRecords: v.union(v.literal("available"), v.literal("partial"), v.literal("unavailable"), v.literal("unknown")),
  modifications: v.string(), sellerType: v.union(v.literal("private"), v.literal("dealer")),
  location: v.object({ city: v.string(), state: v.string(), postalCode: v.optional(v.string()) }),
  features: v.array(v.string()), negotiable: v.boolean(),
};
export const optionalSpecificationFields = {
  ...Object.fromEntries(Object.entries(specificationFields).map(([key, validator]) => [key, v.optional(validator)])),
} as { [K in keyof typeof specificationFields]: ReturnType<typeof v.optional<(typeof specificationFields)[K]>> };

export const moderationEntry = v.object({ fromStatus: v.optional(storedListingStatus), toStatus: storedListingStatus,
  reason: v.string(), actorId: v.id("users"), createdAt: v.number() });
export const decodedFields = { vin: v.string(), year: v.number(), make: v.string(), model: v.string(),
  trim: v.optional(v.string()), bodyStyle: v.optional(v.string()), engine: v.optional(v.string()),
  transmission: v.optional(v.string()), drivetrain: v.optional(v.string()), fuelType: v.optional(v.string()) };
