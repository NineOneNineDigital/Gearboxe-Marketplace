"use client";

import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/ui/user-dropdown";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function Navbar() {
  const { isAuthenticated } = useConvexAuth();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Show loading state while auth is being determined
  if (!authLoaded) {
    return (
      <nav className="border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                Gearboxe Market
              </span>
            </Link>

            {/* Loading state */}
            <div className="flex items-center space-x-4">
              <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
              <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Navigation Links */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                Gearboxe Market
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-6">
              <Link
                href="/vehicles"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/vehicles" ? "text-primary" : "text-gray-700"
                }`}
              >
                Browse Vehicles
              </Link>
              <Link
                href="/events"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/events" ? "text-primary" : "text-gray-700"
                }`}
              >
                Events
              </Link>
            </div>
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {isAuthenticated || isSignedIn ? (
              <UserDropdown afterSignOutUrl="/" />
            ) : (
              <div className="flex items-center space-x-2">
                <Button asChild variant="outline" size="sm">
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
              className="md:hidden"
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
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-2 space-y-1">
              <Link
                href="/vehicles"
                className={`block px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/vehicles" ? "text-primary" : "text-gray-700"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Browse Vehicles
              </Link>
              <Link
                href="/events"
                className={`block px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/events" ? "text-primary" : "text-gray-700"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Events
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
