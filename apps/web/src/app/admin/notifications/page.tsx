"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { usePaginatedQuery, useQuery } from "convex/react";

export default function NotificationDeliveriesPage() {
  const isAdmin = useQuery(api.users.isAdmin);
  const { results, status, loadMore } = usePaginatedQuery(api.notifications.adminDeliveries, isAdmin ? {} : "skip", { initialNumItems: 25 });

  if (isAdmin === undefined) return <p role="status" className="p-8">Checking access…</p>;
  if (!isAdmin) return <p role="alert" className="p-8">Admin access required.</p>;

  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
    <h1 className="text-3xl font-bold">Email delivery</h1>
    <p className="text-sm text-muted-foreground">Track provider acceptance, delivery, and retry outcomes. An uncertain outcome needs provider reconciliation before a resend.</p>
    {status === "LoadingFirstPage" ? <p role="status">Loading deliveries…</p> : results.length === 0 ? <p>No email deliveries yet.</p> : <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-left text-sm"><thead className="border-b bg-gray-50"><tr>
        <th className="p-3">Reference</th><th className="p-3">Status</th><th className="p-3">Attempts</th><th className="p-3">Updated</th><th className="p-3">Next retry</th><th className="p-3">Provider reference / result</th>
      </tr></thead><tbody>{results.map((delivery) => <tr key={delivery._id} className="border-b last:border-0">
        <td className="p-3 font-mono text-xs">{delivery._id}</td><td className="p-3">{delivery.status}</td><td className="p-3">{delivery.attempts}</td>
        <td className="p-3">{new Date(delivery.updatedAt).toLocaleString()}</td><td className="p-3">{delivery.status === "pending" ? new Date(delivery.nextAttemptAt).toLocaleString() : "—"}</td>
        <td className="max-w-sm break-words p-3"><p>{delivery.providerId ?? "—"}</p>{delivery.lastError && <p className="mt-1 text-xs text-muted-foreground">{delivery.lastError}</p>}</td>
      </tr>)}</tbody></table>
    </div>}
    {(status === "CanLoadMore" || status === "LoadingMore") && <Button variant="outline" disabled={status === "LoadingMore"} onClick={() => loadMore(25)}>{status === "LoadingMore" ? "Loading…" : "Load more"}</Button>}
  </div>;
}
