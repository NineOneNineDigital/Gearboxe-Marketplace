import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { key, words, geoScopes } from "./discoveryPolicy";

// Public identity terms only. No VIN, contact details, disclosures or draft text.
export async function syncDiscovery(ctx: MutationCtx, id: Id<"vehicles">) {
  const [old, postings, vehicle] = await Promise.all([
    ctx.db.query("vehicleCatalog").withIndex("by_vehicle", q => q.eq("vehicleId", id)).unique(),
    ctx.db.query("vehicleSearchTerms").withIndex("by_vehicle", q => q.eq("vehicleId", id)).take(4096),
    ctx.db.get(id),
  ]);
  for (const posting of postings) await ctx.db.delete(posting._id);
  if (!vehicle || !["active", "approved"].includes(vehicle.status)) {
    if (old) await ctx.db.delete(old._id);
    return;
  }
  const searchWords = [...new Set(words([vehicle.title, vehicle.make, vehicle.model, vehicle.trim, vehicle.bodyStyle].filter(Boolean).join(" ")))];
  if (searchWords.length > 512) throw new Error("Listing identity has too many search terms");
  let sitemapShard = vehicle.discoverySitemapShard;
  if (sitemapShard === undefined) {
    const counter = await ctx.db.query("discoveryCounters").withIndex("by_key", q => q.eq("key", "sitemap")).unique();
    const next = counter?.next ?? 0;
    sitemapShard = Math.floor(next / 500);
    if (counter) await ctx.db.patch(counter._id, { next: next + 1 });
    else await ctx.db.insert("discoveryCounters", { key: "sitemap", next: next + 1 });
    await ctx.db.patch(id, { discoverySitemapShard: sitemapShard });
  }
  const fields = catalogFields(vehicle, searchWords, sitemapShard);
  if (old) await ctx.db.patch(old._id, fields);
  else await ctx.db.insert("vehicleCatalog", fields);
  const scopes = ["", `m:${fields.makeKey}`, `s:${fields.state}`, `m:${fields.makeKey}|s:${fields.state}`];
  for (const token of ["", ...searchWords]) for (const scope of new Set(scopes)) await ctx.db.insert("vehicleSearchTerms", { ...fields, token, scope });
  if (fields.latitude !== undefined && fields.longitude !== undefined) for (const scope of geoScopes(fields.latitude, fields.longitude)) await ctx.db.insert("vehicleSearchTerms", { ...fields, token: "", scope });
}
function catalogFields(vehicle: Doc<"vehicles">, searchWords: string[], sitemapShard: number) {
  return { vehicleId: vehicle._id, makeKey: key(vehicle.make), modelKey: key(vehicle.model),
    state: vehicle.location?.state ?? vehicle.sellerState ?? "", price: vehicle.price, year: vehicle.year,
    mileageMiles: vehicle.mileageUnit === "km" ? vehicle.mileage / 1.609344 : vehicle.mileage,
    listedAt: vehicle.createdAt, updatedAt: vehicle.updatedAt ?? vehicle.createdAt, searchWords, sitemapShard,
    latitude: vehicle.location?.latitude, longitude: vehicle.location?.longitude };
}
