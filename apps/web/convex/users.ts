import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  QueryCtx,
} from "./_generated/server";

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const userAttributes = {
      name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || "User",
      externalId: data.id,
      email: data.email_addresses?.[0]?.email_address || "",
      role: "user" as const, // Default role for new users
      createdAt: Date.now(),
    };

    const user = await userByExternalId(ctx, data.id);
    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch(user._id, {
        name: userAttributes.name,
        email: userAttributes.email,
      });
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId);

    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`
      );
    }
  },
});

export const updateUserRole = mutation({
  args: {
    externalId: v.string(),
    role: v.union(
      v.literal("user"),
      v.literal("admin"),
      v.literal("superAdmin")
    ),
  },
  handler: async (ctx, args) => {
    const user = await userByExternalId(ctx, args.externalId);

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, { role: args.role });
  },
});

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user?.role === "admin" || user?.role === "superAdmin";
  },
});

export const isSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user?.role === "superAdmin";
  },
});

export const getUserRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user?.role || "user";
  },
});

export const getUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return await userByExternalId(ctx, clerkId);
  },
});

export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
    .unique();
}
