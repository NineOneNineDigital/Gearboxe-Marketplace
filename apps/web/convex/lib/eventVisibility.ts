import type { Doc } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { getCurrentUser, isAdmin } from "./authorization";

// Curated operational contacts can include a personal staff phone number. Keep
// those private unless the administrator deliberately marks the contact public.
export async function eventForViewer(ctx: QueryCtx | MutationCtx, event: Doc<"events">, knownUser?: Doc<"users"> | null): Promise<Doc<"events">> {
  const user = knownUser === undefined ? await getCurrentUser(ctx) : knownUser;
  let authorized = !!user && isAdmin(user);
  if (user && !authorized) {
    const [assignment, paid, refundPending] = await Promise.all([
      ctx.db.query("eventStaff").withIndex("by_event_user", q => q.eq("eventId", event._id).eq("userId", user._id)).unique(),
      ctx.db.query("registrations").withIndex("by_event_user_status", q => q.eq("eventId", event._id).eq("userId", user._id).eq("paymentStatus", "completed")).first(),
      ctx.db.query("registrations").withIndex("by_event_user_status", q => q.eq("eventId", event._id).eq("userId", user._id).eq("paymentStatus", "refund_pending")).first(),
    ]);
    authorized = (!!assignment && user.suspendedAt === undefined) || !!paid || !!refundPending;
  }
  return { ...event,
    onSiteContact: authorized || event.onSiteContactVisibility === "public" ? event.onSiteContact : undefined,
    cancellationReason: authorized ? event.cancellationReason : undefined,
  };
}
