"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

const categories = [
  ["messages", "New messages"],
  ["listings", "Listing approval and status updates"],
  ["favorites", "Updates to your favorite listings"],
  ["events", "Event payments and check-in confirmations"],
] as const;

type Preferences = { emailEnabled: boolean; messages: boolean; listings: boolean; favorites: boolean; events: boolean; emailSuppressed?: boolean };

function EmailPreferences({ preferences }: { preferences: Preferences }) {
  const updatePreferences = useMutation(api.notifications.updatePreferences);
  const [draft, setDraft] = useState({ emailEnabled: preferences.emailEnabled, messages: preferences.messages, listings: preferences.listings, favorites: preferences.favorites, events: preferences.events });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setFeedback("");
    try { await updatePreferences(draft); setFeedback("Email preferences saved."); }
    catch { setFeedback("Unable to save preferences. Please try again."); }
    finally { setBusy(false); }
  }}>
    <p className="text-sm text-muted-foreground">Choose which updates reach your email. Your in-app inbox stays available when email is turned off.</p>
    {preferences.emailSuppressed && <p role="status" className="text-sm">Email delivery is paused after a bounce or spam complaint. Contact support to review your email address.</p>}
    <label className="flex items-center gap-3 font-medium"><input type="checkbox" disabled={busy} checked={draft.emailEnabled} onChange={(event) => setDraft({ ...draft, emailEnabled: event.target.checked })} />Receive email notifications</label>
    <fieldset disabled={busy || !draft.emailEnabled} className="space-y-3 border-t pt-4 disabled:opacity-60">
      <legend className="sr-only">Email categories</legend>
      {categories.map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} />{label}</label>)}
    </fieldset>
    <Button disabled={busy}>{busy ? "Saving…" : "Save email preferences"}</Button>
    {feedback && <p role="status" className="text-sm">{feedback}</p>}
  </form>;
}

export default function NotificationsPage() {
  const { user, isLoading } = useCurrentUser();
  const { results, status, loadMore } = usePaginatedQuery(api.notifications.list, user ? {} : "skip", { initialNumItems: 20 });
  const preferences = useQuery(api.notifications.preferences, user ? {} : "skip");
  const markRead = useMutation(api.notifications.markRead);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  return <div className="market-page min-h-screen flex flex-col"><Navbar /><main className="market-shell flex-1 py-10 space-y-6">
    <Link href="/myAccount" className="text-sm underline">Back to account</Link>
    <h1 className="text-3xl font-bold">Notifications</h1>
    {isLoading ? <p role="status">Loading your account…</p> : !user ? <Button asChild><Link href="/sign-in">Sign in</Link></Button> : <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
      <Card><CardHeader><CardTitle>Your inbox</CardTitle></CardHeader><CardContent className="space-y-4">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {status === "LoadingFirstPage" && <p role="status">Loading notifications…</p>}
        {status !== "LoadingFirstPage" && results.length === 0 && <p className="text-sm text-muted-foreground">You have no notifications yet.</p>}
        <ul className="space-y-3">{results.map((notification) => <li key={notification._id} className={`rounded-lg border p-4 ${notification.readAt ? "border-border" : "border-primary/25 bg-primary/5"}`}>
          <p className="whitespace-pre-wrap break-words text-sm">{notification.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="capitalize">{notification.category}</span>
            <time dateTime={new Date(notification.createdAt).toISOString()}>{new Date(notification.createdAt).toLocaleString()}</time>
            <Link href={notification.link} className="text-primary underline">View details</Link>
            {!notification.readAt && <Button variant="ghost" size="sm" disabled={busyId === notification._id} onClick={async () => {
              setError(""); setBusyId(notification._id);
              try { await markRead({ id: notification._id }); }
              catch { setError("Unable to mark this notification as read. Please try again."); }
              finally { setBusyId(""); }
            }}>Mark read</Button>}
          </div>
        </li>)}</ul>
        {(status === "CanLoadMore" || status === "LoadingMore") && <Button variant="outline" disabled={status === "LoadingMore"} onClick={() => loadMore(20)}>{status === "LoadingMore" ? "Loading…" : "Load more"}</Button>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Email preferences</CardTitle></CardHeader><CardContent>
        {preferences ? <EmailPreferences key={JSON.stringify(preferences)} preferences={preferences} /> : <p role="status">Loading preferences…</p>}
      </CardContent></Card>
    </div>}
  </main><Footer /></div>;
}
