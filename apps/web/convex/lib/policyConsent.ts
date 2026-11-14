import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { requireCurrentUser } from "./authorization";

export type PublishedPolicyPair = Readonly<{
  termsVersion: string;
  privacyVersion: string;
  termsEffectiveAt: number;
  privacyEffectiveAt: number;
  termsUrl: string;
  privacyUrl: string;
}>;

// GBXMRKT-2 has no approved, effective policies. Do not use development drafts
// or an environment flag here. Activation needs reviewed immutable policy URLs,
// founder approval, signup integration and marketplace enforcement together.
export const PUBLISHED_POLICY_PAIR: PublishedPolicyPair | null = null;

export type PolicyAcceptance = {
  accepted: boolean;
  termsVersion: string;
  privacyVersion: string;
};

// The registry argument is for focused tests; public callers cannot supply it.
export async function recordPolicyAcceptance(
  ctx: MutationCtx,
  acceptance: PolicyAcceptance,
  published: PublishedPolicyPair | null = PUBLISHED_POLICY_PAIR,
) {
  const user = await requireCurrentUser(ctx);
  const now = Date.now();
  if (!published || published.termsEffectiveAt > now || published.privacyEffectiveAt > now) {
    throw new ConvexError("Approved marketplace policies are not available for acceptance");
  }
  if (acceptance.accepted !== true) {
    throw new ConvexError("Explicit policy acceptance is required");
  }
  if (acceptance.termsVersion !== published.termsVersion || acceptance.privacyVersion !== published.privacyVersion) {
    throw new ConvexError("Marketplace policies changed. Read the current versions before accepting");
  }

  // Indexed read and insert share one Convex mutation transaction. Concurrent
  // attempts conflict and retry; the first acceptance timestamp stays intact.
  const existing = await ctx.db.query("policyAcceptances")
    .withIndex("by_user_pair", q => q.eq("userId", user._id)
      .eq("termsVersion", published.termsVersion).eq("privacyVersion", published.privacyVersion))
    .unique();
  if (existing) return existing._id;

  return await ctx.db.insert("policyAcceptances", {
    userId: user._id,
    clerkUserId: user.externalId,
    ...published,
    acceptedAt: now,
  });
}
