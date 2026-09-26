"use client";

import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/ui/user-dropdown";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import {
  ArrowLeft,
  Calendar,
  Car,
  CheckCircle,
  Database,
  Menu,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function AdminNavbar() {
  const { isAuthenticated } = useConvexAuth();
  const { isSignedIn, isLoaded: authLoaded, user } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = useQuery(api.users.isAdmin);
  const isSuperAdmin = useQuery(api.users.isSuperAdmin);

  // Show loading state while auth is being determined
  if (!authLoaded) {
    return (
      <nav className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">Admin Panel</span>
            </div>

            {/* Loading state */}
            <div className="flex items-center space-x-4">
              <div className="animate-pulse bg-gray-700 h-8 w-16 rounded"></div>
              <div className="animate-pulse bg-gray-700 h-8 w-16 rounded"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  if (!isSignedIn || !user || isAdmin === false) {
    return null;
  }

  const adminNavItems = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: Settings,
      active: pathname === "/admin",
    },
    {
      href: "/admin/listings",
      label: "Listings",
      icon: Car,
      active: pathname.startsWith("/admin/listings"),
    },
    {
      href: "/admin/events",
      label: "Events",
      icon: Calendar,
      active: pathname.startsWith("/admin/events"),
    },
    {
      href: "/admin/checkin",
      label: "Check-in",
      icon: CheckCircle,
      active: pathname.startsWith("/admin/checkin"),
    },
    {
      href: "/admin/users",
      label: "Users",
      icon: Users,
      active: pathname.startsWith("/admin/users"),
      show: isSuperAdmin === true, // Only show for superAdmin
    },
    {
      href: "/admin/seed",
      label: "Database",
      icon: Database,
      active: pathname.startsWith("/admin/seed"),
    },
  ].filter((item) => item.show !== false); // Filter out items that shouldn't be shown

  return (
    <nav className="admin-navbar text-white shadow-lg relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Navigation Links */}
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">Admin Panel</span>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-6">
              {adminNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 text-sm font-medium transition-colors hover:text-primary ${
                    item.active ? "text-primary" : "text-gray-300"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {/* Back to main site */}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-gray-300 hover:text-white"
            >
              <Link href="/myAccount">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Site
              </Link>
            </Button>

            {isAuthenticated || isSignedIn ? (
              <UserDropdown afterSignOutUrl="/" />
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="text-white border-gray-600 hover:bg-gray-800"
                >
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild size="sm" className="text-white">
                  <Link href="/sign-up">Sign Up</Link>
                </Button>
              </div>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-gray-300 hover:text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-700 bg-gray-800">
            <div className="px-4 py-2 space-y-1">
              {adminNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                    item.active ? "text-primary" : "text-gray-300"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
              <div className="border-t border-gray-700 pt-2 mt-2">
                <Link
                  href="/myAccount"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-300 hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Site</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
