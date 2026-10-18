import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";
import { provisionFirstSuperAdmin } from "./lib/provisioning";
import {
  internalMutation,
  mutation,
  query,
  QueryCtx,
} from "./_generated/server";
import {
  getCurrentUser,
  isAdmin as isActiveAdmin,
  requireCurrentUser,
  requireSuperAdmin,
} from "./lib/authorization";

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

// Only deployment operators can invoke internal functions. This allowlist is
// temporary and must be removed immediately after the first administrator exists.
export const bootstrapSuperAdmin = internalMutation({
  args: { clerkUserId: v.string(), expectedEmail: v.string(), reason: v.string() },
  handler: async (ctx, args) => provisionFirstSuperAdmin(ctx, args, process.env),
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const email = data.email_addresses?.find(address => address.id === data.primary_email_address_id);
    const phone = data.phone_numbers?.find(number => number.id === data.primary_phone_number_id);
    const userAttributes = {
      name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || "User",
      externalId: data.id,
      email: email?.email_address || "",
      emailVerified: email?.verification?.status === "verified",
      phone: phone?.phone_number,
      phoneVerified: phone?.verification?.status === "verified",
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
        emailVerified: userAttributes.emailVerified,
        phone: userAttributes.phone,
        phoneVerified: userAttributes.phoneVerified,
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
    await ctx.db.insert("adminAuditLog", { action: "role_changed", actorId: actor._id, targetUserId: user._id, source: "admin", reason: `Role changed to ${args.role}`, createdAt: Date.now() });
  },
});

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user !== null && isActiveAdmin(user);
  },
});

export const isSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user?.suspendedAt === undefined && user?.role === "superAdmin";
  },
});

export const getUserRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user?.role || "user";
  },
});

export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    const user = await ctx.db.get(id);
    const identity = user ? await ctx.db.query("identityReviews").withIndex("by_user", q => q.eq("userId", user._id)).unique() : null;
    return user
      ? { _id: user._id, name: user.name, createdAt: user.createdAt, emailVerified: !!user.emailVerified, phoneVerified: !!user.phoneVerified, identityVerified: identity?.status === "verified" }
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
