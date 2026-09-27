"use client";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { VehicleCard } from "@/components/ui/vehicle-card";
import {
  VehicleFilters,
  type VehicleFilterValues,
} from "@/components/ui/vehicle-filters";
import { api } from "@/convex/_generated/api";
import { vehicleResults } from "@/lib/vehicle-results";
import { useQuery } from "convex/react";
import { Car, Grid, List, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SortOption = "newest" | "price-low" | "price-high" | "mileage-low";

export default function VehiclesPage() {
  const [filters, setFilters] = useState<VehicleFilterValues>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const readNumber = (key: string) => {
      const value = params.get(key);
      return value ? Number(value) : undefined;
    };

    setFilters({
      make: params.get("make") ?? undefined,
      minPrice: readNumber("minPrice"),
      maxPrice: readNumber("maxPrice"),
    });
  }, []);

  const vehicles = vehicleResults(
    useQuery(api.vehicles.getVehicles, { status: "approved", ...filters })
  );
  const sortedVehicles = useMemo(() => {
    if (!vehicles) return vehicles;
    return [...vehicles].sort((a, b) => {
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      if (sortBy === "mileage-low") return a.mileage - b.mileage;
      return b.createdAt - a.createdAt;
    });
  }, [vehicles, sortBy]);
  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== undefined && value !== ""
  ).length;

  return (
    <div className="market-page flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="market-grid border-b border-white/10 bg-[hsl(var(--midnight))] py-10 text-[hsl(var(--bone))] sm:py-12">
          <div className="market-shell">
            <p className="market-eyebrow text-[hsl(var(--chrome))]">Marketplace inventory</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">Cars for sale by owners.</h1>
              <p className="max-w-md text-sm leading-7 text-[hsl(var(--chrome))] lg:justify-self-end">
                Browse private-party vehicles from local owners and the wider
                Gearboxe community.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[hsl(var(--bone))] py-10 text-[hsl(var(--midnight))] sm:py-14">
          <div className="market-shell grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-5 lg:self-start">
              <div className="mb-4 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--gunmetal))] lg:hidden">
                <SlidersHorizontal className="h-4 w-4 text-primary" /> Search controls
              </div>
              <VehicleFilters onFiltersChange={setFilters} values={filters} />
            </aside>

            <div>
              <div className="mb-7 flex flex-col gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--gunmetal))]">Available now</p>
                  <h2 className="mt-1 text-xl font-semibold">
                    {sortedVehicles ? `${sortedVehicles.length} vehicles` : "Loading inventory"}
                  </h2>
                  {activeFilterCount > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor="vehicle-sort">Sort vehicles</label>
                  <select
                    id="vehicle-sort"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortOption)}
                    className="h-10 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium outline-none focus:border-primary"
                  >
                    <option value="newest">Newest listed</option>
                    <option value="price-low">Price: low to high</option>
                    <option value="price-high">Price: high to low</option>
                    <option value="mileage-low">Lowest mileage</option>
                  </select>
                  <div className="flex items-center gap-1 rounded-lg border border-black/10 bg-white p-1">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Grid view"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="List view"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  </div>
                </div>
              </div>

              {sortedVehicles === undefined ? (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="h-[430px] animate-pulse rounded-xl bg-black/5" />
                  ))}
                </div>
              ) : sortedVehicles.length > 0 ? (
                <div className={viewMode === "grid" ? "grid gap-6 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}>
                  {sortedVehicles.map((vehicle) => <VehicleCard key={vehicle._id} vehicle={vehicle} layout={viewMode} />)}
                </div>
              ) : (
                <div className="market-grid rounded-2xl border border-black/10 bg-white/50 px-6 py-20 text-center">
                  <Car className="mx-auto h-9 w-9 text-primary" />
                  <h3 className="mt-5 text-2xl font-semibold">No vehicles match that search.</h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[hsl(var(--gunmetal))]">Adjust the filters or clear them to see every current listing.</p>
                  <Button variant="outline" className="mt-6" onClick={() => setFilters({})}>Clear filters</Button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
