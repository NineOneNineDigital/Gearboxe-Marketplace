"use client";

import { BrandLockup } from "@/components/ui/brand-lockup";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/ui/user-dropdown";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { href: "/vehicles", label: "Vehicles" },
  { href: "/events", label: "Events" },
];

export function Navbar() {
  const { isAuthenticated } = useConvexAuth();
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hasAccount = Boolean(isAuthenticated || isSignedIn);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="relative z-40 border-b border-white/10 bg-[hsl(var(--midnight))] text-[hsl(var(--bone))]">
      <nav className="market-shell flex h-[74px] items-center justify-between gap-6">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Gearboxe Market home">
            <BrandLockup inverse />
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative py-7 text-xs font-medium transition-colors ${
                  isActive(item.href)
                    ? "text-white"
                    : "text-[hsl(var(--chrome))] hover:text-white"
                }`}
              >
                {item.label}
                {isActive(item.href) && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {!isLoaded ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-white/10" />
          ) : hasAccount ? (
            <>
              <Button asChild size="sm" className="hidden text-white md:inline-flex">
                <Link href="/myAccount/new-listing">
                  List a vehicle <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <UserDropdown afterSignOutUrl="/" inverse />
            </>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden text-[hsl(var(--chrome))] hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">
                  List a vehicle <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 md:hidden"
            aria-label={isMobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <nav className="absolute inset-x-0 top-full border-y border-white/10 bg-[hsl(var(--midnight))] px-4 py-3 shadow-2xl md:hidden">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between border-b border-white/10 px-2 py-4 text-sm ${
                isActive(item.href) ? "text-primary" : "text-[hsl(var(--bone))]"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {item.label}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ))}
          {isLoaded && hasAccount && (
            <Button asChild size="sm" className="mt-4 w-full text-white">
              <Link href="/myAccount/new-listing" onClick={() => setIsMobileMenuOpen(false)}>
                List a vehicle <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </nav>
      )}
    </header>
  );
}
