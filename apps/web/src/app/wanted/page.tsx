"use client";

import { Navbar } from "@/components/ui/navbar";
import { Footer } from "@/components/ui/footer";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { WantedResponseForm } from "./wanted-response-form";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default function WantedPage() {
  const { results: requests, status: pageStatus, loadMore } = usePaginatedQuery(api.wanted.browse, {}, { initialNumItems: 24 });
  const report = useMutation(api.wanted.report);
  const { user } = useCurrentUser();
  const mine = useQuery(api.wanted.mine, user ? {} : "skip");
  const myConversations = useQuery(api.wantedConversations.listMine, user ? {} : "skip");
  const [reportId, setReportId] = useState<Id<"wantedRequests"> | null>(null);
  const [respondId, setRespondId] = useState<Id<"wantedRequests"> | null>(null);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    if (!reportId) return;
    setBusy(true); setFeedback("");
    try { await report({ id: reportId, reason, details }); setReportId(null); setDetails(""); setFeedback("Report sent to the safety team."); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Could not send report."); }
    finally { setBusy(false); }
  }

  return <div className="market-page min-h-screen flex flex-col"><Navbar /><main className="market-shell flex-1 py-10 space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">Wanted vehicles</h1><p className="mt-2 text-muted-foreground">See what buyers are looking for across the country. Locations show a general area only.</p></div><Button asChild><Link href="/myAccount/my-requests">Post a request</Link></Button></div>
    {feedback && <p role="status" className="rounded-md border p-3">{feedback}</p>}
    {pageStatus === "LoadingFirstPage" ? <p role="status">Loading wanted requests…</p> : requests.length === 0 ? <p>No active requests yet.</p> : <div className="grid gap-4 md:grid-cols-2">{requests.map(request => <article id={`request-${request._id}`} key={request._id} className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
      <div><h2 className="text-xl font-semibold">{request.title}</h2><p className="text-sm text-muted-foreground">{request.area} · {request.radiusMiles ? `${request.radiusMiles} mile radius` : "Nationwide"}</p></div>
      <p>Maximum budget <strong>{money(request.maxBudget)}</strong></p>
      {(request.make || request.model || request.yearMin || request.yearMax || request.maxMileage || request.transmission) && <p className="text-sm">{[request.make, request.model, request.yearMin && request.yearMax ? `${request.yearMin}–${request.yearMax}` : request.yearMin ?? request.yearMax, request.maxMileage !== undefined ? `Up to ${request.maxMileage.toLocaleString()} miles` : undefined, request.transmission].filter(Boolean).join(" · ")}</p>}
      {request.details && <p className="whitespace-pre-wrap text-sm">{request.details}</p>}
      <p className="text-xs text-muted-foreground">Posted {new Date(request.createdAt).toLocaleDateString()} · Expires {new Date(request.expiresAt).toLocaleDateString()}</p>
      <div className="flex flex-wrap items-center gap-4">
        {mine?.current.some(owned => owned._id === request._id) ? <Link className="text-sm underline" href="/myAccount/my-requests">Manage your request</Link> : myConversations?.find(thread => thread.role === "seller" && thread.requestId === request._id) ? <Link className="text-sm underline" href={`/myAccount/wanted-messages/${myConversations.find(thread => thread.role === "seller" && thread.requestId === request._id)?._id}`}>Continue conversation</Link> : user ? <Button type="button" size="sm" onClick={() => { setRespondId(request._id as Id<"wantedRequests">); setReportId(null); }}>Respond privately</Button> : <Link className="text-sm underline" href={`/sign-in?next=${encodeURIComponent("/wanted")}`}>Sign in to respond</Link>}
        <button className="text-sm underline" onClick={() => { setReportId(request._id as Id<"wantedRequests">); setRespondId(null); setFeedback(""); }}>Report request</button>
      </div>
      {respondId === request._id && <WantedResponseForm request={{ ...request, _id: request._id as Id<"wantedRequests"> }} onCancel={() => setRespondId(null)} />}
    </article>)}</div>}
    {pageStatus === "CanLoadMore" && <Button variant="outline" onClick={() => loadMore(24)}>Load more requests</Button>}
    {reportId && <form onSubmit={submitReport} className="max-w-lg space-y-3 rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Report this request</h2>{!user && <p className="text-sm">Sign in to send a report. <Link className="underline" href="/sign-in">Sign in</Link></p>}<label className="block text-sm">Reason<select className="mt-1 w-full rounded-md border p-2" value={reason} onChange={event => setReason(event.target.value)}><option value="spam">Spam</option><option value="scam">Scam</option><option value="unsafe_content">Unsafe content</option><option value="false_information">False information</option><option value="privacy">Privacy</option><option value="other">Other</option></select></label><label className="block text-sm">Details<textarea required maxLength={2000} className="mt-1 w-full rounded-md border p-2" value={details} onChange={event => setDetails(event.target.value)} /></label><div className="flex gap-2"><Button type="submit" disabled={busy || !user}>Send report</Button><Button type="button" variant="outline" onClick={() => setReportId(null)}>Cancel</Button></div></form>}
  </main><Footer /></div>;
}
