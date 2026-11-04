"use client";

import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CarFront,
  ClipboardCheck,
  CreditCard,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

function MetricCard({ label, value, detail, href, icon: Icon, featured = false }: {
  label: string;
  value: number | undefined;
  detail: string;
  href?: string;
  icon: LucideIcon;
  featured?: boolean;
}) {
  const className = `group flex min-h-44 flex-col justify-between rounded-2xl border p-5 sm:p-6 ${href ? "transition-colors hover:border-primary/60" : ""} ${featured ? "border-primary/30 bg-primary/5" : "border-black/10 bg-white"}`;
  const content = <>
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm font-semibold text-[hsl(var(--gunmetal))]">{label}</span>
        <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      </div>
      <div>
        <p className="market-metric mt-5 text-4xl font-semibold leading-none text-[hsl(var(--midnight))]" aria-label={value === undefined ? `${label} loading` : undefined}>
          {value === undefined ? <span className="inline-block h-9 w-20 animate-pulse rounded-lg bg-black/10" /> : value.toLocaleString()}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{detail}</span>{href && <ArrowUpRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />}
        </div>
      </div>
  </>;
  return href ? <Link href={href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

const workspaces = [
  { href: "/admin/listings", label: "Review listings", description: "Approve or return submitted vehicles.", icon: CarFront },
  { href: "/admin/events", label: "Manage events", description: "Set up dates, capacity, and staff.", icon: CalendarDays },
  { href: "/admin/safety", label: "Trust & safety", description: "Work through reports and appeals.", icon: ShieldCheck },
  { href: "/admin/payments", label: "Payment operations", description: "Review refunds and payment issues.", icon: CreditCard },
];

export default function AdminHome() {
  const { isAuthenticated } = useConvexAuth();
  const stats = useQuery(api.admin.getAdminStats, isAuthenticated ? {} : "skip");

  return (
    <main className="min-h-full bg-[hsl(var(--bone))]">
      <section className="relative overflow-hidden bg-[hsl(var(--midnight))] text-[hsl(var(--bone))]">
        <div className="market-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="market-shell relative py-9 sm:py-11">
          <p className="market-eyebrow text-[hsl(var(--chrome))]">Gearboxe administration</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Overview<span className="text-primary">.</span></h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--chrome))]">A quick view of marketplace activity and the work that needs attention.</p>
        </div>
        <div className="market-ruler relative opacity-60" />
      </section>

      <div className="market-shell space-y-9 py-9 sm:py-11">
        <section aria-labelledby="metrics-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="market-eyebrow">Live snapshot</p><h2 id="metrics-heading" className="mt-3 text-2xl font-semibold">At a glance</h2></div>
            {!stats && <p role="status" className="text-xs text-muted-foreground">Loading live metrics…</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard featured label="Pending listing reviews" value={stats?.pendingVehicles} detail="Waiting for a decision" href="/admin/listings" icon={ClipboardCheck} />
            <MetricCard label="Approved listings" value={stats?.approvedVehicles} detail="Approved or active vehicles" href="/admin/listings" icon={CarFront} />
            <MetricCard label="Upcoming events" value={stats?.upcomingEvents} detail="Future, uncancelled events" href="/admin/events" icon={CalendarDays} />
            <MetricCard label="Registration records" value={stats?.totalRegistrations} detail="Across all events" href="/staff/events" icon={Ticket} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Total listings" value={stats?.totalVehicles} detail="All listing statuses" href="/admin/listings" icon={CarFront} />
            <MetricCard label="Accounts" value={stats?.totalUsers} detail="Members and staff" icon={Users} />
            <MetricCard label="Events created" value={stats?.totalEvents} detail="Past and future" href="/admin/events" icon={CalendarDays} />
          </div>
        </section>

        <section aria-labelledby="attention-heading" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-primary/25 bg-white p-6 market-card-shadow sm:p-8">
            <p className="market-eyebrow">Priority queue</p>
            <h2 id="attention-heading" className="mt-4 text-2xl font-semibold">Keep the market moving.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{stats?.pendingVehicles === 0 ? "No listings are waiting for review right now." : stats?.pendingVehicles === undefined ? "Checking the listing review queue…" : `${stats.pendingVehicles.toLocaleString()} ${stats.pendingVehicles === 1 ? "listing is" : "listings are"} waiting for review.`}</p>
            <Link href="/admin/listings" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Open listing queue <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-6 sm:p-8">
            <p className="market-eyebrow">Workspaces</p>
            <h2 className="mt-4 text-2xl font-semibold">Go where you&apos;re needed.</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {workspaces.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} className="group rounded-xl border border-black/10 p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"><div className="flex items-center justify-between gap-3"><Icon className="h-5 w-5 text-primary" aria-hidden="true" /><ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" /></div><h3 className="mt-3 text-sm font-semibold">{label}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></Link>)}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
