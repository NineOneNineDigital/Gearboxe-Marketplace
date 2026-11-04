"use client";

import Link from "next/link";

export function ListingNotifications({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return <div className="mb-6 rounded-xl border border-border bg-white p-4 text-sm">
    <Link className="font-semibold text-primary underline" href="/myAccount/notifications">View notifications</Link>
    <p className="mt-1 text-muted-foreground">Listing updates, messages, favorite activity, and event confirmations are in your notification inbox.</p>
  </div>;
}
