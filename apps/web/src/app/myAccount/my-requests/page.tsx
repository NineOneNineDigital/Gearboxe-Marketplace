"use client";

import { Navbar } from "@/components/ui/navbar";
import { Footer } from "@/components/ui/footer";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

const initialForm = { title: "", maxBudget: "", zip: "", radiusMiles: "50", make: "", model: "", yearMin: "", yearMax: "", maxMileage: "", transmission: "", details: "" };

export default function MyRequestsPage() {
  const { user, isLoading } = useCurrentUser();
  const { isLoaded, isSignedIn } = useAuth();
  const requests = useQuery(api.wanted.mine, user ? {} : "skip");
  const create = useAction(api.wanted.create);
  const edit = useAction(api.wanted.edit);
  const stillLooking = useMutation(api.wanted.stillLooking);
  const close = useMutation(api.wanted.close);
  const remove = useMutation(api.wanted.remove);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<Id<"wantedRequests"> | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setFeedback("");
    try {
      const values = { title: form.title, maxBudget: Number(form.maxBudget), zip: form.zip,
        radiusMiles: form.radiusMiles === "nationwide" ? undefined : Number(form.radiusMiles),
        make: form.make || undefined, model: form.model || undefined,
        yearMin: form.yearMin ? Number(form.yearMin) : undefined, yearMax: form.yearMax ? Number(form.yearMax) : undefined,
        maxMileage: form.maxMileage ? Number(form.maxMileage) : undefined,
        transmission: form.transmission || undefined, details: form.details || undefined };
      if (editingId) await edit({ id: editingId, ...values }); else await create(values);
      setForm(initialForm); setFeedback(editingId ? "Request updated." : "Your request is live."); setEditingId(null);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Could not post request."); }
    finally { setBusy(false); }
  }

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true); setFeedback("");
    try { await action(); setFeedback(success); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Could not update request."); }
    finally { setBusy(false); }
  }
  function startEdit(request: NonNullable<typeof requests>["current"][number]) {
    setEditingId(request._id);
    setForm({ title: request.title, maxBudget: String(request.maxBudget), zip: request.zip,
      radiusMiles: request.radiusMiles === undefined ? "nationwide" : String(request.radiusMiles),
      make: request.make ?? "", model: request.model ?? "", yearMin: request.yearMin === undefined ? "" : String(request.yearMin),
      yearMax: request.yearMax === undefined ? "" : String(request.yearMax), maxMileage: request.maxMileage === undefined ? "" : String(request.maxMileage),
      transmission: request.transmission ?? "", details: request.details ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function row(request: NonNullable<typeof requests>["current"][number], past: boolean) {
    return <article id={`request-${request._id}`} key={request._id} className="rounded-xl border bg-white p-5 space-y-2"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{request.title}</h3><p className="text-sm text-muted-foreground">Up to ${request.maxBudget.toLocaleString()} · {request.area} · {request.radiusMiles ? `${request.radiusMiles} miles` : "Nationwide"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{request.status === "removed" ? "Removed by safety team" : request.status === "closed" ? "Closed" : past ? "Expired" : "Active"}</span></div><p className="text-sm">Expires {new Date(request.expiresAt).toLocaleDateString()}</p>{request.status === "removed" && <p className="text-sm">This request was removed for a safety concern. Visit <Link className="underline" href="/myAccount/safety">Safety & support</Link> for help.</p>}<div className="flex flex-wrap gap-2">{request.status !== "removed" && <><Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(request)}>Edit</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => stillLooking({ id: request._id as Id<"wantedRequests"> }), "Request renewed for 30 days.")}>Still looking</Button>{!past && <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => close({ id: request._id as Id<"wantedRequests"> }), "Request closed.")}>Close</Button>}</>}<Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm("Delete this request from your board and Past requests?")) void act(() => remove({ id: request._id as Id<"wantedRequests"> }), "Request deleted."); }}>Delete</Button></div></article>;
  }

  return <div className="market-page min-h-screen flex flex-col"><Navbar /><main className="market-shell flex-1 py-10 space-y-8"><div className="flex flex-wrap justify-between gap-4"><div><Link href="/myAccount" className="text-sm underline">Back to account</Link><h1 className="mt-3 text-3xl font-bold">My wanted requests</h1><p className="mt-2 text-muted-foreground">Tell the community what vehicle you are looking for. Requests expire after 30 days.</p></div><Button asChild variant="outline"><Link href="/wanted">View public board</Link></Button></div>
    {!isLoaded || isLoading ? <p role="status">Loading your account…</p> : !isSignedIn ? <p><Link className="underline" href="/sign-in">Sign in</Link> to post a request.</p> : !user ? <p role="status">Setting up your account…</p> : <>
      {feedback && <p role="status" className="rounded-md border p-3">{feedback}</p>}
      {!user.emailVerified ? <p className="rounded-md border border-amber-300 bg-amber-50 p-4">Verify your email in account settings before posting.</p> : <form onSubmit={submit} className="max-w-3xl rounded-xl border bg-white p-5 space-y-4"><h2 className="text-xl font-semibold">{editingId ? "Edit wanted request" : "Post a wanted request"}</h2><div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm">Title *<input required maxLength={120} className="mt-1 w-full rounded-md border p-2" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Looking for a reliable family SUV" /></label>
        <label className="text-sm">Maximum budget, USD *<input required type="number" min="1" max="100000000" step="1" className="mt-1 w-full rounded-md border p-2" value={form.maxBudget} onChange={e => setForm({ ...form, maxBudget: e.target.value })} /></label>
        <label className="text-sm">Private ZIP code *<input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} className="mt-1 w-full rounded-md border p-2" value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></label>
        <div className="space-y-2"><label className="block text-sm">Search radius in miles<input required={form.radiusMiles !== "nationwide"} disabled={form.radiusMiles === "nationwide"} type="number" min="1" max="500" step="1" className="mt-1 w-full rounded-md border p-2" value={form.radiusMiles === "nationwide" ? "" : form.radiusMiles} onChange={e => setForm({ ...form, radiusMiles: e.target.value })} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.radiusMiles === "nationwide"} onChange={e => setForm({ ...form, radiusMiles: e.target.checked ? "nationwide" : "50" })} />Nationwide</label></div>
        <label className="text-sm">Make<input maxLength={60} className="mt-1 w-full rounded-md border p-2" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} /></label>
        <label className="text-sm">Model<input maxLength={60} className="mt-1 w-full rounded-md border p-2" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></label>
        <label className="text-sm">Minimum year<input type="number" min="1900" max="2100" className="mt-1 w-full rounded-md border p-2" value={form.yearMin} onChange={e => setForm({ ...form, yearMin: e.target.value })} /></label>
        <label className="text-sm">Maximum year<input type="number" min="1900" max="2100" className="mt-1 w-full rounded-md border p-2" value={form.yearMax} onChange={e => setForm({ ...form, yearMax: e.target.value })} /></label>
        <label className="text-sm">Maximum mileage<input type="number" min="0" max="1000000" className="mt-1 w-full rounded-md border p-2" value={form.maxMileage} onChange={e => setForm({ ...form, maxMileage: e.target.value })} /></label>
        <label className="text-sm">Transmission<input maxLength={40} className="mt-1 w-full rounded-md border p-2" value={form.transmission} onChange={e => setForm({ ...form, transmission: e.target.value })} /></label>
        <label className="sm:col-span-2 text-sm">More details<textarea maxLength={1000} className="mt-1 w-full rounded-md border p-2" value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} /></label>
      </div><p className="text-sm text-muted-foreground">Only your city and state appear publicly. Your ZIP and account details stay private. You can post up to five new requests per day; edits and renewals do not count.</p><div className="flex gap-2"><Button type="submit" disabled={busy}>{editingId ? "Save changes" : "Post request"}</Button>{editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(initialForm); }}>Cancel edit</Button>}</div></form>}
      <section className="space-y-3"><h2 className="text-xl font-semibold">Current</h2>{requests === undefined ? <p>Loading requests…</p> : requests.current.length ? requests.current.map(request => row(request, false)) : <p>No current requests.</p>}</section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Past</h2>{requests === undefined ? <p>Loading requests…</p> : requests.past.length ? requests.past.map(request => row(request, true)) : <p>No past requests.</p>}</section>
    </>}
  </main><Footer /></div>;
}
