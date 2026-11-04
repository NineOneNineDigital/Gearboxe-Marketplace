"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Crown, Mail, Star, User, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useState } from "react";

type EventRole = "manager" | "checkin";
type EventOption = { _id: Id<"events">; name: string; cancelledAt?: number };
type EventAssignment = { _id: Id<"eventStaff">; eventId: Id<"events">; userId: Id<"users">; role: EventRole; eventName: string };

function UserEventAccess({ userId, assignments, events }: { userId: Id<"users">; assignments: EventAssignment[]; events: EventOption[] }) {
  const assignStaff = useMutation(api.eventOperations.assignStaff);
  const removeStaff = useMutation(api.eventOperations.removeStaff);
  const [eventId, setEventId] = useState("");
  const [role, setRole] = useState<EventRole>("checkin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const availableEvents = events.filter((event) => event.cancelledAt === undefined && !assignments.some((assignment) => assignment.eventId === event._id));

  async function changeRole(assignment: EventAssignment, nextRole: EventRole) {
    setBusy(true);
    setError("");
    try {
      await assignStaff({ eventId: assignment.eventId, userId, role: nextRole });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update event role.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(assignment: EventAssignment) {
    if (!window.confirm(`Remove access to ${assignment.eventName}?`)) return;
    setBusy(true);
    setError("");
    try {
      await removeStaff({ eventId: assignment.eventId, userId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove event access.");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!eventId) return;
    setBusy(true);
    setError("");
    try {
      await assignStaff({ eventId: eventId as Id<"events">, userId, role });
      setEventId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to assign event role.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Event access</p>
    {assignments.length === 0 ? <p className="text-sm text-gray-500">No event assignments</p> : assignments.map((assignment) => <div key={assignment._id} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-0 flex-1 font-medium text-gray-800">{assignment.eventName}</span>
      <select aria-label={`Role for ${assignment.eventName}`} value={assignment.role} disabled={busy} onChange={(event) => void changeRole(assignment, event.target.value as EventRole)} className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-800">
        <option value="manager">Events Admin</option>
        <option value="checkin">Events Staff</option>
      </select>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove(assignment)}>Remove</Button>
    </div>)}
    {availableEvents.length > 0 ? <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-36 flex-1 text-xs font-medium text-gray-600">Event
        <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm text-gray-800">
          <option value="">Select an event</option>
          {availableEvents.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-gray-600">Role
        <select value={role} onChange={(event) => setRole(event.target.value as EventRole)} className="mt-1 block rounded border border-gray-300 bg-white px-2 py-2 text-sm text-gray-800">
          <option value="checkin">Events Staff</option>
          <option value="manager">Events Admin</option>
        </select>
      </label>
      <Button type="button" size="sm" disabled={busy || !eventId} onClick={() => void add()}>Assign</Button>
    </div> : null}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}

export default function AdminUsersPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const [roleFilter, setRoleFilter] = useState<
    "all" | "user" | "admin" | "superAdmin" | "eventAdmin" | "eventStaff"
  >("all");

  const isAdmin = useQuery(api.users.isAdmin);
  const isSuperAdmin = useQuery(api.users.isSuperAdmin);
  const allUsers = useQuery(api.admin.getAllUsers, isAdmin === true ? {} : "skip");
  const allEvents = useQuery(api.admin.getAllEvents, isAdmin === true ? {} : "skip");
  const eventAssignments = useQuery(api.eventOperations.listAllStaffAssignments, isAdmin === true ? {} : "skip");
  const updateUserRole = useMutation(api.admin.updateUserRole);


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


  if (isAdmin === false) {
    redirect("/myAccount");
  }

  if (isAdmin === undefined || !allUsers || !allEvents || !eventAssignments) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin data...</p>
        </div>
      </div>
    );
  }

  const filteredUsers = allUsers.filter((user) => {
    if (roleFilter === "all") return true;
    if (roleFilter === "eventAdmin") return eventAssignments.some((assignment) => assignment.userId === user._id && assignment.role === "manager");
    if (roleFilter === "eventStaff") return eventAssignments.some((assignment) => assignment.userId === user._id && assignment.role === "checkin");
    return user.role === roleFilter;
  });

  const handleRoleChange = async (
    userId: string,
    newRole: "user" | "admin" | "superAdmin"
  ) => {
    // Only superAdmin can promote to superAdmin
    if (newRole === "superAdmin" && isSuperAdmin !== true) {
      alert("Only super admins can promote users to super admin");
      return;
    }

    if (
      confirm(`Are you sure you want to change this user's role to ${newRole}?`)
    ) {
      try {
        await updateUserRole({ userId: userId as Id<"users">, role: newRole });
      } catch (error) {
        console.error("Error updating user role:", error);
      }
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "superAdmin":
        return <Star className="h-4 w-4 text-purple-600" />;
      case "admin":
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case "user":
        return <User className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "superAdmin":
        return "bg-purple-100 text-purple-800";
      case "admin":
        return "bg-yellow-100 text-yellow-800";
      case "user":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
              User Management
            </h1>
            <p className="text-gray-600">Set global roles and manage event-specific access separately.</p>
          </div>
        </div>
      </div>

      {allEvents.length === 0 && <p className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">Events Admin and Events Staff roles are assigned to individual events. <Link href="/admin/events" className="font-medium text-primary underline">Create an event</Link> to make those roles available.</p>}

      {/* Role Filters */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <Users className="h-5 w-5 text-gray-600" />
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All Users" },
              { key: "user", label: "Users" },
              { key: "admin", label: "Admins" },
              { key: "superAdmin", label: "Super Admins" },
              { key: "eventAdmin", label: "Events Admins" },
              { key: "eventStaff", label: "Events Staff" },
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={roleFilter === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => setRoleFilter(filter.key as typeof roleFilter)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {filteredUsers.length > 0 ? (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <Card key={user._id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          {getRoleIcon(user.role)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{user.name}</h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Mail className="h-4 w-4" />
                            <span>{user.email}</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Joined{" "}
                            {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span
                          className={`px-3 py-1 text-sm rounded-full capitalize ${getRoleColor(user.role)}`}
                        >
                          {user.role}
                        </span>

                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user._id, e.target.value as "user" | "admin" | "superAdmin")
                          }
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          disabled={isSuperAdmin !== true}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option
                            value="superAdmin"
                            disabled={isSuperAdmin !== true}
                          >
                            Super Admin
                          </option>
                        </select>
                      </div>
                    </div>
                    <UserEventAccess userId={user._id} assignments={eventAssignments.filter((assignment) => assignment.userId === user._id)} events={allEvents} />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-16">
                <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Users Found
                </h3>
                <p className="text-gray-600">
                  {roleFilter === "all"
                    ? "No users have been registered yet."
                    : `No ${roleFilter} users found.`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>User Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Users</span>
                <span className="font-medium">{allUsers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Super Admins</span>
                <span className="font-medium text-purple-600">
                  {allUsers.filter((u) => u.role === "superAdmin").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Admins</span>
                <span className="font-medium text-yellow-600">
                  {allUsers.filter((u) => u.role === "admin").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Users</span>
                <span className="font-medium text-blue-600">
                  {allUsers.filter((u) => u.role === "user").length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Role Permissions */}
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Star className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-purple-800">
                    Super Admin
                  </span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Full system access</li>
                  <li>• User role management</li>
                  <li>• System settings</li>
                </ul>
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Crown className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Admin</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Manage listings</li>
                  <li>• Manage events</li>
                  <li>• Event check-in</li>
                </ul>
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">User</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Buy vehicles</li>
                  <li>• Sell vehicles</li>
                  <li>• Register for events</li>
                </ul>
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-medium text-gray-800">Events Admin</span>
                </div>
                <p className="text-sm text-gray-600">Manage operations for assigned events only.</p>
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-medium text-gray-800">Events Staff</span>
                </div>
                <p className="text-sm text-gray-600">Check in attendees at assigned events only.</p>
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
                <Link href="/admin/listings">Manage Listings</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin/events">Manage Events</Link>
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
