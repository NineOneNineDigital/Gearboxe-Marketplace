import { v } from "convex/values";
import { internal } from "./_generated/api";
import { eventForViewer } from "./lib/eventVisibility";
import { getCurrentUser } from "./lib/authorization";
import { mutation, query } from "./_generated/server";
import { eventFee } from "./lib/eventPaymentPolicy";
import { ensureInventory } from "./eventBookings";
import { requireAdmin } from "./lib/authorization";

function validateEvent(values: {
  eventRules?: string;
  registrationDeadline?: number;
  vendorInstructions?: string;
  onSiteContact?: { name: string; phone: string; email?: string };
  onSiteContactVisibility?: "vendors" | "public";
  registrationFeeCents?: number;
  timeZone?: string;
  name?: string;
  date?: number;
  location?: string;
  address?: string;
  capacity?: number;
  description?: string;
}) {
  if (values.registrationDeadline !== undefined && (!Number.isFinite(values.registrationDeadline) || values.registrationDeadline <= 0 || (values.date !== undefined && values.registrationDeadline > values.date))) throw new Error("Registration deadline must be a valid timestamp at or before the event");
  if (values.onSiteContact) {
    if (!values.onSiteContact.name.trim() || values.onSiteContact.name.length > 120 || (!/^[+()0-9 .-]{7,40}$/.test(values.onSiteContact.phone) || values.onSiteContact.phone.replace(/\D/g, "").length < 7 || values.onSiteContact.phone.replace(/\D/g, "").length > 15) || (values.onSiteContact.email !== undefined && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.onSiteContact.email) || values.onSiteContact.email.length > 254))) throw new Error("Provide a contact name, valid phone and optional email");
  }
  if (values.registrationFeeCents !== undefined) eventFee(values);
  if (values.timeZone !== undefined) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: values.timeZone }).format(); }
    catch { throw new Error("Invalid event time zone"); }
  }
  for (const [label, value, max] of [
    ["Event rules", values.eventRules, 5000],
    ["Vendor instructions", values.vendorInstructions, 5000],
    ["Name", values.name, 120],
    ["Location", values.location, 200],
    ["Address", values.address, 300],
    ["Description", values.description, 5_000],
  ] as const) {
    if (value !== undefined && (!value.trim() || value.length > max)) {
      throw new Error(
        `${label} is required and must not exceed ${max} characters`
      );
    }
  }
  if (
    values.date !== undefined &&
    (!Number.isFinite(values.date) || values.date <= Date.now())
  ) {
    throw new Error("Event date must be in the future");
  }
  if (
    values.capacity !== undefined &&
    (!Number.isInteger(values.capacity) ||
      values.capacity < 1 ||
      values.capacity > 100_000)
  ) {
    throw new Error("Event capacity must be between 1 and 100,000");
  }
}

export const createEvent = mutation({
  args: {
    eventRules: v.optional(v.string()), registrationDeadline: v.optional(v.number()), vendorInstructions: v.optional(v.string()),
    onSiteContact: v.optional(v.object({ name: v.string(), phone: v.string(), email: v.optional(v.string()) })),
    onSiteContactVisibility: v.optional(v.union(v.literal("vendors"), v.literal("public"))),
    registrationFeeCents: v.optional(v.number()),
    timeZone: v.optional(v.string()),
    cityId: v.id("cities"),
    name: v.string(),
    date: v.number(),
    location: v.string(),
    address: v.string(),
    capacity: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validateEvent(args);
    const eventId = await ctx.db.insert("events", {
      ...args,
      createdAt: Date.now(),
    });
    await ctx.db.insert("eventInventories", { eventId, held: 0, confirmed: 0, attended: 0, waiting: 0 });
    return eventId;
  },
});

export const getEvents = query({
  args: {
    cityId: v.optional(v.id("cities")),
    upcoming: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const events = args.cityId
      ? await ctx.db
          .query("events")
          .withIndex("by_city", (q) => q.eq("cityId", args.cityId!))
          .collect()
      : await ctx.db.query("events").collect();

    if (args.upcoming) {
      const now = Date.now();
      const viewer = await getCurrentUser(ctx);
      return Promise.all(events.filter(event => event.date > now && event.cancelledAt === undefined).map(event => eventForViewer(ctx, event, viewer)));
    }

    const viewer = await getCurrentUser(ctx);
    return Promise.all(events.map(event => eventForViewer(ctx, event, viewer)));
  },
});

export const getEventById = query({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.id);
    return event ? eventForViewer(ctx, event) : null;
  },
});

export const getUpcomingEvents = query({
  handler: async (ctx) => {
    const now = Date.now();
    const events = await ctx.db.query("events").withIndex("by_date", q => q.gt("date", now)).collect();
    const viewer = await getCurrentUser(ctx);
    return Promise.all(events.filter(event => event.cancelledAt === undefined).map(event => eventForViewer(ctx, event, viewer)));
  },
});

export const updateEvent = mutation({
  args: {
    id: v.id("events"),
    clearRegistrationDeadline: v.optional(v.boolean()), clearOnSiteContact: v.optional(v.boolean()),
    eventRules: v.optional(v.string()), registrationDeadline: v.optional(v.number()), vendorInstructions: v.optional(v.string()),
    onSiteContact: v.optional(v.object({ name: v.string(), phone: v.string(), email: v.optional(v.string()) })),
    onSiteContactVisibility: v.optional(v.union(v.literal("vendors"), v.literal("public"))),
    registrationFeeCents: v.optional(v.number()),
    timeZone: v.optional(v.string()),
    name: v.optional(v.string()),
    date: v.optional(v.number()),
    location: v.optional(v.string()),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, clearRegistrationDeadline, clearOnSiteContact, ...fields } = args;
    const updates = { ...fields, ...(clearRegistrationDeadline ? { registrationDeadline: undefined } : {}), ...(clearOnSiteContact ? { onSiteContact: undefined } : {}) };
    validateEvent(updates);
    const event = await ctx.db.get(id);
    if (!event) throw new Error("Event not found");
    if (event.cancelledAt !== undefined) throw new Error("Cancelled events cannot be changed; create a new event");
    const deadline = clearRegistrationDeadline ? undefined : updates.registrationDeadline ?? event.registrationDeadline;
    if (deadline !== undefined && deadline > (updates.date ?? event.date)) throw new Error("Registration deadline cannot be after the event");
    const inventory = await ensureInventory(ctx, event._id);
    const occupied = inventory.held + inventory.confirmed;
    if (inventory.held > 0 && updates.registrationFeeCents !== undefined && updates.registrationFeeCents !== event.registrationFeeCents) throw new Error("Wait for active checkouts to finish or expire before changing the event fee");
    if (updates.capacity !== undefined && updates.capacity < occupied) throw new Error("Capacity cannot be lower than confirmed registrations and reserved places");
    if (occupied > 0 && ((updates.date !== undefined && updates.date !== event.date) || (updates.location !== undefined && updates.location !== event.location) || (updates.address !== undefined && updates.address !== event.address) || (updates.timeZone !== undefined && updates.timeZone !== event.timeZone))) throw new Error("Cancel and refund existing bookings before changing an occupied event's date or location");
    if (occupied > 0 && updates.eventRules !== undefined && updates.eventRules !== event.eventRules) throw new Error("Cancel and refund existing bookings before changing an occupied event's rules");
    await ctx.db.patch(id, updates);
    if (updates.capacity !== undefined && updates.capacity > event.capacity) await ctx.scheduler.runAfter(0, internal.eventWaitlist.promote, { eventId: id });
  },
});

export const deleteEvent = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.id))
      .first();
    if (registration) {
      throw new Error("Events with registrations cannot be deleted");
    }
    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Event not found");
    const inventory = await ensureInventory(ctx, event._id);
    const reservation = await ctx.db.query("eventReservations").withIndex("by_event_vehicle", q => q.eq("eventId", args.id)).first();
    if (inventory.held || inventory.confirmed || reservation) throw new Error("Events with checkout or payment history cannot be deleted. Cancel the event instead.");
    await ctx.db.delete(inventory._id);
    await ctx.db.delete(args.id);
  },
});
