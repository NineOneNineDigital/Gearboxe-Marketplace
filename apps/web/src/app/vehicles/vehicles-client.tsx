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
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Car, Grid, List, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Component,
  useMemo,
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
}: {
  state: DiscoveryState;
  layout: "grid" | "list";
  clear: () => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.discovery.browse,
    state,
    { initialNumItems: 12 },
  );
  const vehicles = vehicleResults(results) ?? [];
  const [loadingError, setLoadingError] = useState("");
  const more = () => {
    setLoadingError("");
    try {
      loadMore(12);
    } catch {
      setLoadingError("Unable to load more listings. Try again.");
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
  return (
    <>
      {vehicles.length > 0 ? (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            {vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"}{" "}
            loaded{exhausted ? " · End of results" : ""}
          </p>
          <div
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
      ) : exhausted ? (
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
          No matches in this page yet. Continue searching the next page.
        </p>
      )}
      {!exhausted && (
        <div className="mt-7 text-center">
          <Button
            variant="outline"
            disabled={status === "LoadingMore"}
            onClick={more}
          >
            {status === "LoadingMore" ? "Loading…" : "Load more vehicles"}
          </Button>
          {loadingError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {loadingError}
            </p>
          )}
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
  const filterCount = Object.keys(state.filters).filter(
    (key) => key !== "longitude" && key !== "radiusMiles",
  ).length;
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
          <div className="market-shell grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="lg:self-start">
              <div className="mb-4 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--gunmetal))] lg:hidden">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Search controls
              </div>
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
                  {filterCount > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {filterCount} active{" "}
                      {filterCount === 1 ? "filter" : "filters"}
                    </p>
                  )}
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
              <QueryBoundary
                key={stateKey}
                message="Inventory could not be loaded. Please try again."
              >
                <Inventory
                  state={state}
                  layout={layout}
                  clear={() => apply({}, "newest")}
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
