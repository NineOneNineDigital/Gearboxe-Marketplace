"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { vehicleMakes } from "@/components/ui/vehicle-filters";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

const priceRanges = [
  { label: "Any price", value: "any" },
  { label: "Under $25k", value: "0-25000" },
  { label: "$25k–$50k", value: "25000-50000" },
  { label: "$50k–$100k", value: "50000-100000" },
  { label: "$100k+", value: "100000-any" },
];

export function MarketplaceSearch() {
  const router = useRouter();
  const [make, setMake] = useState("all");
  const [price, setPrice] = useState("any");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();

    if (make !== "all") params.set("make", make);
    if (price !== "any") {
      const [minimum, maximum] = price.split("-");
      if (minimum !== "0") params.set("minPrice", minimum);
      if (maximum !== "any") params.set("maxPrice", maximum);
    }

    const query = params.toString();
    router.push(query ? `/vehicles?${query}` : "/vehicles");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-black/10 bg-white p-3 text-[hsl(var(--midnight))] shadow-[0_24px_70px_hsl(var(--midnight)/0.24)]"
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="px-2 py-1">
          <Label className="mb-2 block" htmlFor="marketplace-make">
            Make
          </Label>
          <Select value={make} onValueChange={setMake}>
            <SelectTrigger id="marketplace-make" className="border-0 bg-[hsl(var(--bone))] shadow-none">
              <SelectValue placeholder="All makes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All makes</SelectItem>
              {vehicleMakes.map((vehicleMake) => (
                <SelectItem key={vehicleMake} value={vehicleMake}>
                  {vehicleMake}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="px-2 py-1">
          <Label className="mb-2 block" htmlFor="marketplace-price">
            Price
          </Label>
          <Select value={price} onValueChange={setPrice}>
            <SelectTrigger id="marketplace-price" className="border-0 bg-[hsl(var(--bone))] shadow-none">
              <SelectValue placeholder="Any price" />
            </SelectTrigger>
            <SelectContent>
              {priceRanges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="lg" className="h-12 sm:min-w-40">
          <Search className="h-4 w-4" /> Search cars
        </Button>
      </div>
    </form>
  );
}
