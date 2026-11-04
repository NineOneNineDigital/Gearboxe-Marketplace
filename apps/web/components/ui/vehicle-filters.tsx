"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type DiscoveryFilters, readDiscoveryUrl } from "@/lib/discovery-url";
import { vehicleFacetOptions, type VehicleFacet } from "@/lib/vehicle-facets";
import { lookupZip } from "@/lib/zip-location";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

export type VehicleFilterValues = DiscoveryFilters;
export const vehicleMakes = [
  "Acura",
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jaguar",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Mazda",
  "Mercedes-Benz",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Porsche",
  "Ram",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const fields = {
  search: ["Keyword", "Make, model, or keyword", "text"],
  model: ["Model", "Any model", "text"],
  minPrice: ["Min price", "No min", "number"],
  maxPrice: ["Max price", "No max", "number"],
  minYear: ["From", "Any", "number"],
  maxYear: ["To", "Any", "number"],
  maxMileage: ["Max mileage", "Any mileage", "number"],
  zip: ["ZIP code", "e.g. 27601", "text"],
  radiusMiles: ["Within miles", "50", "number"],
} as const;
type FormValues = Record<string, string>;
function formValues(values: DiscoveryFilters): FormValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value)]),
  );
}

export function VehicleFilters({
  onFiltersChange,
  values = {},
  className,
}: {
  onFiltersChange: (filters: VehicleFilterValues) => void;
  values?: VehicleFilterValues;
  className?: string;
}) {
  const [draft, setDraft] = useState<FormValues>(() => formValues(values));
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setDraft(formValues(values));
    setError("");
  }, [values]);
  const set = (key: string, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const apply = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const zip = draft.zip?.trim() ?? "";
    if (zip && !/^\d{5}$/.test(zip)) {
      setError("Enter a five-digit ZIP code.");
      return;
    }
    const nextDraft = { ...draft };
    if (zip) delete nextDraft.state;
    if (!zip && values.zip) {
      delete nextDraft.latitude;
      delete nextDraft.longitude;
      delete nextDraft.radiusMiles;
    }
    if (!zip && !nextDraft.latitude && nextDraft.radiusMiles) {
      setError("Enter a ZIP code to search by distance.");
      return;
    }
    if (zip && (!nextDraft.radiusMiles?.trim())) nextDraft.radiusMiles = "50";
    const radius = Number(nextDraft.radiusMiles);
    if (zip && (!Number.isFinite(radius) || radius < 1 || radius > 500)) {
      setError("Distance must be between 1 and 500 miles.");
      return;
    }
    if (zip && (zip !== values.zip || values.latitude === undefined)) {
      setResolving(true);
      try {
        const location = await lookupZip(zip);
        nextDraft.latitude = String(location.latitude);
        nextDraft.longitude = String(location.longitude);
      } catch (error) {
        setError(error instanceof Error ? error.message : "ZIP lookup is unavailable. Try again.");
        setResolving(false);
        return;
      }
      setResolving(false);
    }
    const params = new URLSearchParams(
      Object.entries(nextDraft).filter(([, value]) => value.trim()),
    );
    const filters = readDiscoveryUrl(params).filters;
    for (const key of [
      "minPrice",
      "maxPrice",
      "minYear",
      "maxYear",
      "maxMileage",
    ] as const) {
      if (nextDraft[key]?.trim() && filters[key] === undefined) {
        setError("Check the entered price, year, and mileage ranges.");
        return;
      }
    }
    if (zip && filters.zip !== zip) {
      setError("ZIP lookup is unavailable. Try again.");
      return;
    }
    if (nextDraft.radiusMiles?.trim() && filters.radiusMiles !== Number(nextDraft.radiusMiles)) {
      setError("Distance must be between 1 and 500 miles.");
      return;
    }
    onFiltersChange(filters);
    setMobileOpen(false);
  };
  const field = (key: keyof typeof fields) => {
    const [label, placeholder, type] = fields[key];
    return (
      <div className="min-w-0 space-y-1.5" key={key}>
        <Label
          htmlFor={`filter-${key}`}
          className="text-xs font-medium text-[hsl(var(--gunmetal))]"
        >
          {label}
        </Label>
        <Input
          id={`filter-${key}`}
          type={type}
          step={key.includes("Year") ? "1" : "any"}
          min={
            type === "number"
              ? key.includes("Year")
                ? 1886
                : key === "radiusMiles"
                  ? 1
                  : 0
              : undefined
          }
          max={
            key === "radiusMiles"
              ? 500
              : key.includes("Year")
                ? new Date().getFullYear() + 1
                : key === "maxMileage"
                  ? 2_000_000
                  : key === "minPrice" || key === "maxPrice"
                    ? 100_000_000
                    : undefined
          }
          maxLength={
            key === "zip"
              ? 5
              : key === "search"
                ? 120
                : key === "model"
                  ? 60
                  : undefined
          }
          placeholder={placeholder}
          value={draft[key] ?? ""}
          onChange={(event) => set(key, event.target.value)}
          inputMode={key === "zip" ? "numeric" : undefined}
          autoComplete={key === "zip" ? "postal-code" : undefined}
          className="h-10 bg-white text-sm shadow-none"
        />
      </div>
    );
  };
  const facet = (key: VehicleFacet, label: string) => (
    <div className="space-y-1.5" key={key}>
      <Label htmlFor={`filter-${key}`} className="text-xs font-medium text-[hsl(var(--gunmetal))]">
        {label}
      </Label>
      <select
        id={`filter-${key}`}
        value={draft[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
      >
        <option value="">Any {label.toLowerCase()}</option>
        {vehicleFacetOptions[key].map(([value, optionLabel]) => (
          <option key={value} value={value}>{optionLabel}</option>
        ))}
      </select>
    </div>
  );
  const activeCount = Object.keys(values).filter(
    (key) => key !== "longitude" && key !== "radiusMiles" && (key !== "latitude" || !values.zip),
  ).length;
  return (
    <div className={`overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_12px_35px_hsl(var(--midnight)/0.04)] ${className ?? ""}`}>
      <button
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="vehicle-filter-panel"
        onClick={() => setMobileOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left lg:hidden"
      >
        <span className="flex items-center gap-3 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${mobileOpen ? "rotate-180" : ""}`} />
      </button>
      <div id="vehicle-filter-panel" className={`${mobileOpen ? "block" : "hidden"} lg:block`}>
        <div className="hidden items-center justify-between border-b border-black/10 px-5 py-5 lg:flex">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Filters
          </h2>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
              {activeCount} active
            </span>
          )}
        </div>
        <form onSubmit={apply}>
          <div className="space-y-5 px-5 py-5">
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Search className="h-4 w-4 text-primary" /> Search
              </h3>
              {field("search")}
            </div>
            <div className="space-y-3 border-t border-black/10 pt-5">
              <h3 className="text-sm font-semibold">Vehicle</h3>
              <div className="space-y-1.5">
                <Label htmlFor="filter-make" className="text-xs font-medium text-[hsl(var(--gunmetal))]">
                  Make
                </Label>
                <select
                  id="filter-make"
                  value={draft.make ?? ""}
                  onChange={(event) => set("make", event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
                >
                  <option value="">All makes</option>
                  {draft.make && !vehicleMakes.includes(draft.make) && (
                    <option value={draft.make}>{draft.make}</option>
                  )}
                  {vehicleMakes.map((make) => (
                    <option key={make}>{make}</option>
                  ))}
                </select>
              </div>
              {field("model")}
              {facet("bodyStyle", "Body style")}
              <div className="grid grid-cols-2 gap-2">
                {field("minYear")}
                {field("maxYear")}
              </div>
              {field("maxMileage")}
            </div>
            <div className="space-y-3 border-t border-black/10 pt-5">
              <h3 className="text-sm font-semibold">Price</h3>
              <div className="grid grid-cols-2 gap-2">
                {field("minPrice")}
                {field("maxPrice")}
              </div>
            </div>
            <div className="space-y-3 border-t border-black/10 pt-5">
              <h3 className="text-sm font-semibold">Powertrain</h3>
              {facet("fuelType", "Fuel type")}
              {facet("transmission", "Transmission")}
            </div>
            <div className="space-y-3 border-t border-black/10 pt-5">
              <h3 className="text-sm font-semibold">Title</h3>
              {facet("titleStatus", "Title status")}
              <p className="text-xs leading-5 text-muted-foreground">Title status is reported by the seller.</p>
            </div>
            <div className="space-y-3 border-t border-black/10 pt-5">
              <h3 className="text-sm font-semibold">Location</h3>
              {field("zip")}
              {field("radiusMiles")}
              {values.latitude !== undefined && !values.zip && (
                <p className="text-xs leading-5 text-muted-foreground">
                  A saved location is active. Enter a ZIP code to replace it, or remove the location chip above the results.
                </p>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                Distance is measured from the ZIP code center. Listings without a mapped location are excluded.
              </p>
            </div>
          </div>
          {error && (
            <p role="alert" className="px-5 pb-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2 border-t border-black/10 bg-[hsl(var(--bone))]/40 px-5 py-4 lg:flex-col">
            <Button type="submit" disabled={resolving} className="min-w-0 flex-1 lg:w-full">
              {resolving ? "Finding ZIP…" : "Show vehicles"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-w-0 flex-1 lg:w-full"
              onClick={() => {
                setDraft({});
                setError("");
                setMobileOpen(false);
                onFiltersChange({});
              }}
            >
              Clear all
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
