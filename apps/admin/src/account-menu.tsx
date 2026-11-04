"use client";

import { Button } from "@/components/ui/button";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { LogOut, Settings, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function AccountMenu() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { openUserProfile } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  if (!user) return null;

  const displayName = user.fullName || user.firstName || "User";

  return (
    <div className="relative" ref={menuRef}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={`Open account menu for ${displayName}`}
        aria-expanded={isOpen}
        className="h-10 max-w-24 gap-2 px-2.5 text-[hsl(var(--bone))] hover:bg-white/10 hover:text-white sm:max-w-44"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <UserRound className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 truncate text-xs font-medium">{displayName}</span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-white py-2 text-foreground shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</p>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              setIsOpen(false);
              openUserProfile();
            }}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Manage profile
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 border-t border-border px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => void signOut({ redirectUrl: "/sign-in" })}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
