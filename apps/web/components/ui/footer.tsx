import { BrandLockup } from "@/components/ui/brand-lockup";
import Link from "next/link";

const footerLinks = [
  { href: "/vehicles", label: "Browse vehicles" },
  { href: "/events", label: "Upcoming events" },
  { href: "/myAccount/new-listing", label: "List a vehicle" },
  { href: "/contact", label: "Support" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[hsl(var(--midnight))] text-[hsl(var(--bone))]">
      <div className="market-ruler opacity-50" />
      <div className="market-shell py-12 sm:py-16">
        <div className="flex flex-col justify-between gap-10 border-b border-white/10 pb-10 md:flex-row md:items-end">
          <div>
            <BrandLockup inverse />
            <p className="mt-5 max-w-md text-sm leading-7 text-[hsl(var(--chrome))]">
              Private-party cars, documented ownership, and local events—all
              under the Gearboxe umbrella.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-4 text-xs sm:flex sm:flex-wrap sm:gap-7">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[hsl(var(--chrome))] transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-4 pt-6 font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--chrome))] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Gearboxe</p>
          <p className="text-white">For the love of the car.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
