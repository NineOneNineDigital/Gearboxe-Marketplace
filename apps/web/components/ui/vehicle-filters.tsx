"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";

export interface VehicleFilterValues {
  make?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
}

interface VehicleFiltersProps {
  onFiltersChange: (filters: VehicleFilterValues) => void;
  values?: VehicleFilterValues;
  className?: string;
}

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

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

export function VehicleFilters({
  onFiltersChange,
  values,
  className,
}: VehicleFiltersProps) {
  const [filters, setFilters] = useState({
    make: "all",
    model: "",
    minPrice: "",
    maxPrice: "",
    minYear: "any",
    maxYear: "any",
  });

  useEffect(() => {
    setFilters({
      make: values?.make ?? "all",
      model: values?.model ?? "",
      minPrice: values?.minPrice?.toString() ?? "",
      maxPrice: values?.maxPrice?.toString() ?? "",
      minYear: values?.minYear?.toString() ?? "any",
      maxYear: values?.maxYear?.toString() ?? "any",
    });
  }, [
    values?.make,
    values?.model,
    values?.minPrice,
    values?.maxPrice,
    values?.minYear,
    values?.maxYear,
  ]);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    // Convert to numbers for numeric fields and handle special values
    const processedFilters = {
      make:
        newFilters.make && newFilters.make !== "all"
          ? newFilters.make
          : undefined,
      model: newFilters.model || undefined,
      minPrice: newFilters.minPrice ? parseInt(newFilters.minPrice) : undefined,
      maxPrice: newFilters.maxPrice ? parseInt(newFilters.maxPrice) : undefined,
      minYear:
        newFilters.minYear && newFilters.minYear !== "any"
          ? parseInt(newFilters.minYear)
          : undefined,
      maxYear:
        newFilters.maxYear && newFilters.maxYear !== "any"
          ? parseInt(newFilters.maxYear)
          : undefined,
    };

    onFiltersChange(processedFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      make: "all",
      model: "",
      minPrice: "",
      maxPrice: "",
      minYear: "any",
      maxYear: "any",
    };
    setFilters(clearedFilters);
    onFiltersChange({});
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "make" && value === "all") return false;
    if ((key === "minYear" || key === "maxYear") && value === "any")
      return false;
    return value !== "";
  });

  return (
    <Card className={`border-black/10 bg-white shadow-none ${className ?? ""}`}>
      <CardHeader className="border-b border-black/10 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span className="text-base">Filter inventory</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        {/* Basic filters - always visible */}
        <div className="grid grid-cols-1 gap-5">
          <div className="space-y-2">
            <Label htmlFor="make">Make</Label>
            <Select
              value={filters.make}
              onValueChange={(value) => handleFilterChange("make", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select make" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Makes</SelectItem>
                {vehicleMakes.map((make) => (
                  <SelectItem key={make} value={make}>
                    {make}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              placeholder="Enter model"
              value={filters.model}
              onChange={(e) => handleFilterChange("model", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-black/10 pt-5">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Price range
          </p>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minPrice">Min Price</Label>
                <Input
                  id="minPrice"
                  type="number"
                  placeholder="0"
                  value={filters.minPrice}
                  onChange={(e) =>
                    handleFilterChange("minPrice", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPrice">Max Price</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  placeholder="100000"
                  value={filters.maxPrice}
                  onChange={(e) =>
                    handleFilterChange("maxPrice", e.target.value)
                  }
                />
              </div>
            </div>

        </div>

        <div className="space-y-4 border-t border-black/10 pt-5">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Model year
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="minYear">From</Label>
              <Select
                value={filters.minYear}
                onValueChange={(value) => handleFilterChange("minYear", value)}
              >
                <SelectTrigger id="minYear">
                  <SelectValue placeholder="Any year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any year</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxYear">To</Label>
              <Select
                value={filters.maxYear}
                onValueChange={(value) => handleFilterChange("maxYear", value)}
              >
                <SelectTrigger id="maxYear">
                  <SelectValue placeholder="Any year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any year</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
