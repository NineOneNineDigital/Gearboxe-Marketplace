"use client";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { VehicleCard } from "@/components/ui/vehicle-card";
import { VehicleFilters } from "@/components/ui/vehicle-filters";
import { vehicleResults } from "@/lib/vehicle-results";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Car, Grid, List } from "lucide-react";
import { useState } from "react";

export default function VehiclesPage() {
  const [filters, setFilters] = useState({
    make: undefined,
    model: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    minYear: undefined,
    maxYear: undefined,
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const vehicles = vehicleResults(
    useQuery(api.vehicles.getVehicles, {
      status: "approved",
      ...filters,
    })
  );

  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Browse Vehicles
          </h1>
          <p className="text-xl text-gray-600">
            Discover amazing cars from local sellers. Find your next vehicle
            today.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <VehicleFilters onFiltersChange={handleFiltersChange} />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {vehicles
                    ? `${vehicles.length} vehicles found`
                    : "Loading..."}
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Vehicles Grid/List */}
            {vehicles && vehicles.length > 0 ? (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    : "space-y-4"
                }
              >
                {vehicles.map((vehicle) => (
                  <VehicleCard key={vehicle._id} vehicle={vehicle} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Car className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No vehicles found
                </h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your filters or check back later for new
                  listings.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({
                      make: undefined,
                      model: undefined,
                      minPrice: undefined,
                      maxPrice: undefined,
                      minYear: undefined,
                      maxYear: undefined,
                    })
                  }
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
