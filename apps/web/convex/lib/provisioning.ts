import type { MutationCtx } from "../_generated/server";

export async function provisionFirstSuperAdmin(
  ctx: Pick<MutationCtx, "db">,
  args: { clerkUserId: string; expectedEmail: string; reason: string },
  env: Record<string, string | undefined>
) {
  const { clerkUserId, expectedEmail, reason } = args;
  if (!["development", "preview", "staging", "production"].includes(env.MARKETPLACE_ENV || "")) {
    throw new Error("A real deployment environment is required");
  }
  if (!clerkUserId.startsWith("user_") || env.BOOTSTRAP_SUPER_ADMIN_CLERK_ID !== clerkUserId) {
    throw new Error("User is not explicitly allowlisted for provisioning");
  }
  if (reason.trim().length < 10) throw new Error("An audit reason is required");
  const users = await ctx.db.query("users").collect();
  if (users.some((user) => user.role === "superAdmin")) {
    throw new Error("Bootstrap is disabled once a super administrator exists");
  }
  const user = await ctx.db.query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", clerkUserId)).unique();
  if (!user || !expectedEmail.trim() || user.email.toLowerCase() !== expectedEmail.trim().toLowerCase()) {
    throw new Error("Existing synchronized user and expected email must match");
  }
  await ctx.db.patch(user._id, { role: "superAdmin" });
  await ctx.db.insert("adminAuditLog", {
    action: "bootstrapSuperAdmin",
    targetUserId: user._id,
    source: "deployment-operator",
    reason: reason.trim(),
    createdAt: Date.now(),
  });
  return { success: true, userId: user._id };
}
