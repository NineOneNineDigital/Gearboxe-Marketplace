"use client";

import { Button } from "@/components/ui/button";
import { SelectedWantedPhotos, useWantedPhotoUpload, validateWantedPhotoFiles } from "@/components/ui/wanted-private-media";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { mileageAsMiles, wantedResponseDifferences } from "@/lib/wanted-response";
import { isUsStateCode } from "@/lib/us-states";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RequestCriteria = {
  _id: Id<"wantedRequests">;
  title: string;
  maxBudget: number;
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  maxMileage?: number;
  area?: string;
  radiusMiles?: number;
  transmission?: string;
};

type ResponseForm = { year: string; make: string; model: string; askingPrice: string; mileage: string; city: string; state: string; message: string };
const emptyForm: ResponseForm = { year: "", make: "", model: "", askingPrice: "", mileage: "", city: "", state: "", message: "" };

export function WantedResponseForm({ request, onCancel }: { request: RequestCriteria; onCancel: () => void }) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const listings = useQuery(api.vehicles.getVehiclesByUser, user ? { userId: user._id } : "skip");
  const reply = useMutation(api.wantedConversations.replyToRequest);
  const photos = useWantedPhotoUpload();
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const differences = wantedResponseDifferences(request, form);
  const approvedListings = listings?.filter(listing => ["active", "approved", "reserved"].includes(listing.status) && !listing.moderationRemovedAt && (listing.status === "reserved" || listing.availabilityDueAt === undefined || listing.availabilityDueAt > Date.now())) ?? [];

  function chooseListing(id: string) {
    const listing = approvedListings.find(item => item._id === id);
    if (!listing) return;
    setForm(previous => ({ ...previous, year: String(listing.year), make: listing.make, model: listing.model,
      askingPrice: String(listing.price), mileage: String(mileageAsMiles(listing.mileage, listing.mileageUnit)), city: listing.location?.city ?? "", state: listing.location?.state ?? "" }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    let photoIds: Id<"wantedReplyPhotos">[] = [];
    try {
      const state = form.state.trim().toUpperCase();
      if (!isUsStateCode(state)) throw new Error("Choose a valid U.S. state or DC code");
      photoIds = await photos.upload(files, request._id);
      const conversationId = await reply({ requestId: request._id, year: Number(form.year), make: form.make,
        model: form.model, askingPrice: Number(form.askingPrice), mileage: Number(form.mileage),
        city: form.city, state, message: form.message, photoIds });
      router.push(`/myAccount/wanted-messages/${conversationId}`);
    } catch (cause) { if (photoIds.length) await photos.discard(photoIds); setError(cause instanceof Error ? cause.message : "Could not send your response."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="mt-4 space-y-4 rounded-lg border bg-slate-50 p-4" aria-label={`Respond to ${request.title}`}>
    <div><h3 className="font-semibold">Respond privately</h3><p className="text-sm text-muted-foreground">Share basic vehicle details with this buyer. You can respond without publishing a listing.</p></div>
    {approvedListings.length > 0 && <label className="block text-sm">Autofill from one of your approved listings<select className="mt-1 w-full rounded-md border bg-white p-2" defaultValue="" onChange={event => chooseListing(event.target.value)}><option value="">Enter details myself</option>{approvedListings.map(listing => <option key={listing._id} value={listing._id}>{listing.year} {listing.make} {listing.model}</option>)}</select></label>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Year *<input required type="number" min="1900" max="2100" step="1" className="mt-1 w-full rounded-md border p-2" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} /></label>
      <label className="text-sm">Make *<input required maxLength={60} className="mt-1 w-full rounded-md border p-2" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} /></label>
      <label className="text-sm">Model *<input required maxLength={60} className="mt-1 w-full rounded-md border p-2" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></label>
      <label className="text-sm">Asking price, USD *<input required type="number" min="1" max="100000000" step="1" className="mt-1 w-full rounded-md border p-2" value={form.askingPrice} onChange={e => setForm({ ...form, askingPrice: e.target.value })} /></label>
      <label className="text-sm">Approximate mileage *<input required type="number" min="0" max="1000000" step="1" className="mt-1 w-full rounded-md border p-2" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value })} /></label>
      <label className="text-sm">City *<input required maxLength={60} className="mt-1 w-full rounded-md border p-2" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
      <label className="text-sm">State *<input required pattern="[A-Za-z]{2}" maxLength={2} className="mt-1 w-full rounded-md border p-2 uppercase" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="NC" /></label>
      <label className="text-sm sm:col-span-2">Short message *<textarea required minLength={1} maxLength={2000} rows={3} className="mt-1 w-full rounded-md border p-2" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Tell the buyer about your vehicle." /></label>
    </div>
    {differences.length > 0 && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">Check your {differences.join(", ")} against this buyer&apos;s request. You can still respond; please explain any difference in your message.</p>}
    {request.transmission && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">The buyer requested {request.transmission} transmission. State your vehicle&apos;s transmission in the message and explain if it differs.</p>}
    <label className="block text-sm">Private photos (optional, up to 10)<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="mt-1 block w-full text-sm" onChange={event => { const selected = Array.from(event.target.files ?? []); try { validateWantedPhotoFiles(selected); setFiles(selected); setError(""); } catch (cause) { setFiles([]); setError(cause instanceof Error ? cause.message : "Invalid photos."); } }} /></label>
    <SelectedWantedPhotos files={files} />
    <p className="text-xs text-muted-foreground">These photos are private to this conversation. Do not include identity documents or contact information.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send private response"}</Button><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button></div>
  </form>;
}
