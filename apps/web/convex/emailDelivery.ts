import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { autosendConfiguration, sendAutosend } from "./lib/autosend";
import type { Doc } from "./_generated/dataModel";

export const deliver = internalAction({
  args: { id: v.id("emailOutbox") }, handler: async (ctx, { id }): Promise<void> => {
    // Missing configuration leaves the durable pending row untouched for the sweep.
    let config: ReturnType<typeof autosendConfiguration>;
    try { config = autosendConfiguration(process.env); } catch { return; }
    const leaseToken = crypto.randomUUID();
    const unsubscribeToken = crypto.randomUUID() + crypto.randomUUID();
    const mail: Doc<"emailOutbox"> | null = await ctx.runMutation(internal.emailRecords.claim, { id, leaseToken, unsubscribeToken });
    if (!mail?.recipientEmail || !mail.unsubscribeToken) return;
    const outcome = await sendAutosend(config, { ...mail, recipientEmail: mail.recipientEmail, unsubscribeToken: mail.unsubscribeToken });
    await ctx.runMutation(internal.emailRecords.complete, { id, leaseToken, status: outcome.status, providerId: outcome.providerId, error: outcome.error, delayMs: outcome.delayMs });
  },
});
