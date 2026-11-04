"use client";

import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/ui/event-card";
import { Footer } from "@/components/ui/footer";
import { MarketplaceSearch } from "@/components/ui/marketplace-search";
import { Navbar } from "@/components/ui/navbar";
import { VehicleCard } from "@/components/ui/vehicle-card";
import { api } from "@/convex/_generated/api";
import { isTrustedImageUrl } from "@/lib/trusted-images";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowDown, ArrowUpRight, Calendar, Car, FileCheck2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  const { isAuthenticated } = useConvexAuth();
  const upcomingEvents = useQuery(api.events.getUpcomingEvents);
  const featuredVehicles = useQuery(api.discovery.browse, { filters: {}, sort: "newest", paginationOpts: { numItems: 6, cursor: null } })?.page;

  const displayVehicles = featuredVehicles?.slice(0, 6) ?? [];
  const heroVehicle = displayVehicles[0];
  const nextEvent = upcomingEvents?.[0];

  return (
    <div className="market-page flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="relative isolate overflow-hidden bg-[hsl(var(--midnight))] text-[hsl(var(--bone))]">
          {heroVehicle?.photos[0] && isTrustedImageUrl(heroVehicle.photos[0]) && (
            <Image
              src={heroVehicle.photos[0]}
              alt=""
              fill
              priority
              sizes="100vw"
              className="-z-30 object-cover object-center opacity-70 sm:object-[68%_center]"
            />
          )}
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,hsl(var(--midnight))_0%,hsl(var(--midnight)/0.96)_30%,hsl(var(--midnight)/0.46)_65%,hsl(var(--midnight)/0.82)_100%)]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_50%,hsl(var(--midnight))_100%)]" />

          <div className="market-shell grid min-h-[590px] content-center gap-10 py-14 sm:py-20 lg:grid-cols-[1fr_0.92fr] lg:items-end">
            <div className="max-w-2xl">
              <p className="market-eyebrow text-[hsl(var(--chrome))]">Private-party auto marketplace</p>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.06em] text-white sm:text-7xl">
                Cars from people who <span className="text-primary">care.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-[hsl(var(--chrome))]">
                Shop owner-listed vehicles, ask questions directly, and meet
                the car in person through the Gearboxe community.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4 text-xs">
                <Link href="/vehicles" className="inline-flex items-center gap-2 font-semibold text-white hover:text-primary">
                  View all inventory <ArrowUpRight className="h-4 w-4" />
                </Link>
                <span className="h-4 w-px bg-white/20" />
                <Link href={isAuthenticated ? "/myAccount/new-listing" : "/sign-up"} className="font-semibold text-[hsl(var(--chrome))] hover:text-white">
                  Sell your vehicle
                </Link>
              </div>
            </div>

            <div className="lg:pb-2">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--chrome))]">Search the marketplace</p>
                {featuredVehicles && <span className="text-xs text-[hsl(var(--chrome))]">{featuredVehicles.length} available</span>}
              </div>
              <MarketplaceSearch />
              {heroVehicle && (
                <Link href={`/vehicles/${heroVehicle._id}`} className="mt-4 flex items-center justify-between border-t border-white/15 px-1 pt-4 text-xs text-[hsl(var(--chrome))] hover:text-white">
                  <span><span className="mr-2 text-primary">Featured</span>{heroVehicle.year} {heroVehicle.make} {heroVehicle.model}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
          <div className="market-ruler absolute inset-x-0 bottom-0 opacity-60" />
        </section>

        <div className="border-b border-black/10 bg-white">
          <div className="market-shell flex min-h-20 flex-wrap items-center gap-x-7 gap-y-3 py-4">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Browse popular makes</span>
            {["BMW", "Porsche", "Ford", "Toyota", "Mercedes-Benz"].map((make) => (
              <Link key={make} href={`/vehicles?make=${encodeURIComponent(make)}`} className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold transition-colors hover:border-primary hover:text-primary">
                {make}
              </Link>
            ))}
            <Link href="/vehicles" className="ml-auto hidden items-center gap-2 text-xs font-semibold hover:text-primary sm:inline-flex">All makes <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </div>

        <section className="bg-[hsl(var(--bone))] py-16 text-[hsl(var(--midnight))] sm:py-20">
          <div className="market-shell">
            <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
              <div>
                <p className="market-eyebrow">Fresh inventory</p>
                <h2 className="market-section-title mt-6">Recently listed.</h2>
              </div>
              <div className="lg:justify-self-end">
                <p className="max-w-sm text-sm leading-7 text-[hsl(var(--gunmetal))]">
                  Browse vehicles from the Gearboxe community. Every listing
                  starts with the owner and the story behind the car.
                </p>
                <Link href="/vehicles" className="mt-5 inline-flex items-center gap-3 text-xs font-semibold hover:text-primary">
                  View every vehicle <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {featuredVehicles === undefined ? (
              <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-[430px] animate-pulse rounded-xl bg-black/5" />
                ))}
              </div>
            ) : displayVehicles.length > 0 ? (
              <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {displayVehicles.map((vehicle) => (
                  <VehicleCard key={vehicle._id} vehicle={vehicle} />
                ))}
              </div>
            ) : (
              <div className="market-grid mt-12 rounded-2xl border border-black/10 bg-white/50 px-6 py-20 text-center">
                <Car className="mx-auto h-9 w-9 text-primary" />
                <h3 className="mt-5 text-2xl font-semibold">The first cars are pulling in.</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[hsl(var(--gunmetal))]">Create a listing or check back soon as the Gearboxe community grows.</p>
              </div>
            )}
          </div>
        </section>

        <section className="market-grid border-y border-border bg-background py-20 sm:py-24">
          <div className="market-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="market-eyebrow">Meet the market</p>
              <h2 className="market-section-title mt-6">See the cars. Meet the owners.</h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
                Gearboxe Market events bring private sellers and interested
                buyers together around the vehicles themselves.
              </p>
              <Button asChild variant="outline" className="mt-7">
                <Link href="/events">Explore events <Calendar className="h-4 w-4" /></Link>
              </Button>
            </div>
            {nextEvent ? (
              <div className="max-w-xl lg:justify-self-end"><EventCard event={nextEvent} /></div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-10 lg:justify-self-end">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Next gathering</p>
                <h3 className="mt-4 text-2xl font-semibold">Event details coming soon.</h3>
              </div>
            )}
          </div>
        </section>

        <section className="bg-[hsl(var(--midnight))] py-20 text-[hsl(var(--bone))] sm:py-24">
          <div className="market-shell grid gap-10 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="market-eyebrow text-[hsl(var(--chrome))]">The Gearboxe difference</p>
              <h2 className="market-section-title mt-6 text-white">Ownership context belongs with the car.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
                <FileCheck2 className="h-5 w-5 text-primary" />
                <h3 className="mt-5 text-base font-semibold">More than a spec sheet</h3>
                <p className="mt-2 text-xs leading-6 text-[hsl(var(--chrome))]">Listings built around the details enthusiasts actually want to know.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
                <ArrowDown className="h-5 w-5 text-primary" />
                <h3 className="mt-5 text-base font-semibold">A direct connection</h3>
                <p className="mt-2 text-xs leading-6 text-[hsl(var(--chrome))]">Talk to the owner, ask better questions, and meet around the car.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
