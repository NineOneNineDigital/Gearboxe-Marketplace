import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireAdmin, requireCurrentUser } from "./lib/authorization";
import { consumeRateLimit } from "./lib/trustGuards";
import { trustReason, trustText } from "./lib/trustPolicy";
import { enqueueNotification } from "./notifications";
import { WANTED_REMINDER_LEAD_MS, wantedExpiry, wantedInteger, wantedIsPublic, wantedOptionalPublicText, wantedPublicProjection, wantedPublicText, wantedReminderDue, wantedText } from "./lib/wantedPolicy";

const requestFields = {
  title: v.string(), maxBudget: v.number(), zip: v.string(), area: v.string(),
  radiusMiles: v.optional(v.number()), make: v.optional(v.string()), model: v.optional(v.string()),
  yearMin: v.optional(v.number()), yearMax: v.optional(v.number()), maxMileage: v.optional(v.number()),
  transmission: v.optional(v.string()), details: v.optional(v.string()),
};

function validated(input: { title: string; maxBudget: number; zip: string; area: string; radiusMiles?: number; make?: string; model?: string; yearMin?: number; yearMax?: number; maxMileage?: number; transmission?: string; details?: string }) {
  if (!/^\d{5}$/.test(input.zip)) throw new Error("Enter a five-digit ZIP code.");
  const area = wantedText(input.area, "General area", 80);
  if (!/^[\p{L}][\p{L} .'\-]*, [A-Z]{2}$/u.test(area)) throw new Error("Enter a city and two-letter state for the general area.");
  const yearMin = input.yearMin === undefined ? undefined : wantedInteger(input.yearMin, "Minimum year", 1900, 2100);
  const yearMax = input.yearMax === undefined ? undefined : wantedInteger(input.yearMax, "Maximum year", 1900, 2100);
  if (yearMin !== undefined && yearMax !== undefined && yearMin > yearMax) throw new Error("Minimum year cannot exceed maximum year.");
  return {
    title: wantedPublicText(input.title, "Title", 120, input.zip), maxBudget: wantedInteger(input.maxBudget, "Maximum budget", 1, 100_000_000),
    zip: input.zip, area, radiusMiles: input.radiusMiles === undefined ? undefined : wantedInteger(input.radiusMiles, "Radius", 1, 500),
    make: wantedOptionalPublicText(input.make, "Make", 60, input.zip), model: wantedOptionalPublicText(input.model, "Model", 60, input.zip),
    yearMin, yearMax, maxMileage: input.maxMileage === undefined ? undefined : wantedInteger(input.maxMileage, "Maximum mileage", 0, 1_000_000),
    transmission: wantedOptionalPublicText(input.transmission, "Transmission", 40, input.zip), details: input.details?.trim() ? wantedPublicText(input.details, "Details", 1000, input.zip) : undefined,
  };
}

export const browse = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const now = Date.now();
    const result = await ctx.db.query("wantedRequests").withIndex("by_status_expiry", q => q.eq("status", "active").gt("expiresAt", now)).order("desc").paginate(paginationOpts);
    const visible = await Promise.all(result.page.map(async row => {
      const owner = await ctx.db.get(row.userId);
      return owner && owner.deletedAt === undefined ? wantedPublicProjection(row) : null;
    }));
    return { ...result, page: visible.filter((row): row is NonNullable<typeof row> => row !== null) };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const rows = await ctx.db.query("wantedRequests").withIndex("by_user_created", q => q.eq("userId", user._id)).order("desc").collect();
    const visible = rows.filter(row => row.status !== "deleted");
    const now = Date.now();
    return { current: visible.filter(row => wantedIsPublic(row, now)), past: visible.filter(row => !wantedIsPublic(row, now)) };
  },
});

export const create = mutation({
  args: requestFields,
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (!user.emailVerified) throw new Error("Verify your email before posting a wanted request.");
    const values = validated(args);
    await consumeRateLimit(ctx, user._id, "wantedCreation");
    const now = Date.now();
    const expiresAt = wantedExpiry(now);
    const reminderAt = expiresAt - WANTED_REMINDER_LEAD_MS;
    const id = await ctx.db.insert("wantedRequests", { userId: user._id, ...values, status: "active", createdAt: now, updatedAt: now, expiresAt, reminderAt });
    await ctx.scheduler.runAt(reminderAt, internal.wanted.remindOne, { id, expectedExpiry: expiresAt });
    return id;
  },
});

export const edit = mutation({
  args: { id: v.id("wantedRequests"), ...requestFields },
  handler: async (ctx, args) => {
    const row = await owned(ctx, args.id);
    if (row.status === "removed") throw new Error("This request was removed by the safety team.");
    const { id, ...fields } = args;
    await ctx.db.patch(id, { ...validated(fields), updatedAt: Date.now() });
  },
});

async function owned(ctx: MutationCtx, id: Doc<"wantedRequests">["_id"]) {
  const user = await requireCurrentUser(ctx);
  const row = await ctx.db.get(id);
  if (!row || row.userId !== user._id || row.status === "deleted") throw new Error("Wanted request unavailable.");
  return row;
}

export const stillLooking = mutation({
  args: { id: v.id("wantedRequests") },
  handler: async (ctx, { id }) => {
    const row = await owned(ctx, id);
    if (row.status === "removed") throw new Error("This request was removed by the safety team.");
    // The old reminder cannot suppress the next cycle; dedupe includes expiry.
    const now = Date.now();
    const expiresAt = wantedExpiry(now);
    const reminderAt = expiresAt - WANTED_REMINDER_LEAD_MS;
    await ctx.db.patch(id, { status: "active", closedAt: undefined, expiresAt, reminderAt, updatedAt: now, remindedForExpiryAt: undefined });
    await ctx.scheduler.runAt(reminderAt, internal.wanted.remindOne, { id, expectedExpiry: expiresAt });
  },
});

export const close = mutation({
  args: { id: v.id("wantedRequests") },
  handler: async (ctx, { id }) => {
    const row = await owned(ctx, id);
    if (row.status === "removed") throw new Error("This request was removed by the safety team.");
    if (row.status !== "closed") await ctx.db.patch(id, { status: "closed", closedAt: Date.now(), updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("wantedRequests") },
  handler: async (ctx, { id }) => {
    await owned(ctx, id);
    // Soft delete preserves a stable request reference for future participant snapshots.
    await ctx.db.patch(id, { status: "deleted", deletedAt: Date.now(), updatedAt: Date.now() });
  },
});

export const report = mutation({
  args: { id: v.id("wantedRequests"), reason: v.string(), details: v.string() },
  handler: async (ctx, args) => {
    const reporter = await requireCurrentUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || !wantedIsPublic(row, Date.now()) || row.userId === reporter._id) throw new Error("Wanted request unavailable.");
    const owner = await ctx.db.get(row.userId);
    if (!owner || owner.deletedAt !== undefined) throw new Error("Wanted request unavailable.");
    await consumeRateLimit(ctx, reporter._id, "report");
    const now = Date.now();
    return ctx.db.insert("trustReports", { reporterId: reporter._id, targetUserId: row.userId, wantedRequestId: row._id, reason: trustReason(args.reason), details: trustText(args.details, "Report details"), status: "open", createdAt: now, updatedAt: now });
  },
});

export const moderateRemove = mutation({
  args: { id: v.id("wantedRequests"), reason: v.string() },
  handler: async (ctx, { id, reason }) => {
    const admin = await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.status === "deleted" || row.status === "removed") throw new Error("Wanted request unavailable.");
    const code = trustReason(reason);
    const now = Date.now();
    await ctx.db.patch(id, { status: "removed", removedAt: now, moderationReason: code, updatedAt: now });
    await ctx.db.insert("adminAuditLog", { action: "wanted_removed", actorId: admin._id, targetUserId: row.userId, wantedRequestId: id, source: "moderation", reason: code, createdAt: now });
    await enqueueNotification(ctx, { userId: row.userId, category: "listings", kind: "wanted_removed", message: "Your wanted request was removed by the safety team. Visit My Requests or Safety & support for help.", link: `/myAccount/my-requests#request-${id}`, dedupeKey: `wanted-removed:${id}:${now}` });
  },
});

async function sendReminder(ctx: MutationCtx, row: Doc<"wantedRequests">, now: number) {
  const owner = await ctx.db.get(row.userId);
  if (!owner || owner.deletedAt !== undefined) {
    if (row.status === "active") await ctx.db.patch(row._id, { reminderAt: Number.MAX_SAFE_INTEGER });
    return;
  }
  if (!wantedReminderDue(row, now)) {
    if (row.status === "active" && row.reminderAt <= now) await ctx.db.patch(row._id, { reminderAt: Number.MAX_SAFE_INTEGER });
    return;
  }
  await enqueueNotification(ctx, { userId: row.userId, category: "listings", kind: "wanted_expiry_reminder", message: "Your wanted request expires in three days. Choose Still looking to keep it active.", link: `/myAccount/my-requests#request-${row._id}`, dedupeKey: `wanted-reminder:${row._id}:${row.expiresAt}` });
  await ctx.db.patch(row._id, { remindedForExpiryAt: row.expiresAt, reminderAt: Number.MAX_SAFE_INTEGER });
}

export const remindOne = internalMutation({
  args: { id: v.id("wantedRequests"), expectedExpiry: v.number() },
  handler: async (ctx, { id, expectedExpiry }) => {
    const row = await ctx.db.get(id);
    if (row && row.expiresAt === expectedExpiry) await sendReminder(ctx, row, Date.now());
  },
});

export const remindExpiring = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("wantedRequests").withIndex("by_status_reminder", q => q.eq("status", "active").lte("reminderAt", now)).take(100);
    for (const row of rows) await sendReminder(ctx, row, now);
  },
});

export const expireDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("wantedRequests").withIndex("by_status_expiry", q => q.eq("status", "active").lte("expiresAt", now)).take(100);
    for (const row of rows) await ctx.db.patch(row._id, { status: "expired", updatedAt: now });
  },
});
