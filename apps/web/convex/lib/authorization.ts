import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthContext = QueryCtx | MutationCtx;

export async function getCurrentUser(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", identity.subject))
    .unique();
}

export async function requireCurrentUser(ctx: AuthContext) {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new ConvexError("Authentication required");
  }
  return user;
}

export function isAdmin(user: Doc<"users">) {
  return user.role === "admin" || user.role === "superAdmin";
}

export async function requireAdmin(ctx: AuthContext) {
  const user = await requireCurrentUser(ctx);
  if (!isAdmin(user)) {
    throw new ConvexError("Administrator access required");
  }
  return user;
}

export async function requireSuperAdmin(ctx: AuthContext) {
  const user = await requireCurrentUser(ctx);
  if (user.role !== "superAdmin") {
    throw new ConvexError("Super administrator access required");
  }
  return user;
}

export async function requireMatchingUser(
  ctx: AuthContext,
  requestedUserId: Id<"users">
) {
  const user = await requireCurrentUser(ctx);
  if (user._id !== requestedUserId && !isAdmin(user)) {
    throw new ConvexError("You do not have access to this account");
  }
  return user;
}

export async function requireSelf(
  ctx: AuthContext,
  requestedUserId: Id<"users">
) {
  const user = await requireCurrentUser(ctx);
  if (user._id !== requestedUserId) {
    throw new ConvexError("You do not have access to this account");
  }
  return user;
}

export function isConversationParticipant(
  conversation: Doc<"conversations">,
  userId: Id<"users">
) {
  return (
    conversation.participant1Id === userId ||
    conversation.participant2Id === userId
  );
}
