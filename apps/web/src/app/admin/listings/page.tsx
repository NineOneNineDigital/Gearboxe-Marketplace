"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, CheckCircle, Eye, Filter, XCircle } from "lucide-react";
import Link from "next/link";
import { redirect, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AdminListingsPage() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    redirect("/sign-in");
  }

  const isAdmin = useQuery(api.users.isAdmin);
  const allVehicles = useQuery(api.admin.getAllVehicles);
  const approveVehicle = useMutation(api.vehicles.approveVehicle);
  const rejectVehicle = useMutation(api.vehicles.rejectVehicle);

  if (isAdmin === false) {
    redirect("/myAccount");
  }

  if (isAdmin === undefined || !allVehicles) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin data...</p>
        </div>
      </div>
    );
  }

  const filteredVehicles = allVehicles.filter((vehicle) => {
    if (statusFilter === "all") return true;
    return vehicle.status === statusFilter;
  });

  const handleApprove = async (vehicleId: string) => {
    try {
      await approveVehicle({ id: vehicleId as any });
    } catch (error) {
      console.error("Error approving vehicle:", error);
    }
  };

  const handleReject = async (vehicleId: string) => {
    if (confirm("Are you sure you want to reject this listing?")) {
      try {
        await rejectVehicle({ id: vehicleId as any });
      } catch (error) {
        console.error("Error rejecting vehicle:", error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "status-approved";
      case "pending":
        return "status-pending";
      case "rejected":
        return "status-rejected";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const selectedVehicleId = searchParams.get("vehicle");
  const selectedVehicle = selectedVehicleId
    ? allVehicles.find((v) => v._id === selectedVehicleId)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin Dashboard
            </Link>
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Manage Listings
            </h1>
            <p className="text-gray-600">Review and approve vehicle listings</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <div className="flex space-x-2">
            {[
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "approved", label: "Approved" },
              { key: "rejected", label: "Rejected" },
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={statusFilter === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(filter.key as any)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Listings Grid */}
        <div className="lg:col-span-2">
          {filteredVehicles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredVehicles.map((vehicle) => (
                <Card key={vehicle._id} className="overflow-hidden">
                  <div className="relative">
                    {vehicle.photos.length > 0 ? (
                      <img
                        src={vehicle.photos[0]}
                        alt={vehicle.title}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500">No Image</span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(vehicle.status)}`}
                      >
                        {vehicle.status}
                      </span>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg line-clamp-1 mb-2">
                      {vehicle.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                      <span>{vehicle.mileage.toLocaleString()} miles</span>
                      <span className="font-semibold text-primary text-lg">
                        ${vehicle.price.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 mb-4">
                      <p>Listed by: {vehicle.user?.name}</p>
                      <p>Contact: {vehicle.contactInfo}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Link href={`/vehicles/${vehicle._id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                      {vehicle.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(vehicle._id)}
                            className="admin-success-btn"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReject(vehicle._id)}
                            className="admin-danger-btn"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-16">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="h-16 w-16 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0M15 17a2 2 0 104 0"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Listings Found
                </h3>
                <p className="text-gray-600">
                  {statusFilter === "all"
                    ? "No vehicle listings have been submitted yet."
                    : `No ${statusFilter} listings found.`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Listing Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Listings</span>
                <span className="font-medium">{allVehicles.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="font-medium text-yellow-600">
                  {allVehicles.filter((v) => v.status === "pending").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Approved</span>
                <span className="font-medium text-green-600">
                  {allVehicles.filter((v) => v.status === "approved").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Rejected</span>
                <span className="font-medium text-red-600">
                  {allVehicles.filter((v) => v.status === "rejected").length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin/events">Manage Events</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin/checkin">Event Check-in</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin">Admin Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
