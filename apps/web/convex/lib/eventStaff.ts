import type { Id, Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isAdmin, requireCurrentUser } from "./authorization";
import { assertEventAssignment } from "./eventOperationsPolicy";

export async function requireEventStaff(ctx: QueryCtx | MutationCtx, eventId: Id<"events">, manager = false) {
  const actor = await requireCurrentUser(ctx);
  const assignment = await ctx.db.query("eventStaff").withIndex("by_event_user", q => q.eq("eventId", eventId).eq("userId", actor._id)).unique();
  assertEventAssignment(isAdmin(actor), assignment?.role, manager);
  const event = await ctx.db.get(eventId);
  if (!event) throw new Error("Event not found");
  return { actor, event, role: isAdmin(actor) ? "manager" as const : assignment!.role };
}

export async function rosterRow(ctx: QueryCtx | MutationCtx, row: Doc<"registrations">) {
  const [vehicle, seller] = await Promise.all([ctx.db.get(row.vehicleId), ctx.db.get(row.userId)]);
  // Operational display deliberately excludes VIN, personal contact, QR tokens and payment references.
  return { registrationId: row._id, vehicleId: row.vehicleId, sellerName: seller?.name ?? "Unavailable seller", vehicleLabel: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Unavailable vehicle", paymentStatus: row.paymentStatus, checkedIn: row.checkedIn, revision: row.checkinRevision ?? 0 };
}
