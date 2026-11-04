"use client";

import { BrandLockup } from "@/components/ui/brand-lockup";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { CalendarDays, CarFront, ClipboardList, CreditCard, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AccountMenu } from "./account-menu";

const marketLinks = [
  { href: "/admin", label: "Overview", icon: CarFront },
  { href: "/admin/listings", label: "Listings", icon: ClipboardList },
  { href: "/admin/events", label: "Events setup", icon: CalendarDays },
  { href: "/admin/safety", label: "Trust & safety", icon: ShieldCheck },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/notifications", label: "Notifications", icon: ClipboardList },
];

export function PortalShell({ children, section }: { children: ReactNode; section: "market" | "events" }) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const account = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const isAdmin = account?.suspendedAt === undefined && (account?.role === "admin" || account?.role === "superAdmin");
  const events = useQuery(api.eventOperations.assignedEvents, account && !isAdmin && account.suspendedAt === undefined ? {} : "skip");
  const canAccess = section === "market" ? isAdmin : isAdmin || !!events?.length;

  if (isLoading || (isAuthenticated && (account === undefined || (section === "events" && !isAdmin && events === undefined && account?.suspendedAt === undefined)))) {
    return <div className="market-shell flex flex-1 items-center justify-center" role="status">Loading your workspace…</div>;
  }

  if (!canAccess) {
    return <main className="market-shell flex flex-1 flex-col items-start justify-center gap-4">
      <h1 className="market-section-title">Access required</h1>
      <p className="text-sm text-[hsl(var(--gunmetal))]">Your account does not have access to this workspace.</p>
      <Link className="text-sm font-semibold text-primary underline" href="/access-denied">About access</Link>
    </main>;
  }

  const navLink = (href: string, label: string, Icon: typeof CarFront) => {
    const active = pathname === href;
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${active ? "bg-white/10 text-white" : "text-[hsl(var(--chrome))] hover:bg-white/10 hover:text-white"}`}>
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />{label}
    </Link>;
  };

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <header className="relative z-40 shrink-0 border-b border-white/10 bg-[hsl(var(--midnight))] text-[hsl(var(--bone))]">
      <nav className="market-shell flex h-[74px] items-center justify-between gap-6">
        <Link href="/" aria-label="Gearboxe Admin home"><BrandLockup inverse /></Link>
        <div className="flex items-center gap-5">
          <span className="hidden font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--chrome))] sm:inline">Operations portal</span>
          <AccountMenu />
        </div>
      </nav>
    </header>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
    <aside className="w-full shrink-0 bg-[hsl(var(--midnight))] px-4 py-3 text-[hsl(var(--bone))] md:flex md:h-full md:w-60 md:flex-col md:border-r md:border-white/10 md:px-5 md:py-8">
      <nav aria-label="Administration" className="flex gap-2 overflow-x-auto md:block md:overflow-visible">
        {isAdmin && <div className="min-w-max md:min-w-0">
          <p className="hidden font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--chrome))] md:mb-3 md:block">Market</p>
          <div className="flex gap-1 md:flex-col">{marketLinks.map(({ href, label, icon }) => navLink(href, label, icon))}
            {account?.role === "superAdmin" && navLink("/admin/users", "Users & roles", Users)}
          </div>
        </div>}
        <div className="min-w-max md:mt-7 md:min-w-0">
          <p className="hidden font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--chrome))] md:mb-3 md:block">Events</p>
          {navLink("/staff/events", "Event operations", CalendarDays)}
        </div>
      </nav>
    </aside>
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[hsl(var(--bone))]">{children}</div>
    </div>
  </div>;
}
