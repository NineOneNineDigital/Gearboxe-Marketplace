import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isAdmin, requireAdmin, requireCurrentUser } from "./lib/authorization";
import { requireEventStaff, rosterRow } from "./lib/eventStaff";
import { checkinDecision, operationReason, rosterSearchText } from "./lib/eventOperationsPolicy";
import { internal } from "./_generated/api";
import { ensureInventory } from "./eventBookings";
import { enqueueNotification } from "./notifications";

const role = v.union(v.literal("checkin"), v.literal("manager"));
function assertExpectedActor(actorId: Id<"users">, expectedActorId?: Id<"users">) {
  if (expectedActorId !== undefined && expectedActorId !== actorId) throw new Error("Account changed. Refresh before performing this event operation.");
}
const severity = v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"));
async function audit(ctx: MutationCtx, actorId: Id<"users">, eventId: Id<"events">, action: string, reason: string, row?: Doc<"registrations">) {
  await ctx.db.insert("adminAuditLog", { actorId, targetUserId: row?.userId, vehicleId: row?.vehicleId, action, source: "eventOperations", reason: `event=${eventId}${row ? ` registration=${row._id}` : ""}; ${reason}`, createdAt: Date.now() });
}
export const assignedEvents = query({ args: {}, handler: async ctx => {
  const actor = await requireCurrentUser(ctx);
  if (isAdmin(actor)) return (await ctx.db.query("events").withIndex("by_date").order("desc").take(100)).map(event => ({ ...event, staffRole: "manager" as const }));
  const assignments = await ctx.db.query("eventStaff").withIndex("by_user", q => q.eq("userId", actor._id)).take(100);
  const events = await Promise.all(assignments.map(async assignment => { const event = await ctx.db.get(assignment.eventId); return event ? { ...event, staffRole: assignment.role } : null; }));
  return events.filter(event => event !== null);
} });
export const listAllStaffAssignments = query({ args: {}, handler: async ctx => {
  await requireAdmin(ctx);
  const assignments = await ctx.db.query("eventStaff").collect();
  return Promise.all(assignments.map(async assignment => {
    const event = await ctx.db.get(assignment.eventId);
    return { _id: assignment._id, eventId: assignment.eventId, userId: assignment.userId, role: assignment.role, eventName: event?.name ?? "Deleted event" };
  }));
} });
export const assignStaff = mutation({ args: { eventId: v.id("events"), userId: v.id("users"), role }, handler: async (ctx, args) => {
  const { actor } = await requireEventStaff(ctx, args.eventId, true);
  if (!isAdmin(actor) && args.role !== "checkin") throw new Error("Only Gearboxe administrators can assign event managers");
  const [event, user] = await Promise.all([ctx.db.get(args.eventId), ctx.db.get(args.userId)]);
  if (!event || !user || user.suspendedAt !== undefined) throw new Error("Active user and event required");
  const existing = await ctx.db.query("eventStaff").withIndex("by_event_user", q => q.eq("eventId", args.eventId).eq("userId", args.userId)).unique();
  if (!isAdmin(actor) && existing?.role === "manager") throw new Error("Only Gearboxe administrators can change event managers");
  if (existing) await ctx.db.patch(existing._id, { role: args.role, assignedBy: actor._id });
  else await ctx.db.insert("eventStaff", { ...args, assignedBy: actor._id, createdAt: Date.now() });
  await audit(ctx, actor._id, args.eventId, "assign_event_staff", `user=${args.userId}; role=${args.role}`);
} });
export const removeStaff = mutation({ args: { eventId: v.id("events"), userId: v.id("users") }, handler: async (ctx, args) => {
  const { actor } = await requireEventStaff(ctx, args.eventId, true);
  const assignment = await ctx.db.query("eventStaff").withIndex("by_event_user", q => q.eq("eventId", args.eventId).eq("userId", args.userId)).unique();
  if (!isAdmin(actor) && assignment?.role === "manager") throw new Error("Only Gearboxe administrators can remove event managers");
  if (assignment) await ctx.db.delete(assignment._id);
  await audit(ctx, actor._id, args.eventId, "remove_event_staff", `user=${args.userId}`);
} });
export const listStaff = query({ args: { eventId: v.id("events") }, handler: async (ctx, args) => {
  await requireEventStaff(ctx, args.eventId, true);
  const rows = await ctx.db.query("eventStaff").withIndex("by_event", q => q.eq("eventId", args.eventId)).take(100);
  return Promise.all(rows.map(async row => ({ ...row, name: (await ctx.db.get(row.userId))?.name ?? "Unknown" })));
} });
export const assignCheckinStaffByEmail = mutation({ args: { eventId: v.id("events"), email: v.string() }, handler: async (ctx, args) => {
  const { actor } = await requireEventStaff(ctx, args.eventId, true);
  const email = args.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid account email");
  const user = await ctx.db.query("users").withIndex("byEmail", q => q.eq("email", email)).unique();
  if (!user || user.suspendedAt !== undefined) throw new Error("No active Gearboxe account has that email");
  const existing = await ctx.db.query("eventStaff").withIndex("by_event_user", q => q.eq("eventId", args.eventId).eq("userId", user._id)).unique();
  if (existing?.role === "manager") throw new Error("This account is already an event manager");
  if (existing) return;
  await ctx.db.insert("eventStaff", { eventId: args.eventId, userId: user._id, role: "checkin", assignedBy: actor._id, createdAt: Date.now() });
  await audit(ctx, actor._id, args.eventId, "assign_event_staff", `user=${user._id}; role=checkin`);
} });
export const getRoster = query({ args: { eventId: v.id("events"), paginationOpts: paginationOptsValidator, search: v.optional(v.string()) }, handler: async (ctx, args) => {
  await requireEventStaff(ctx, args.eventId);
  const search = args.search?.trim();
  if (search && search.length > 200) throw new Error("Search must be 200 characters or fewer");
  const records = search
    ? ctx.db.query("registrations").withSearchIndex("search_roster", q => q.search("rosterSearch", search).eq("eventId", args.eventId))
    : ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", args.eventId));
  const result = await records.paginate({ ...args.paginationOpts, numItems: Math.min(50, args.paginationOpts.numItems) });
  const rows = await Promise.all(result.page.map(row => rosterRow(ctx, row)));
  return { ...result, page: rows };
} });
// Operator-triggered migration for pre-search registrations. Recursion remains bounded per mutation.
export const backfillRosterSearch = internalMutation({ args: { eventId: v.id("events"), cursor: v.union(v.string(), v.null()) }, handler: async (ctx, args) => {
  const event = await ctx.db.get(args.eventId); if (!event) throw new Error("Event not found");
  const result = await ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", args.eventId)).paginate({ cursor: args.cursor, numItems: 100 });
  for (const registration of result.page) {
    const row = await rosterRow(ctx, registration);
    await ctx.db.patch(registration._id, { rosterSearch: rosterSearchText(row.sellerName, row.vehicleLabel) });
  }
  if (!result.isDone) await ctx.scheduler.runAfter(0, internal.eventOperations.backfillRosterSearch, { eventId: args.eventId, cursor: result.continueCursor });
  return { updated: result.page.length, isDone: result.isDone, continueCursor: result.continueCursor };
} });
export const lookup = query({ args: { eventId: v.id("events"), registrationId: v.optional(v.id("registrations")), qrCodeData: v.optional(v.string()) }, handler: async (ctx, args) => {
  const { event } = await requireEventStaff(ctx, args.eventId);
  if (event.cancelledAt !== undefined) return null;
  if (args.qrCodeData && args.qrCodeData.length > 500) return null;
  const row = args.registrationId ? await ctx.db.get(args.registrationId) : args.qrCodeData ? await ctx.db.query("registrations").withIndex("by_event_qr", q => q.eq("eventId", args.eventId).eq("qrCodeData", args.qrCodeData)).unique() : null;
  if (!row || row.eventId !== args.eventId || row.paymentStatus !== "completed") return null;
  return rosterRow(ctx, row);
} });
async function attendance(ctx: MutationCtx, eventId: Id<"events">) {
  const counter = await ensureInventory(ctx, eventId);
  if (counter.attendanceInitializing) throw new Error("Attendance migration is in progress; check-in is temporarily paused");
  if (counter.attended !== undefined) return { counter, attended: counter.attended };
  const rows = await ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", eventId)).take(1001);
  if (rows.length > 1000) throw new Error("Attendance migration required before check-in");
  return { counter, attended: rows.filter(row => row.checkedIn).length };
}
// Existing payment inventory must retain its authoritative capacity counters.
// Pause admission mutations while independently counting legacy attendance.
export const startAttendanceBackfill = internalMutation({ args: { eventId: v.id("events") }, handler: async (ctx, args) => {
  const counter = await ctx.db.query("eventInventories").withIndex("by_event", q => q.eq("eventId", args.eventId)).unique();
  if (!counter) throw new Error("Initialize payment inventory before migrating attendance");
  if (counter.initializationStatus === "migrating") throw new Error("Payment inventory migration is in progress");
  if (counter.attended !== undefined && !counter.attendanceInitializing) return;
  if (!counter.attendanceInitializing) await ctx.db.patch(counter._id, { attended: 0, attendanceInitializing: true, attendanceCursor: undefined });
  await ctx.scheduler.runAfter(0, internal.eventOperations.backfillAttendance, { eventId: args.eventId, cursor: counter.attendanceInitializing ? counter.attendanceCursor ?? null : null });
} });
export const backfillAttendance = internalMutation({ args: { eventId: v.id("events"), cursor: v.union(v.string(), v.null()) }, handler: async (ctx, args) => {
  const counter = await ctx.db.query("eventInventories").withIndex("by_event", q => q.eq("eventId", args.eventId)).unique();
  // Duplicate/stale scheduled batches cannot count a page twice.
  if (!counter?.attendanceInitializing || (counter.attendanceCursor ?? null) !== args.cursor) return;
  const result = await ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", args.eventId)).paginate({ cursor: args.cursor, numItems: 100 });
  await ctx.db.patch(counter._id, { attended: (counter.attended ?? 0) + result.page.filter(row => row.checkedIn).length, attendanceInitializing: !result.isDone, attendanceCursor: result.isDone ? undefined : result.continueCursor });
  if (!result.isDone) await ctx.scheduler.runAfter(0, internal.eventOperations.backfillAttendance, { eventId: args.eventId, cursor: result.continueCursor });
} });
export async function checkIn(ctx: MutationCtx, args: { eventId: Id<"events">; registrationId: Id<"registrations">; requestId: string; expectedRevision: number; expectedActorId?: Id<"users"> }) {
  const { actor, event } = await requireEventStaff(ctx, args.eventId);
  // This guards delayed client intent; the authenticated identity always supplies the actor.
  assertExpectedActor(actor._id, args.expectedActorId);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(args.requestId)) throw new Error("Invalid check-in request identifier");
  const replay = await ctx.db.query("eventCheckinRequests").withIndex("by_actor_request", q => q.eq("actorId", actor._id).eq("requestId", args.requestId)).unique();
  if (replay) {
    if (replay.registrationId !== args.registrationId || replay.eventId !== args.eventId || replay.expectedRevision !== args.expectedRevision) throw new Error("Request identifier already used");
    const row = await ctx.db.get(args.registrationId);
    return { status: "replayed" as const, checkedIn: !!row?.checkedIn && row.paymentStatus === "completed" && event.cancelledAt === undefined, revision: row?.checkinRevision ?? replay.resultRevision };
  }
  if (event.cancelledAt !== undefined) throw new Error("Event is canceled");
  const row = await ctx.db.get(args.registrationId);
  if (!row || row.eventId !== args.eventId) throw new Error("Registration not found for this event");
  const status = checkinDecision(row, args.expectedRevision);
  const revision = (row.checkinRevision ?? 0) + (status === "checked_in" ? 1 : 0);
  if (status === "checked_in") {
    const { counter, attended } = await attendance(ctx, args.eventId);
    await ctx.db.patch(counter._id, { attended: attended + 1 });
    await ctx.db.patch(row._id, { checkedIn: true, checkinRevision: revision, checkedInAt: Date.now(), checkedInBy: actor._id });
    await audit(ctx, actor._id, args.eventId, "event_checkin", `request=${args.requestId}; revision=${revision}`, row);
    await enqueueNotification(ctx, { userId: row.userId, category: "events", kind: "event_checkin", message: "Your event check-in was confirmed.", registrationId: row._id, vehicleId: row.vehicleId, link: "/myAccount/registrations", dedupeKey: `checkin:${row._id}:${revision}` });
  }
  await ctx.db.insert("eventCheckinRequests", { eventId: args.eventId, registrationId: args.registrationId, requestId: args.requestId, expectedRevision: args.expectedRevision, actorId: actor._id, resultRevision: revision, createdAt: Date.now() });
  return { status, checkedIn: true, revision };
}
export const checkInRegistration = mutation({ args: { eventId: v.id("events"), registrationId: v.id("registrations"), requestId: v.string(), expectedRevision: v.number(), expectedActorId: v.optional(v.id("users")) }, handler: checkIn });
export const undoCheckIn = mutation({ args: { eventId: v.id("events"), registrationId: v.id("registrations"), reason: v.string(), expectedRevision: v.number(), expectedActorId: v.optional(v.id("users")) }, handler: async (ctx, args) => {
  const { actor } = await requireEventStaff(ctx, args.eventId, true); assertExpectedActor(actor._id, args.expectedActorId); const reason = operationReason(args.reason);
  const row = await ctx.db.get(args.registrationId);
  if (!row || row.eventId !== args.eventId) throw new Error("Registration not found for this event");
  if ((row.checkinRevision ?? 0) !== args.expectedRevision) throw new Error("Registration changed. Refresh before undoing check-in.");
  if (!row.checkedIn) return;
  const { counter, attended } = await attendance(ctx, args.eventId);
  await ctx.db.patch(counter._id, { attended: Math.max(0, attended - 1) });
  await ctx.db.patch(row._id, { checkedIn: false, checkinRevision: (row.checkinRevision ?? 0) + 1, checkedInAt: undefined, checkedInBy: undefined });
  await audit(ctx, actor._id, args.eventId, "undo_event_checkin", reason, row);
} });
export const getMetrics = query({ args: { eventId: v.id("events") }, handler: async (ctx, args) => {
  const { event } = await requireEventStaff(ctx, args.eventId);
  const inventory = await ctx.db.query("eventInventories").withIndex("by_event", q => q.eq("eventId", args.eventId)).unique();
  const needsLegacy = !inventory || inventory.attended === undefined;
  const rows = needsLegacy ? await ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", args.eventId)).take(1001) : [];
  const complete = rows.length <= 1000 && inventory?.initializationStatus !== "migrating" && !inventory?.attendanceInitializing;
  const confirmed = inventory?.confirmed ?? rows.filter(row => row.paymentStatus === "completed" || row.paymentStatus === "refund_pending").length;
  const held = inventory?.held ?? 0;
  return { capacity: event.capacity, confirmed, held, waiting: inventory?.waiting ?? 0, attended: inventory?.attended ?? rows.filter(row => row.checkedIn).length, available: complete ? Math.max(0, event.capacity - confirmed - held) : 0, complete };
} });
export const exportRoster = mutation({ args: { eventId: v.id("events"), paginationOpts: paginationOptsValidator, expectedActorId: v.optional(v.id("users")) }, handler: async (ctx, args) => {
  const { actor } = await requireEventStaff(ctx, args.eventId, true);
  assertExpectedActor(actor._id, args.expectedActorId);
  const result = await ctx.db.query("registrations").withIndex("by_event", q => q.eq("eventId", args.eventId)).paginate({ ...args.paginationOpts, numItems: Math.min(100, args.paginationOpts.numItems) });
  await audit(ctx, actor._id, args.eventId, "export_event_roster", `rows=${result.page.length}; cursor=${args.paginationOpts.cursor ?? "start"}`);
  return { ...result, page: await Promise.all(result.page.map(row => rosterRow(ctx, row))) };
} });
export const recordIncident = mutation({ args: { eventId: v.id("events"), registrationId: v.optional(v.id("registrations")), reason: v.string(), severity, notes: v.string(), escalate: v.optional(v.boolean()), expectedActorId: v.optional(v.id("users")) }, handler: async (ctx, args) => {
  const { actor } = await requireEventStaff(ctx, args.eventId);
  assertExpectedActor(actor._id, args.expectedActorId);
  const reason = operationReason(args.reason); if (!args.notes.trim() || args.notes.length > 5000) throw new Error("Incident notes of 1–5000 characters required");
  const row = args.registrationId ? await ctx.db.get(args.registrationId) : null;
  if (args.registrationId && (!row || row.eventId !== args.eventId)) throw new Error("Registration not found for this event");
  const now = Date.now(); const status = args.escalate || args.severity === "high" || args.severity === "critical" ? "escalated" as const : "open" as const;
  const id = await ctx.db.insert("eventIncidents", { eventId: args.eventId, registrationId: args.registrationId, actorId: actor._id, reason, severity: args.severity, notes: args.notes.trim(), status, createdAt: now, updatedAt: now });
  await audit(ctx, actor._id, args.eventId, "record_event_incident", `incident=${id}; severity=${args.severity}; status=${status}; ${reason}`, row ?? undefined);
  return id;
} });
export const listIncidents = query({ args: { eventId: v.id("events"), paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
  await requireEventStaff(ctx, args.eventId, true);
  return ctx.db.query("eventIncidents").withIndex("by_event", q => q.eq("eventId", args.eventId)).order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(100, args.paginationOpts.numItems) });
} });
export const resolveIncident = mutation({ args: { incidentId: v.id("eventIncidents"), reason: v.string(), expectedActorId: v.optional(v.id("users")) }, handler: async (ctx, args) => {
  const incident = await ctx.db.get(args.incidentId); if (!incident) throw new Error("Incident not found");
  const { actor } = await requireEventStaff(ctx, incident.eventId, true); assertExpectedActor(actor._id, args.expectedActorId); const reason = operationReason(args.reason);
  await ctx.db.patch(incident._id, { status: "resolved", updatedAt: Date.now() });
  await audit(ctx, actor._id, incident.eventId, "resolve_event_incident", `incident=${incident._id}; ${reason}`);
} });
export const requestRefund = mutation({ args: { eventId: v.id("events"), registrationId: v.id("registrations"), reason: v.string(), expectedActorId: v.optional(v.id("users")) }, handler: async (ctx, args) => {
  const { actor } = await requireEventStaff(ctx, args.eventId, true); assertExpectedActor(actor._id, args.expectedActorId); const reason = operationReason(args.reason);
  const row = await ctx.db.get(args.registrationId); if (!row || row.eventId !== args.eventId) throw new Error("Registration not found for this event");
  if (row.paymentStatus === "refund_pending" || row.paymentStatus === "refunded") return;
  if (row.paymentStatus !== "completed" || !row.paymentRecordId) throw new Error("Contact administrators to reconcile this registration refund");
  const payment = await ctx.db.get(row.paymentRecordId); if (!payment || payment.status !== "paid" || payment.registrationId !== row._id || payment.eventId !== row.eventId || payment.userId !== row.userId) throw new Error("Payment requires administrator reconciliation");
  const now = Date.now();
  await ctx.db.patch(payment._id, { status: "refund_pending", refundReason: "event_incident", nextAttemptAt: now, updatedAt: now });
  await ctx.db.patch(row._id, { paymentStatus: "refund_pending", refundRequestedAt: now, qrCodeData: undefined });
  await audit(ctx, actor._id, args.eventId, "request_event_incident_refund", reason, row);
} });
