import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  QueryCtx,
} from "./_generated/server";
import {
  getCurrentUser,
  requireCurrentUser,
  requireSuperAdmin,
} from "./lib/authorization";

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
    const actor = await requireSuperAdmin(ctx);
    const user = await userByExternalId(ctx, args.externalId);

    if (!user) {
      throw new Error("User not found");
    }
    if (actor._id === user._id && args.role !== "superAdmin") {
      throw new Error("You cannot remove your own super administrator role");
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
    const currentUser = await requireCurrentUser(ctx);
    if (currentUser.externalId !== clerkId) {
      throw new Error("You do not have access to this account");
    }
    return currentUser;
  },
});

export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    const user = await ctx.db.get(id);
    return user
      ? { _id: user._id, name: user.name, createdAt: user.createdAt }
      : null;
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  return await requireCurrentUser(ctx);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
    .unique();
}
