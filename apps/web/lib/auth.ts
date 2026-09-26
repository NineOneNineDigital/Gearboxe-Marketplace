import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function getCurrentUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  try {
    const user = await convex.query(api.users.current);
    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

export async function isAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return false;
  }

  try {
    const isAdminUser = await convex.query(api.users.isAdmin);
    return isAdminUser;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

export async function requireAuth() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Authentication required");
  }

  return userId;
}

export async function requireAdmin() {
  const userId = await requireAuth();
  const adminStatus = await isAdmin();

  if (!adminStatus) {
    throw new Error("Admin access required");
  }

  return userId;
}
