"use client";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/convex/_generated/api";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  ArrowUpRight,
  Car,
  Calendar,
  Bell,
  Heart,
  LogOut,
  MessageCircle,
  Plus,
  Shield,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface UserDropdownProps {
  afterSignOutUrl?: string;
  inverse?: boolean;
}

function adminAppOrigin(value: string | undefined, localPort: number) {
  const candidate = value?.trim() || (process.env.NODE_ENV === "development" ? `http://localhost:${localPort}` : "");
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const local = process.env.NODE_ENV === "development" &&
      ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:";
    if ((!local && url.protocol !== "https:") || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

const adminPortalOrigin = adminAppOrigin(process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL, 3002);

export function UserDropdown({
  afterSignOutUrl = "/",
  inverse = false,
}: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuth();
  const { user } = useUser();
  const { isAuthenticated, user: account } = useCurrentUser();
  const pathname = usePathname();
  const isAdmin = !!account && account.suspendedAt === undefined &&
    (account.role === "admin" || account.role === "superAdmin");
  const assignedEvents = useQuery(api.eventOperations.assignedEvents, isAuthenticated && account && !isAdmin && account.suspendedAt === undefined ? {} : "skip");
  const hasEventAccess = isAdmin || !!assignedEvents?.length;
  const adminLinkLabel = account?.role === "admin" ? "Market Admin" : "Gearboxe Admin";

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
    await signOut({ redirectUrl: afterSignOutUrl });
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
  const displayName = user?.fullName || user?.firstName || "User";

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
    { label: "Event registrations", href: "/myAccount/registrations", icon: Calendar, active: pathname === "/myAccount/registrations" },
    {
      label: "Notifications",
      href: "/myAccount/notifications",
      icon: Bell,
      active: pathname === "/myAccount/notifications",
    },
    {
      label: "Trust & Safety",
      href: "/myAccount/safety",
      icon: Shield,
      active: pathname === "/myAccount/safety",
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
        aria-label={`Open account menu for ${displayName}`}
        aria-expanded={isOpen}
        className={`h-10 max-w-24 gap-2 px-2.5 sm:max-w-44 ${
          inverse
            ? "text-[hsl(var(--bone))] hover:bg-white/10 hover:text-white"
            : "hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <UserRound className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 truncate text-xs font-medium">{displayName}</span>
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 max-h-[calc(100dvh-6rem)] w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
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
            <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">My account</p>
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

          {hasEventAccess && adminPortalOrigin && (
            <div className="border-t border-gray-100 py-2">
              <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Administration</p>
              <a
                href={adminPortalOrigin}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Shield className="h-4 w-4" />
                {adminLinkLabel}
                <ArrowUpRight className="ml-auto h-4 w-4" aria-hidden="true" />
              </a>
            </div>
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
