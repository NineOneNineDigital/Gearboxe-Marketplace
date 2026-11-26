"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

function PrivatePreview({ photoId }: { photoId: Id<"photoRequestPhotos"> }) {
  const { getToken } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const load = async () => {
    setBusy(true); setError("");
    try {
      const token = await getToken({ template: "convex" });
      const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
      if (!token || !site) throw new Error("Private photo access is unavailable.");
      const response = await fetch(`${site}/photo-request-media/photo?id=${encodeURIComponent(photoId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("Private photo access is unavailable.");
      setUrl(URL.createObjectURL(await response.blob()));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load photo."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">{url ? <Image unoptimized src={url} alt="Seller-selected private reply photo for moderation" width={320} height={240} className="max-h-60 rounded-lg object-contain" /> : <button type="button" onClick={load} disabled={busy} className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-white">{busy ? "Loading private photo…" : "View private photo"}</button>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}

export default function PhotoReviewsPage() {
  const queue = useQuery(api.photoRequestModeration.adminQueue, {});
  const approve = useAction(api.photoRequestModeration.approve);
  const reject = useMutation(api.photoRequestModeration.reject);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const review = async (selectionId: Id<"photoPublicSelections">, decision: "approve" | "reject") => {
    setBusyId(selectionId); setNotice(""); setError("");
    try {
      if (decision === "approve") {
        const applied = await approve({ selectionId });
        setNotice(applied ? "Photo approved and added to the public listing." : "The listing or selection changed. The private photo was not published.");
      } else {
        await reject({ selectionId, reason: reasons[selectionId] ?? "" });
        setNotice("Photo rejected. The private reply remains visible to its participants.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review failed. Refresh and retry."); }
    finally { setBusyId(null); }
  };
  return <main className="market-shell space-y-6 py-8"><div><h1 className="text-3xl font-bold">Selected photo reviews</h1><p className="mt-2 text-sm text-muted-foreground">Only seller-selected private reply photos appear here. Approving copies one photo to the public listing after a fresh state check.</p></div>
    {notice && <p role="status" className="rounded-md border bg-white p-3 text-sm">{notice}</p>}{error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {queue === undefined ? <p role="status">Loading photo reviews…</p> : queue.length === 0 ? <p>No selected photos need review.</p> : <div className="space-y-4">{queue.map(row => <section key={row._id} className="space-y-4 rounded-xl border bg-white p-5"><div><h2 className="font-semibold">{row.vehicleTitle}</h2><p className="text-sm text-muted-foreground">Listing status: {row.vehicleStatus} · Selected {new Date(row.createdAt).toLocaleString()}</p><Link className="text-sm underline" href={`/admin/listings?vehicle=${row.vehicleId}`}>Open listing review</Link></div><PrivatePreview photoId={row.photoId} /><p className="text-sm">Seller caption: {row.caption || "No caption"}</p><label className="block text-sm">Reason for rejection<textarea maxLength={1000} value={reasons[row._id] ?? ""} onChange={event => setReasons(previous => ({ ...previous, [row._id]: event.target.value }))} className="mt-1 w-full rounded-md border p-2" /></label><div className="flex flex-wrap gap-2"><button type="button" disabled={busyId !== null} onClick={() => review(row._id, "approve")} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve public addition</button><button type="button" disabled={busyId !== null} onClick={() => review(row._id, "reject")} className="rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-50">Reject</button></div></section>)}</div>}
  </main>;
}
