import { PortalShell } from "../../portal-shell";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { redirect } from "next/navigation";

export default async function MarketLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const token = await getToken({ template: "convex" });
  if (!token) throw new Error("Convex authentication is not configured for the admin portal");
  const account = await fetchQuery(api.users.current, {}, { token });
  if (!account || account.suspendedAt !== undefined || (account.role !== "admin" && account.role !== "superAdmin")) redirect("/access-denied");
  return <PortalShell section="market">{children}</PortalShell>;
}
