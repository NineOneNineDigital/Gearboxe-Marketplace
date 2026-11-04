"use client";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { VehicleCard } from "@/components/ui/vehicle-card";
import { VehicleFilters } from "@/components/ui/vehicle-filters";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  discoveryUrl,
  readDiscoveryUrl,
  type DiscoveryFilters,
  type DiscoverySort,
  type DiscoveryState,
} from "@/lib/discovery-url";
import { vehicleResults } from "@/lib/vehicle-results";
import { localViewsSnapshot, subscribeLocalViews } from "@/lib/recently-viewed";
import { vehicleFacetLabel, vehicleFacetOptions, type VehicleFacet } from "@/lib/vehicle-facets";
import { readInventoryReturn, saveInventoryReturn, type InventoryReturn } from "@/lib/inventory-return";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Car, Grid, List, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

class QueryBoundary extends Component<
  { children: ReactNode; message: string },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div
          role="alert"
          className="rounded-xl border border-black/10 bg-white p-6"
        >
          <p className="mb-4 text-sm">{this.props.message}</p>
          <Button
            variant="outline"
            onClick={() =>
              this.setState((previous) => ({
                failed: false,
                attempt: previous.attempt + 1,
              }))
            }
          >
            Try again
          </Button>
        </div>
      );
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}

function Inventory({
  state,
  layout,
  clear,
  stateKey,
  onRestoreLayout,
}: {
  state: DiscoveryState;
  layout: "grid" | "list";
  clear: () => void;
  stateKey: string;
  onRestoreLayout: (layout: "grid" | "list") => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.discovery.browse,
    state,
    { initialNumItems: 13 },
  );
  const [visibleCount, setVisibleCount] = useState(12);
  const [autoPages, setAutoPages] = useState(0);
  const requestedRef = useRef("");
  const vehicles = (vehicleResults(results) ?? []).slice(0, visibleCount);
  const [restoration, setRestoration] = useState<InventoryReturn | null>(null);
  useEffect(() => {
    try {
      const saved = readInventoryReturn(window.sessionStorage, stateKey);
      if (saved) {
        onRestoreLayout(saved.layout);
        setVisibleCount(saved.count);
        setRestoration(saved);
      }
    } catch { /* Browsers can disable session storage. */ }
  }, [stateKey, onRestoreLayout]);
  useEffect(() => {
    const rememberOnExit = () => {
      try {
        saveInventoryReturn(window.sessionStorage, { url: stateKey, count: visibleCount, scrollY: window.scrollY, layout });
      } catch { /* Browsing still works without session storage. */ }
    };
    window.addEventListener("pagehide", rememberOnExit);
    return () => window.removeEventListener("pagehide", rememberOnExit);
  }, [stateKey, visibleCount, layout]);
  const autoLimit = restoration ? 20 : 5;
  useEffect(() => {
    if (status !== "CanLoadMore" || results.length > visibleCount || autoPages >= autoLimit) return;
    const key = `${results.length}:${visibleCount}:${autoPages}`;
    if (requestedRef.current === key) return;
    requestedRef.current = key;
    const needed = visibleCount + 1 - results.length;
    setAutoPages(autoPages + 1);
    loadMore(Math.min(48, Math.max(12, needed * (autoPages + 1))));
  }, [status, results.length, visibleCount, autoPages, autoLimit, loadMore]);
  useEffect(() => {
    if (!restoration || status === "LoadingFirstPage" || status === "LoadingMore") return;
    if (vehicles.length < restoration.count && status === "CanLoadMore" && autoPages < autoLimit) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: restoration.scrollY, behavior: "instant" });
      setRestoration(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [restoration, status, vehicles.length, autoPages, autoLimit]);
  const rememberPosition = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = event.target instanceof Element ? event.target.closest("a[href^='/vehicles/']") : null;
    if (!link) return;
    try {
      saveInventoryReturn(window.sessionStorage, { url: stateKey, count: visibleCount, scrollY: window.scrollY, layout });
    } catch { /* Browsing still works without session storage. */ }
  };
  const more = () => {
    requestedRef.current = "";
    setAutoPages(0);
    if (results.length > visibleCount) {
      const nextCount = visibleCount + 12;
      try {
        saveInventoryReturn(window.sessionStorage, { url: stateKey, count: nextCount, scrollY: window.scrollY, layout });
      } catch { /* Browsing still works without session storage. */ }
      setVisibleCount(nextCount);
    }
  };
  if (status === "LoadingFirstPage")
    return (
      <div
        role="status"
        aria-label="Loading vehicles"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="h-[500px] animate-pulse rounded-xl bg-black/5"
          />
        ))}
      </div>
    );
  const exhausted = status === "Exhausted";
  const hasBuffered = results.length > visibleCount;
  const canLoadMore = status === "CanLoadMore";
  const seeking = !hasBuffered && canLoadMore && autoPages < autoLimit;
  const finished = exhausted && !hasBuffered;
  return (
    <>
      {vehicles.length > 0 ? (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            {vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"}{" "}
            loaded{finished ? " · End of results" : ""}
          </p>
          <div
            onClickCapture={rememberPosition}
            className={
              layout === "grid"
                ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                : "grid gap-3"
            }
          >
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle._id}
                vehicle={vehicle}
                layout={layout}
                showAvailability
              />
            ))}
          </div>
        </>
      ) : finished ? (
        <div className="market-grid rounded-2xl border border-black/10 bg-white/50 px-6 py-20 text-center">
          <Car className="mx-auto h-9 w-9 text-primary" />
          <h3 className="mt-5 text-2xl font-semibold">
            No vehicles match that search.
          </h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[hsl(var(--gunmetal))]">
            Adjust the filters or clear them to see every current listing.
          </p>
          <Button variant="outline" className="mt-6" onClick={clear}>
            Clear filters
          </Button>
        </div>
      ) : (
        <p className="rounded-xl bg-white p-6 text-sm">
          {seeking || status === "LoadingMore" ? "Searching more listings…" : "No matches in the scanned listings yet. Continue searching."}
        </p>
      )}
      {(hasBuffered || canLoadMore || status === "LoadingMore") && (
        <div className="mt-7 text-center">
          <Button
            variant="outline"
            disabled={status === "LoadingMore" || seeking}
            onClick={more}
          >
            {status === "LoadingMore" || seeking ? "Loading…" : "Load more vehicles"}
          </Button>
        </div>
      )}
    </>
  );
}

function SavedSearches({
  state,
  apply,
}: {
  state: DiscoveryState;
  apply: (filters: DiscoveryFilters, sort: DiscoverySort) => void;
}) {
  const searches = useQuery(api.savedSearches.list, {});
  const save = useMutation(api.savedSearches.save);
  const remove = useMutation(api.savedSearches.remove);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const atLimit = (searches?.length ?? 0) >= 25;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await save({ name: name.trim(), ...state });
      setName("");
      setMessage("Search saved.");
    } catch {
      setMessage("Unable to save this search. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <h3 className="text-base font-semibold">Saved searches</h3>
      <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
        <label htmlFor="saved-search-name" className="sr-only">
          Search name
        </label>
        <input
          id="saved-search-name"
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder="Name this search"
          maxLength={80}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" disabled={busy || !name.trim() || atLimit}>
          {busy ? "Saving…" : "Save search"}
        </Button>
      </form>
      <p role="status" className="mt-2 text-xs">
        {message ||
          (atLimit
            ? "You have 25 saved searches. Delete one to save another."
            : "")}
      </p>
      {searches === undefined ? (
        <p className="mt-3 text-xs">Loading saved searches…</p>
      ) : searches.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Save your filters and sort order to return to them later.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {searches.map((search) => (
            <li
              key={search._id}
              className="flex items-center justify-between gap-2"
            >
              <button
                className="text-left text-sm text-primary underline-offset-4 hover:underline"
                onClick={() => apply(search.filters, search.sort)}
              >
                {search.name}
              </button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete saved search ${search.name}`}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMessage("");
                  try {
                    await remove({ id: search._id });
                  } catch {
                    setMessage("Unable to delete the saved search. Try again.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentViews({ signedIn }: { signedIn: boolean }) {
  const snapshot = useSyncExternalStore(
    subscribeLocalViews,
    localViewsSnapshot,
    () => "[]",
  );
  const ids = useMemo(() => JSON.parse(snapshot) as string[], [snapshot]);
  const accountRecent = useQuery(api.recentViews.list, signedIn ? {} : "skip");
  const guestRecent = useQuery(
    api.discovery.recentPublic,
    !signedIn && ids.length ? { ids } : "skip",
  );
  const recent = vehicleResults(
    signedIn ? accountRecent : ids.length ? guestRecent : [],
  );
  if (recent === undefined)
    return (
      <p role="status" className="mt-8 text-sm">
        Loading recently viewed listings…
      </p>
    );
  if (!recent.length)
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        {signedIn
          ? "Vehicles you view while signed in will appear here."
          : "Vehicles you view will appear here on this browser."}
      </p>
    );
  return (
    <section className="mt-10 border-t border-black/10 pt-8">
      <h2 className="mb-5 text-xl font-semibold">Recently viewed</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recent.map((vehicle) => (
          <VehicleCard key={vehicle._id} vehicle={vehicle} showAvailability />
        ))}
      </div>
    </section>
  );
}

export default function VehiclesClient() {
  const params = useSearchParams();
  const router = useRouter();
  const state = useMemo(() => readDiscoveryUrl(params), [params]);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const { user } = useCurrentUser();
  const apply = (filters: DiscoveryFilters, sort: DiscoverySort = state.sort) =>
    router.push(discoveryUrl(filters, sort), { scroll: false });
  const activeFilters = Object.entries(state.filters).filter(
    ([key]) =>
      key !== "longitude" &&
      key !== "radiusMiles" &&
      (key !== "latitude" || !state.filters.zip),
  ) as [keyof DiscoveryFilters, string | number][];
  const filterLabels: Partial<Record<keyof DiscoveryFilters, string>> = {
    search: "Search",
    make: "Make",
    model: "Model",
    bodyStyle: "Body style",
    fuelType: "Fuel type",
    transmission: "Transmission",
    titleStatus: "Title status",
    minPrice: "Min price",
    maxPrice: "Max price",
    minYear: "From",
    maxYear: "To",
    maxMileage: "Max mileage",
    state: "State",
    zip: "ZIP",
    latitude: "Within",
  };
  const removeFilter = (key: keyof DiscoveryFilters) => {
    const next = { ...state.filters };
    delete next[key];
    if (key === "latitude" || key === "zip") {
      delete next.zip;
      delete next.latitude;
      delete next.longitude;
      delete next.radiusMiles;
    }
    apply(next);
  };
  const stateKey = discoveryUrl(state.filters, state.sort);
  return (
    <div className="market-page flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="market-grid border-b border-white/10 bg-[hsl(var(--midnight))] py-10 text-[hsl(var(--bone))] sm:py-12">
          <div className="market-shell">
            <p className="market-eyebrow text-[hsl(var(--chrome))]">
              Marketplace inventory
            </p>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                Cars for sale by owners.
              </h1>
              <p className="max-w-md text-sm leading-7 text-[hsl(var(--chrome))] lg:justify-self-end">
                Browse private-party vehicles from local owners and the wider
                Gearboxe community.
              </p>
            </div>
          </div>
        </section>
        <section className="bg-[hsl(var(--bone))] py-10 text-[hsl(var(--midnight))] sm:py-14">
          <div className="market-shell grid grid-cols-1 gap-6 lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-8">
            <aside className="lg:self-start">
              <VehicleFilters
                values={state.filters}
                onFiltersChange={(filters) => apply(filters)}
              />
              <div className="mt-5">
                {user ? (
                  <QueryBoundary message="Saved searches are unavailable right now.">
                    <SavedSearches state={state} apply={apply} />
                  </QueryBoundary>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Sign in to save searches and keep your recently viewed
                    listings.
                  </p>
                )}
              </div>
            </aside>
            <div>
              <div className="mb-7 flex flex-col gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--gunmetal))]">
                    Available now
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    Find your next vehicle
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Explore cars from private sellers.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="vehicle-sort">
                    Sort vehicles
                  </label>
                  <select
                    id="vehicle-sort"
                    value={state.sort}
                    onChange={(event) =>
                      apply(state.filters, event.target.value as DiscoverySort)
                    }
                    className="h-10 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium outline-none focus:border-primary"
                  >
                    <option value="newest">Newest listed</option>
                    <option value="price-low">Price: low to high</option>
                    <option value="price-high">Price: high to low</option>
                    <option value="mileage-low">Mileage: low to high</option>
                    <option value="mileage-high">Mileage: high to low</option>
                    <option value="year-new">Year: newest first</option>
                    <option value="year-old">Year: oldest first</option>
                  </select>
                  <div className="flex items-center gap-1 rounded-lg border border-black/10 bg-white p-1">
                    <Button
                      variant={layout === "grid" ? "default" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Grid view"
                      aria-pressed={layout === "grid"}
                      onClick={() => setLayout("grid")}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={layout === "list" ? "default" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      aria-label="List view"
                      aria-pressed={layout === "list"}
                      onClick={() => setLayout("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {activeFilters.length > 0 && (
                <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="Active filters">
                  {activeFilters.map(([key, value]) => {
                    const displayValue = key in vehicleFacetOptions
                      ? vehicleFacetLabel(key as VehicleFacet, String(value))
                      : key === "zip"
                        ? `${value} · ${state.filters.radiusMiles ?? 50} mi`
                        : key === "latitude"
                          ? `${state.filters.radiusMiles ?? 50} mi radius`
                          : key === "minPrice" || key === "maxPrice"
                            ? `$${Number(value).toLocaleString()}`
                            : key === "maxMileage"
                              ? `${Number(value).toLocaleString()} mi`
                              : String(value);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => removeFilter(key)}
                        aria-label={`Remove ${filterLabels[key]} filter`}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-white px-3 py-1.5 text-xs font-medium text-[hsl(var(--midnight))] transition-colors hover:border-primary hover:bg-primary/5"
                      >
                        <span className="truncate">{filterLabels[key]}: {displayValue}</span>
                        <X className="h-3.5 w-3.5 shrink-0 text-primary" />
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="px-2 py-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                    onClick={() => apply({})}
                  >
                    Clear all
                  </button>
                </div>
              )}
              <QueryBoundary
                key={stateKey}
                message="Inventory could not be loaded. Please try again."
              >
                <Inventory
                  state={state}
                  layout={layout}
                  clear={() => apply({}, "newest")}
                  stateKey={stateKey}
                  onRestoreLayout={setLayout}
                />
              </QueryBoundary>
              <QueryBoundary
                key={user?._id ?? "guest-history"}
                message="Recently viewed listings are unavailable right now."
              >
                <RecentViews signedIn={Boolean(user)} />
              </QueryBoundary>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
