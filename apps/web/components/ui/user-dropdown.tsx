"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  Car,
  ChevronDown,
  Heart,
  LogOut,
  MessageCircle,
  Plus,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface UserDropdownProps {
  afterSignOutUrl?: string;
}

export function UserDropdown({ afterSignOutUrl = "/" }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuth();
  const { user } = useUser();
  const { isAuthenticated } = useCurrentUser();
  const pathname = usePathname();
  const isAdmin = useQuery(api.users.isAdmin);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const userInitials = user?.fullName ? getInitials(user.fullName) : "U";

  const menuItems = [
    {
      label: "My Listings",
      href: "/myAccount/my-listings",
      icon: Car,
      active: pathname === "/myAccount/my-listings",
    },
    {
      label: "New Listing",
      href: "/myAccount/new-listing",
      icon: Plus,
      active: pathname === "/myAccount/new-listing",
    },
    {
      label: "Messages",
      href: "/myAccount/messages",
      icon: MessageCircle,
      active: pathname === "/myAccount/messages",
    },
    {
      label: "Favorites",
      href: "/myAccount/favorites",
      icon: Heart,
      active: pathname === "/myAccount/favorites",
    },
  ];

  const adminItems = [
    {
      label: "Admin Panel",
      href: "/admin",
      icon: Shield,
      active: pathname.startsWith("/admin"),
    },
  ];

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 h-auto hover:bg-gray-100 hover:text-gray-900"
      >
        {/* User Avatar */}
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <span className="text-white font-medium text-sm">{userInitials}</span>
        </div>

        {/* User Name */}
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-gray-900">
            {user?.fullName || "User"}
          </div>
          <div className="text-xs text-gray-500">
            {user?.emailAddresses?.[0]?.emailAddress || ""}
          </div>
        </div>

        {/* Dropdown Arrow */}
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {userInitials}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {user?.fullName || "User"}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {user?.emailAddresses?.[0]?.emailAddress || ""}
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-2 text-sm transition-colors hover:bg-gray-50 ${
                    item.active
                      ? "text-primary bg-primary/5 border-r-2 border-primary"
                      : "text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Admin Section */}
          {isAdmin && (
            <>
              <div className="border-t border-gray-100 pt-2">
                <div className="px-4 py-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Admin
                  </div>
                </div>
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center space-x-3 px-4 py-2 text-sm transition-colors hover:bg-gray-50 ${
                        item.active
                          ? "text-primary bg-primary/5 border-r-2 border-primary"
                          : "text-gray-700"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Sign Out */}
          <div className="border-t border-gray-100 pt-2">
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
