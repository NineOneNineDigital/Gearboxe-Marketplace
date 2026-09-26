"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useAuth, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import {
  Calendar,
  Car,
  CheckCircle,
  Clock,
  Database,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default function AdminDashboardPage() {
  const { isLoading } = useConvexAuth();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();

  // Call all hooks at the top level (Rules of Hooks)
  const isAdmin = useQuery(api.users.isAdmin);
  const isSuperAdmin = useQuery(api.users.isSuperAdmin);
  const adminStats = useQuery(api.admin.getAdminStats);
  const pendingVehicles = useQuery(api.admin.getAllVehicles);
  const upcomingEvents = useQuery(api.events.getUpcomingEvents);

  // Show loading while auth is being determined
  if (!authLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Only redirect if Clerk auth is not loaded or user is not signed in
  if (!isSignedIn || !user) {
    redirect("/sign-in");
  }

  if (isAdmin === false) {
    redirect("/myAccount");
  }

  if (
    isAdmin === null ||
    isAdmin === undefined ||
    !adminStats ||
    !pendingVehicles ||
    !user
  ) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin data...</p>
        </div>
      </div>
    );
  }

  const pendingVehiclesList = pendingVehicles.filter(
    (v) => v.status === "pending"
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Manage vehicles, events, and registrations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="admin-stat-card">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Car className="h-6 w-6 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Vehicles
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {adminStats.totalVehicles}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="admin-stat-card">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Pending Approval
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {adminStats.pendingVehicles}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="admin-stat-card">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">
                  {adminStats.approvedVehicles}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="admin-stat-card">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Upcoming Events
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {adminStats.upcomingEvents}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button asChild className="text-white">
                  <Link href="/admin/listings">
                    <Car className="h-5 w-5 mr-2" />
                    Manage Listings
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/events">
                    <Calendar className="h-5 w-5 mr-2" />
                    Manage Events
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/checkin">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Event Check-in
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/registrations">
                    <Users className="h-5 w-5 mr-2" />
                    View Registrations
                  </Link>
                </Button>
                {isSuperAdmin === true && (
                  <Button asChild variant="outline">
                    <Link href="/admin/users">
                      <Users className="h-5 w-5 mr-2" />
                      Manage Users
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link href="/admin/seed">
                    <Database className="h-5 w-5 mr-2" />
                    Seed Database
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card>
            <CardHeader>
              <CardTitle>
                Pending Approvals ({pendingVehiclesList.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingVehiclesList.length > 0 ? (
                <div className="space-y-4">
                  {pendingVehiclesList.slice(0, 5).map((vehicle) => (
                    <div
                      key={vehicle._id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {vehicle.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {vehicle.year} {vehicle.make} {vehicle.model} • $
                          {vehicle.price.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Listed by {vehicle.user?.name}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/listings?vehicle=${vehicle._id}`}>
                            Review
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                  {pendingVehiclesList.length > 5 && (
                    <div className="text-center">
                      <Button asChild variant="outline">
                        <Link href="/admin/listings">View All Pending</Link>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <p className="text-gray-600">No pending approvals</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents && upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.slice(0, 3).map((event) => (
                    <div key={event._id} className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm">{event.name}</h4>
                      <p className="text-xs text-gray-600">
                        {new Date(event.date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">{event.location}</p>
                      <div className="mt-2">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/events?event=${event._id}`}>
                            Manage
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No upcoming events</p>
                </div>
              )}
              <div className="mt-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/admin/events">Manage Events</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      New vehicle listing submitted
                    </p>
                    <p className="text-xs text-gray-500">2 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      Event registration completed
                    </p>
                    <p className="text-xs text-gray-500">15 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      Vehicle approval pending
                    </p>
                    <p className="text-xs text-gray-500">1 hour ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
