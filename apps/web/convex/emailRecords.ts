import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { EMAIL_LEASE_MS, EMAIL_MAX_ATTEMPTS, EMAIL_TOKEN_TTL_MS, emailAllowed, mergeDeliveryStatus, normalizedEmail, webhookStatus } from "./lib/emailPolicy";
import { assertCanContact } from "./lib/trustGuards";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

async function applyWebhook(ctx: MutationCtx, row: Doc<"emailOutbox">, args: { type: string; recipientEmail?: string; permanentBounce: boolean }) {
  const now = Date.now();
  const email = row.recipientEmail;
  if (args.recipientEmail && normalizedEmail(args.recipientEmail) !== email) return;
  const status = webhookStatus(args.type);
  if (status) await ctx.db.patch(row._id, { status: mergeDeliveryStatus(row.status, status), updatedAt: now });
  if (email && (args.type === "email.spam_reported" || (args.type === "email.bounced" && args.permanentBounce))) {
    const existing = await ctx.db.query("emailSuppressions").withIndex("by_email", q => q.eq("email", email)).unique();
    if (!existing) await ctx.db.insert("emailSuppressions", { email, reason: args.type === "email.spam_reported" ? "complaint" : "permanent_bounce", createdAt: now });
  }
  if (args.type === "email.unsubscribed" || args.type === "email.group_unsubscribed") {
    const user = await ctx.db.get(row.userId);
    if (user && normalizedEmail(user.email) === email) await ctx.db.patch(user._id, { notificationPreferences: { messages: true, listings: true, favorites: true, events: true, ...user.notificationPreferences, emailEnabled: false } });
  }
}

export const claim = internalMutation({
  args: { id: v.id("emailOutbox"), leaseToken: v.string(), unsubscribeToken: v.string() },
  handler: async (ctx, { id, leaseToken, unsubscribeToken }) => {
    const row = await ctx.db.get(id);
    const now = Date.now();
    if (!row || row.status !== "pending" || row.nextAttemptAt > now) return null;
    const user = await ctx.db.get(row.userId);
    let allowed = !!user && emailAllowed(user, row.category);
    if (allowed && row.sourceUserId) {
      try { await assertCanContact(ctx, row.sourceUserId, row.userId); } catch { allowed = false; }
    }
    const email = user ? normalizedEmail(user.email) : "";
    const suppressed = email ? await ctx.db.query("emailSuppressions").withIndex("by_email", q => q.eq("email", email)).unique() : null;
    if (!allowed || suppressed) {
      await ctx.db.patch(id, { status: "skipped", lastError: suppressed ? "recipient_suppressed" : "recipient_disabled", updatedAt: now });
      return null;
    }
    if (row.attempts >= EMAIL_MAX_ATTEMPTS) {
      await ctx.db.patch(id, { status: "failed", lastError: "attempt_limit", updatedAt: now });
      return null;
    }
    const patch = { status: "sending", recipientEmail: email, leaseToken, leaseExpiresAt: now + EMAIL_LEASE_MS, unsubscribeToken: row.unsubscribeToken || unsubscribeToken, attempts: row.attempts + 1, updatedAt: now };
    await ctx.db.patch(id, patch);
    return { ...row, ...patch };
  },
});

export const complete = internalMutation({
  args: { id: v.id("emailOutbox"), leaseToken: v.string(), status: v.string(), providerId: v.optional(v.string()), error: v.optional(v.string()), delayMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.leaseToken !== args.leaseToken || !["sending", "uncertain"].includes(row.status)) return;
    const now = Date.now();
    const retry = args.status === "pending" && row.attempts < EMAIL_MAX_ATTEMPTS;
    const status = args.status === "pending" && !retry ? "failed" : args.status;
    const nextAttemptAt = retry ? now + (args.delayMs || 30_000) : row.nextAttemptAt;
    await ctx.db.patch(row._id, { status, providerId: args.providerId, lastError: args.error, nextAttemptAt, updatedAt: now, leaseToken: undefined, leaseExpiresAt: undefined });
    if (args.providerId) {
      const events = await ctx.db.query("emailWebhookEvents").withIndex("by_provider", q => q.eq("providerId", args.providerId!)).take(100);
      for (const event of events) {
        const updated = await ctx.db.get(row._id);
        if (updated) await applyWebhook(ctx, updated, event);
      }
    }
    if (retry) await ctx.scheduler.runAfter(nextAttemptAt - now, internal.emailDelivery.deliver, { id: row._id });
  },
});

export const sweep = internalMutation({
  args: {}, handler: async ctx => {
    const now = Date.now();
    const [pending, abandoned] = await Promise.all([
      ctx.db.query("emailOutbox").withIndex("by_status_due", q => q.eq("status", "pending").lte("nextAttemptAt", now)).take(100),
      ctx.db.query("emailOutbox").withIndex("by_status_lease", q => q.eq("status", "sending").lte("leaseExpiresAt", now)).take(100),
    ]);
    for (const row of abandoned) await ctx.db.patch(row._id, { status: "uncertain", lastError: "send_lease_expired", updatedAt: now });
    for (const row of pending) await ctx.scheduler.runAfter(0, internal.emailDelivery.deliver, { id: row._id });
  },
});

export const unsubscribe = internalMutation({
  args: { token: v.string() }, handler: async (ctx, { token }) => {
    const row = await ctx.db.query("emailOutbox").withIndex("by_unsubscribe", q => q.eq("unsubscribeToken", token)).unique();
    if (!row || row.createdAt + EMAIL_TOKEN_TTL_MS < Date.now()) return false;
    const user = await ctx.db.get(row.userId);
    // A link issued to a previous address cannot change a new address's preferences.
    if (!user || normalizedEmail(user.email) !== row.recipientEmail) return false;
    await ctx.db.patch(user._id, { notificationPreferences: { messages: true, listings: true, favorites: true, events: true, ...user.notificationPreferences, emailEnabled: false } });
    return true;
  },
});

export const recordWebhook = internalMutation({
  args: { eventKey: v.string(), providerId: v.string(), type: v.string(), recipientEmail: v.optional(v.string()), permanentBounce: v.boolean() },
  handler: async (ctx, args) => {
    if (await ctx.db.query("emailWebhookEvents").withIndex("by_event", q => q.eq("eventKey", args.eventKey)).unique()) return;
    const now = Date.now();
    await ctx.db.insert("emailWebhookEvents", { eventKey: args.eventKey, providerId: args.providerId, type: args.type, recipientEmail: args.recipientEmail, permanentBounce: args.permanentBounce, createdAt: now });
    const row = await ctx.db.query("emailOutbox").withIndex("by_provider", q => q.eq("providerId", args.providerId)).unique();
    if (!row) return;
    await applyWebhook(ctx, row, args);
  },
});

export const cleanup = internalMutation({
  args: {}, handler: async ctx => {
    const cutoff = Date.now() - EMAIL_TOKEN_TTL_MS;
    const events = await ctx.db.query("emailWebhookEvents").withIndex("by_created", q => q.lt("createdAt", cutoff)).take(100);
    for (const event of events) await ctx.db.delete(event._id);
    // Separate status prefixes prevent unresolved rows from starving terminal cleanup.
    for (const status of ["accepted", "delivered", "deferred", "bounced", "complained", "failed", "skipped"]) {
      const rows = await ctx.db.query("emailOutbox").withIndex("by_status_updated", q => q.eq("status", status).lt("updatedAt", cutoff)).take(100);
      for (const row of rows) await ctx.db.delete(row._id);
    }
  },
});

// Deployment operators must verify the provider's activity log before calling.
// There is deliberately no client-callable resend API for ambiguous sends.
export const reconcileUncertain = internalMutation({
  args: { id: v.id("emailOutbox"), decision: v.union(v.literal("not_sent"), v.literal("accepted")), providerId: v.optional(v.string()), reason: v.string() },
  handler: async (ctx, args) => {
    if (!/^[A-Za-z][A-Za-z0-9_-]{1,31}(?:-|:)[A-Za-z0-9_-]{1,80}$/.test(args.reason)) throw new Error("Supply an incident or evidence reference without personal data");
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "uncertain") throw new Error("Only uncertain deliveries can be reconciled");
    const now = Date.now();
    if (args.decision === "accepted") {
      if (!args.providerId || !/^[A-Za-z0-9_-]{1,256}$/.test(args.providerId)) throw new Error("A valid provider email ID is required");
      const existing = await ctx.db.query("emailOutbox").withIndex("by_provider", q => q.eq("providerId", args.providerId!)).unique();
      if (existing && existing._id !== row._id) throw new Error("Provider email ID is already assigned");
      await ctx.db.patch(row._id, { status: "accepted", providerId: args.providerId, lastError: undefined, leaseToken: undefined, leaseExpiresAt: undefined, updatedAt: now });
      const events = await ctx.db.query("emailWebhookEvents").withIndex("by_provider", q => q.eq("providerId", args.providerId!)).take(100);
      for (const event of events) {
        const updated = await ctx.db.get(row._id);
        if (updated) await applyWebhook(ctx, updated, event);
      }
    } else {
      const retry = row.attempts < EMAIL_MAX_ATTEMPTS;
      await ctx.db.patch(row._id, { status: retry ? "pending" : "failed", lastError: retry ? "operator_confirmed_not_sent" : "attempt_limit", nextAttemptAt: now, leaseToken: undefined, leaseExpiresAt: undefined, updatedAt: now });
      if (retry) await ctx.scheduler.runAfter(0, internal.emailDelivery.deliver, { id: row._id });
    }
    await ctx.db.insert("adminAuditLog", { action: `email_reconciled_${args.decision}`, targetUserId: row.userId, source: "deployment-operator", reason: args.reason, createdAt: now });
  },
});
