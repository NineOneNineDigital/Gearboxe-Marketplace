"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type DiscoveryFilters, readDiscoveryUrl } from "@/lib/discovery-url";
import { MapPin, SlidersHorizontal } from "lucide-react";
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

const fields = [
  ["search", "Search", "Make, model, or listing title", "text"],
  ["model", "Model", "Exact model", "text"],
  ["minPrice", "Minimum price", "0", "number"],
  ["maxPrice", "Maximum price", "Any", "number"],
  ["minYear", "Earliest year", "1886", "number"],
  ["maxYear", "Latest year", "Any", "number"],
  ["maxMileage", "Maximum mileage (mi)", "Any", "number"],
  ["state", "State", "NC", "text"],
  ["latitude", "Latitude", "35.78", "number"],
  ["longitude", "Longitude", "-78.64", "number"],
  ["radiusMiles", "Distance (mi)", "50", "number"],
] as const;
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
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    setDraft(formValues(values));
    setError("");
  }, [values]);
  const set = (key: string, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const locate = () => {
    if (!navigator.geolocation) {
      setError("Location is unavailable. Enter coordinates below.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((previous) => ({
          ...previous,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          radiusMiles: previous.radiusMiles || "50",
        }));
        setLocating(false);
      },
      () => {
        setError(
          "Unable to use your location. Enter coordinates or filter by state.",
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  };
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (
      draft.radiusMiles?.trim() &&
      (!draft.latitude?.trim() || !draft.longitude?.trim())
    ) {
      setError(
        "Enter latitude and longitude or use your location to search by distance.",
      );
      return;
    }
    const params = new URLSearchParams(
      Object.entries(draft).filter(([, value]) => value.trim()),
    );
    const filters = readDiscoveryUrl(params).filters;
    for (const key of [
      "minPrice",
      "maxPrice",
      "minYear",
      "maxYear",
      "maxMileage",
      "state",
      "latitude",
      "longitude",
    ] as const) {
      if (draft[key]?.trim() && filters[key] === undefined) {
        setError("Check the entered ranges, state, and coordinates.");
        return;
      }
    }
    if (
      (draft.latitude?.trim() || draft.longitude?.trim()) &&
      draft.radiusMiles?.trim() &&
      filters.radiusMiles !== Number(draft.radiusMiles)
    ) {
      setError("Distance must be between 1 and 500 miles.");
      return;
    }
    onFiltersChange(filters);
  };
  return (
    <Card className={`border-black/10 bg-white shadow-none ${className ?? ""}`}>
      <CardHeader className="border-b border-black/10 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Filter inventory
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <form onSubmit={apply} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filter-make">Make</Label>
            <select
              id="filter-make"
              value={draft.make ?? ""}
              onChange={(event) => set("make", event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
          {fields.map(([key, label, placeholder, type]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`filter-${key}`}>{label}</Label>
              <Input
                id={`filter-${key}`}
                type={type}
                step={key.includes("Year") ? "1" : "any"}
                min={
                  type === "number" && key !== "latitude" && key !== "longitude"
                    ? key.includes("Year")
                      ? 1886
                      : key === "radiusMiles"
                        ? 1
                        : 0
                    : undefined
                }
                max={
                  key === "state"
                    ? undefined
                    : key === "radiusMiles"
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
                  key === "state"
                    ? 2
                    : key === "search"
                      ? 120
                      : key === "model"
                        ? 60
                        : undefined
                }
                placeholder={placeholder}
                value={draft[key] ?? ""}
                onChange={(event) => set(key, event.target.value)}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={locate}
            disabled={locating}
          >
            <MapPin className="mr-2 h-4 w-4" />
            {locating ? "Finding location…" : "Use my location"}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            Distance uses listing coordinates. Listings without a mapped
            location are excluded from distance searches.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full">
            Apply filters
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setDraft({});
              setError("");
              onFiltersChange({});
            }}
          >
            Clear filters
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
