import { CalendarDays, CarFront, CreditCard, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

const sections = [
  { href: "/admin/listings", title: "Listings", description: "Review vehicles and listing decisions.", icon: CarFront },
  { href: "/admin/events", title: "Events setup", description: "Create events and assign event managers.", icon: CalendarDays },
  { href: "/admin/safety", title: "Trust & safety", description: "Handle moderation and reports.", icon: ShieldCheck },
  { href: "/admin/payments", title: "Payments", description: "Review event payment issues.", icon: CreditCard },
  { href: "/staff/events", title: "Event operations", description: "Run check-in and event day workflows.", icon: Users },
];

export default function AdminHome() {
  return <main className="market-shell py-10 sm:py-12">
    <p className="market-eyebrow">Gearboxe administration</p>
    <h1 className="market-section-title mt-5">Market workspace</h1>
    <p className="mt-4 max-w-xl text-sm leading-7 text-[hsl(var(--gunmetal))]">Manage marketplace activity and open event operations from the same portal.</p>
    <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="rounded-xl border border-border bg-white p-6 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md">
        <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
        <h2 className="mt-5 text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--gunmetal))]">{description}</p>
      </Link>)}
    </div>
  </main>;
}
