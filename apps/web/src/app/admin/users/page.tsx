"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Crown, Mail, Star, User, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useState } from "react";

export default function AdminUsersPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const [roleFilter, setRoleFilter] = useState<
    "all" | "user" | "admin" | "superAdmin"
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
  const isSuperAdmin = useQuery(api.users.isSuperAdmin);
  const allUsers = useQuery(api.admin.getAllUsers);
  const updateUserRole = useMutation(api.admin.updateUserRole);

  if (isAdmin === false) {
    redirect("/myAccount");
  }

  if (isAdmin === undefined || !allUsers) {
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
        await updateUserRole({ userId: userId as any, role: newRole });
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
            <p className="text-gray-600">Manage user roles and permissions</p>
          </div>
        </div>
      </div>

      {/* Role Filters */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <Users className="h-5 w-5 text-gray-600" />
          <div className="flex space-x-2">
            {[
              { key: "all", label: "All Users" },
              { key: "user", label: "Users" },
              { key: "admin", label: "Admins" },
              { key: "superAdmin", label: "Super Admins" },
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={roleFilter === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => setRoleFilter(filter.key as any)}
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
                            handleRoleChange(user._id, e.target.value as any)
                          }
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          disabled={
                            user.role === "superAdmin" && isSuperAdmin !== true
                          }
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
