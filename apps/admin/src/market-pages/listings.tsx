"use client";

import { Button } from "@/components/ui/button";
import { reasonLabel, safetyReasons, type SafetyReason } from "@/components/ui/safety-controls";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { displayDisclosure } from "@/lib/disclosure";
import { isTrustedImageUrl } from "@/lib/trusted-images";
import { useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { summarizeDealerRisk } from "@/convex/lib/dealerRiskPolicy";
import { ArrowLeft, ArrowUpRight, CarFront, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ListingStatus = "all" | "draft" | "pending" | "active" | "rejected" | "reserved" | "sold" | "withdrawn" | "archived";
type ChangeableStatus = Exclude<ListingStatus, "all" | "rejected">;
const PAGE_SIZE = 15;
// Generated references are refreshed by Convex codegen on deployment.
const riskQuery = makeFunctionReference<"query", { vehicleId: Id<"vehicles"> }, ReturnType<typeof summarizeDealerRisk>>("dealerRisk:forListing");
const recordRiskReview = makeFunctionReference<"mutation", { vehicleId: Id<"vehicles">; nextStep: "request_evidence" | "escalate" | "reviewed"; reason: string }, null>("dealerRisk:recordReview");
type EvidenceTrigger = "ambiguous_ownership" | "vin_identity" | "fraud_report" | "repeat_activity" | "title" | "lien";
const filters: { value: ListingStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "archived", label: "Archived" },
];
const transitions: Record<string, ChangeableStatus[]> = {
  draft: ["pending", "withdrawn", "archived"],
  pending: ["draft", "withdrawn", "archived"],
  active: ["pending", "reserved", "sold", "withdrawn", "archived"],
  approved: ["pending", "reserved", "sold", "withdrawn", "archived"],
  rejected: ["draft", "pending", "withdrawn", "archived"],
  reserved: ["pending", "active", "sold", "withdrawn", "archived"],
  sold: ["archived"],
  withdrawn: ["draft", "archived"],
  archived: ["draft"],
};
const dateLabel = (time: number) => new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const timeLabel = (time: number) => new Date(time).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
function pendingSince(vehicle: { status: string; createdAt: number; moderationHistory?: { toStatus: string; createdAt: number }[] }) {
  if (vehicle.status !== "pending") return undefined;
  return [...(vehicle.moderationHistory ?? [])].reverse().find((entry) => entry.toStatus === "pending")?.createdAt;
}
const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
const statusStyle = (status: string) => status === "pending"
  ? "bg-amber-100 text-amber-900"
  : status === "active" || status === "approved"
    ? "bg-emerald-100 text-emerald-900"
    : status === "rejected"
      ? "bg-rose-100 text-rose-900"
      : "bg-black/5 text-[hsl(var(--gunmetal))]";
function needsLocationRemediation(vehicle: {
  status: string;
  location?: { latitude?: number; longitude?: number };
  moderationRemovedAt?: number;
}) {
  return ["approved", "active", "reserved"].includes(vehicle.status) && vehicle.moderationRemovedAt === undefined &&
    (vehicle.location?.latitude === undefined || vehicle.location?.longitude === undefined);
}

export default function AdminListingsPage() {
  const { isAuthenticated } = useConvexAuth();
  const vehicles = useQuery(api.admin.getAllVehicles, isAuthenticated ? {} : "skip");
  const offerReviews = usePaginatedQuery(api.offers.reviewQueue, isAuthenticated ? {} : "skip", { initialNumItems: 15 });
  const approveVehicle = useMutation(api.vehicles.approveVehicle);
  const rejectVehicle = useMutation(api.vehicles.rejectVehicle);
  const changeVehicleStatus = useMutation(api.vehicles.changeVehicleStatus);
  const takedownListing = useMutation(api.trust.takedownListing);
  const restoreListing = useMutation(api.trust.restoreListing);
  const recordReview = useMutation(recordRiskReview);
  const requestEvidence = useMutation(api.trust.requestListingEvidence);
  const resolveEnhancedReview = useMutation(api.trust.resolveListingReview);
  const [statusFilter, setStatusFilter] = useState<ListingStatus>("all");
  const [needsLocationOnly, setNeedsLocationOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<Id<"vehicles"> | null>(null);
  const [nextStatus, setNextStatus] = useState<ChangeableStatus | "">("");
  const [reason, setReason] = useState("");
  const [safetyReason, setSafetyReason] = useState<SafetyReason>(safetyReasons[0]);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewStep, setReviewStep] = useState<"request_evidence" | "escalate" | "reviewed">("request_evidence");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [evidenceTrigger, setEvidenceTrigger] = useState<EvidenceTrigger>("ambiguous_ownership");
  const [evidenceReason, setEvidenceReason] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [evidenceFeedback, setEvidenceFeedback] = useState("");
  const risk = useQuery(riskQuery, isAuthenticated && selectedId ? { vehicleId: selectedId } : "skip");
  const enhancedReview = useQuery(api.trust.getListingReview, isAuthenticated && selectedId ? { vehicleId: selectedId } : "skip");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedId && !dialog.open) dialog.showModal();
    if (!selectedId && dialog.open) dialog.close();
  }, [selectedId]);

  const selected = vehicles?.find((vehicle) => vehicle._id === selectedId);
  const sorted = [...(vehicles ?? [])].sort((a, b) => {
    if (statusFilter === "pending") return (pendingSince(a) ?? a.createdAt) - (pendingSince(b) ?? b.createdAt);
    return b.createdAt - a.createdAt;
  });
  const pendingQueue = (vehicles ?? []).filter((vehicle) => vehicle.status === "pending");
  const locationQueue = (vehicles ?? []).filter(needsLocationRemediation);
  const knownSubmissionTimes = pendingQueue.map(pendingSince).filter((value): value is number => value !== undefined);
  const oldestPending = knownSubmissionTimes.length ? Math.min(...knownSubmissionTimes) : undefined;
  const unknownSubmissionCount = pendingQueue.length - knownSubmissionTimes.length;
  const query = search.trim().toLowerCase();
  const filtered = sorted.filter((vehicle) => {
    if (needsLocationOnly && !needsLocationRemediation(vehicle)) return false;
    if (statusFilter !== "all" && !(statusFilter === "active" && vehicle.status === "approved") && vehicle.status !== statusFilter) return false;
    return !query || [vehicle.title, vehicle.make, vehicle.model, vehicle.vin, vehicle.user?.name, vehicle.user?.email]
      .some((value) => value?.toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const today = new Date();
  const months = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(today.getFullYear(), today.getMonth() - 11 + index, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return {
      key: start.toISOString(),
      label: start.toLocaleDateString("en-US", { month: "short" }),
      year: start.getFullYear(),
      count: vehicles?.filter((vehicle) => vehicle.createdAt >= start.getTime() && vehicle.createdAt < end.getTime()).length ?? 0,
    };
  });
  const chartMax = Math.max(1, ...months.map((month) => month.count));
  const thisMonth = months[11]?.count ?? 0;

  function openVehicle(id: Id<"vehicles">) {
    setSelectedId(id);
    setNextStatus("");
    setReason("");
    setActionError("");
    setReviewReason("");
    setReviewFeedback("");
    setReviewStep("request_evidence");
    setEvidenceReason("");
    setEvidenceDocumentId("");
    setEvidenceFeedback("");
  }

  async function saveEvidenceReview(action: "request" | "clear") {
    if (!selected || !enhancedReview || !evidenceReason.trim() || busy) return;
    setBusy(true);
    setEvidenceFeedback("");
    try {
      if (action === "request") await requestEvidence({ vehicleId: selected._id, expectedRevision: enhancedReview.revision, trigger: evidenceTrigger, reason: evidenceReason.trim() });
      else await resolveEnhancedReview({ vehicleId: selected._id, expectedRevision: enhancedReview.revision, reason: evidenceReason.trim(), documentId: evidenceDocumentId ? evidenceDocumentId as Id<"ownershipDocuments"> : undefined });
      setEvidenceReason("");
      setEvidenceDocumentId("");
      setEvidenceFeedback(action === "request" ? "Evidence request recorded. The listing returned to review and the seller can see the next step." : "Enhanced review cleared for this listing revision. Approve separately after checking the complete listing.");
    } catch (error) {
      setEvidenceFeedback(error instanceof Error ? error.message : "Unable to save enhanced review.");
    } finally { setBusy(false); }
  }

  async function saveReview() {
    if (!selected || !reviewReason.trim() || busy) return;
    setBusy(true);
    setReviewFeedback("");
    try {
      await recordReview({ vehicleId: selected._id, nextStep: reviewStep, reason: reviewReason.trim() });
      setReviewReason("");
      setReviewFeedback("Review step recorded in the audit log. This did not change the listing or notify the seller.");
    } catch (error) {
      setReviewFeedback(error instanceof Error ? error.message : "Unable to record review.");
    } finally { setBusy(false); }
  }

  async function performAction(action: "approve" | "reject" | "change" | "takedown" | "restore") {
    if (!selected || busy) return;
    if (action === "reject" && !reason.trim()) {
      setActionError("Enter a reason before rejecting this listing.");
      return;
    }
    if (action === "change" && !nextStatus) {
      setActionError("Choose a new status.");
      return;
    }
    if (action === "restore" && !reason.trim()) {
      setActionError("Enter a reason before returning this listing for review.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      if (action === "approve") await approveVehicle({ id: selected._id });
      if (action === "reject") await rejectVehicle({ id: selected._id, reason: reason.trim() });
      if (action === "change" && nextStatus) await changeVehicleStatus({ id: selected._id, status: nextStatus, reason: reason.trim() || undefined });
      if (action === "takedown") await takedownListing({ vehicleId: selected._id, reason: safetyReason });
      if (action === "restore") await restoreListing({ vehicleId: selected._id, reason: reason.trim() });
      setNextStatus("");
      setReason("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update this listing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-full bg-[hsl(var(--bone))]">
      <section className="border-b border-black/10 bg-[hsl(var(--midnight))] text-[hsl(var(--bone))]">
        <div className="market-shell py-8 sm:py-10">
          <Link href="/admin" className="inline-flex items-center gap-2 text-xs text-[hsl(var(--chrome))] hover:text-white"><ArrowLeft className="h-4 w-4" /> Overview</Link>
          <p className="market-eyebrow mt-6 text-[hsl(var(--chrome))]">Marketplace operations</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Manage listings<span className="text-primary">.</span></h1>
          <p className="mt-2 text-sm text-[hsl(var(--chrome))]">Track listing activity and review every vehicle from one place.</p>
        </div>
      </section>

      <div className="market-shell space-y-7 py-8 sm:py-10">
        <section aria-labelledby="review-queue-heading" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-7">
          <div>
            <h2 id="review-queue-heading" className="text-lg font-semibold text-amber-950">Pending review queue</h2>
            <p className="mt-1 text-sm text-amber-900">{vehicles ? `${pendingQueue.length} listing${pendingQueue.length === 1 ? "" : "s"} pending` : "Loading queue…"}{oldestPending ? ` · oldest known submission ${timeLabel(oldestPending)} ET` : ""}{unknownSubmissionCount ? ` · ${unknownSubmissionCount} submission time${unknownSubmissionCount === 1 ? "" : "s"} unavailable` : ""}</p>
            <p className="mt-1 text-xs text-amber-900">Known submissions sort oldest first. Missing times use creation as a provisional position. A business-day deadline requires approved coverage hours and cutoff rules.</p>
          </div>
          <Button variant="outline" disabled={!pendingQueue.length} onClick={() => { setNeedsLocationOnly(false); setStatusFilter("pending"); setSearch(""); setPage(1); }}>Review pending queue</Button>
        </section>
        <section aria-labelledby="location-queue-heading" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white p-5 sm:p-7">
          <div>
            <h2 id="location-queue-heading" className="text-lg font-semibold">Nearby search location review</h2>
            <p className="mt-1 text-sm text-muted-foreground">{vehicles ? `${locationQueue.length} approved or reserved listing${locationQueue.length === 1 ? "" : "s"} need${locationQueue.length === 1 ? "s" : ""} a mapped location` : "Loading location review…"}</p>
            <p className="mt-1 text-xs text-muted-foreground">These listings remain visible nationwide but cannot appear in ZIP-radius results until the seller supplies an approximate location and the listing is reindexed.</p>
          </div>
          <Button variant="outline" disabled={!locationQueue.length} onClick={() => { setNeedsLocationOnly(true); setStatusFilter("all"); setSearch(""); setPage(1); }}>Review location gaps</Button>
        </section>
        <section aria-labelledby="offer-followup-heading" className="rounded-2xl border border-black/10 bg-white p-5 sm:p-7">
          <h2 id="offer-followup-heading" className="text-lg font-semibold">Reservation follow-up</h2>
          <p className="mt-1 text-xs text-muted-foreground">Reservations stay reserved when the seven-day check is unanswered. Follow up with the seller; confirm Sold or Available before changing listing state.</p>
          {offerReviews.status === "LoadingFirstPage" ? <p role="status" className="mt-4 text-sm">Loading offer follow-ups…</p> : offerReviews.results.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No reservations need follow-up.</p> : <ul className="mt-4 divide-y divide-black/10 border-y border-black/10">{offerReviews.results.map((item) => {
            const listing = vehicles?.find((vehicle) => vehicle._id === item.vehicleId);
            return <li key={item.threadId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div><p className="font-medium">{listing?.title ?? "Listing unavailable"}</p><p className="mt-1 text-xs text-muted-foreground">Due {item.dueAt ? `${timeLabel(item.dueAt)} ET` : "time unavailable"} · {item.status.replaceAll("_", " ")} · thread {item.threadId}</p></div>
              {listing && <Button variant="outline" size="sm" onClick={() => openVehicle(item.vehicleId)}>Open listing</Button>}
            </li>;
          })}</ul>}
          {(offerReviews.status === "CanLoadMore" || offerReviews.status === "LoadingMore") && <Button className="mt-4" variant="outline" disabled={offerReviews.status === "LoadingMore"} onClick={() => offerReviews.loadMore(15)}>{offerReviews.status === "LoadingMore" ? "Loading…" : "Load more"}</Button>}
        </section>
        <section aria-labelledby="trend-heading" className="rounded-2xl border border-black/10 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="market-eyebrow">Listing trend</p><h2 id="trend-heading" className="mt-2 text-xl font-semibold">New listings over time</h2><p className="mt-1 text-xs text-muted-foreground">Listings created each month, including drafts and archived vehicles.</p></div>
            <div className="rounded-xl bg-primary/5 px-4 py-3 text-right"><p className="text-xs text-muted-foreground">This month</p><p className="mt-1 text-2xl font-semibold text-primary">{vehicles ? thisMonth.toLocaleString() : "—"}</p></div>
          </div>
          <div className="mt-7 overflow-x-auto">
            <div className="flex h-48 min-w-[620px] items-end gap-2 border-b border-black/10 pb-6" role="img" aria-label={vehicles ? `New listings over the last 12 months: ${months.map((month) => `${month.label} ${month.year}, ${month.count}`).join("; ")}` : "Loading listing trend"}>
              {months.map((month) => <div key={month.key} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-[10px] font-semibold text-[hsl(var(--gunmetal))]">{vehicles ? month.count : "—"}</span>
                <div className="w-full max-w-12 rounded-t-md bg-primary/75 transition-colors group-hover:bg-primary" style={{ height: `${vehicles ? Math.max(3, month.count / chartMax * 100) : 3}%` }} />
                <span className="absolute -bottom-5 text-[10px] text-muted-foreground">{month.label}</span>
              </div>)}
            </div>
          </div>
        </section>

        <section aria-labelledby="table-heading" className="overflow-hidden rounded-2xl border border-black/10 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-7">
            <div><p className="market-eyebrow">Inventory</p><h2 id="table-heading" className="mt-2 text-xl font-semibold">Vehicles</h2><p className="mt-1 text-xs text-muted-foreground">{vehicles ? `${filtered.length.toLocaleString()} of ${vehicles.length.toLocaleString()} listings${needsLocationOnly ? " · location gaps only" : ""}` : "Loading listings…"}</p></div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {needsLocationOnly && <Button variant="outline" size="sm" onClick={() => { setNeedsLocationOnly(false); setPage(1); }}>Show all locations</Button>}
              <label className="relative min-w-48 flex-1 sm:flex-none"><span className="sr-only">Search vehicles</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input className="h-9 w-full rounded-lg border border-black/15 bg-white pl-9 pr-3 text-sm outline-none focus:border-primary" placeholder="Search vehicles or sellers" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
              <label><span className="sr-only">Filter by status</span><select className="h-9 rounded-lg border border-black/15 bg-white px-3 text-sm outline-none focus:border-primary" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as ListingStatus); setPage(1); }}>{filters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-y border-black/10 bg-[hsl(var(--bone))] text-xs uppercase tracking-wide text-muted-foreground"><tr><th scope="col" className="px-5 py-3 font-semibold sm:pl-7">Vehicle</th><th scope="col" className="px-4 py-3 font-semibold">Seller</th><th scope="col" className="px-4 py-3 font-semibold">Price</th><th scope="col" className="px-4 py-3 font-semibold">Status</th><th scope="col" className="px-4 py-3 font-semibold">Submitted</th><th scope="col" className="px-4 py-3 font-semibold">Views</th></tr></thead>
              <tbody>
                {visible.map((vehicle) => {
                  const photo = vehicle.thumbnailPhotos?.[0] ?? vehicle.photos[0] ?? "";
                  return <tr key={vehicle._id} className="border-b border-black/5 last:border-0 hover:bg-primary/[0.03]">
                    <td className="px-5 py-3 sm:pl-7"><button type="button" onClick={() => openVehicle(vehicle._id)} className="flex items-center gap-3 text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/5">{isTrustedImageUrl(photo) ? <Image src={photo} alt="" width={96} height={72} className="h-full w-full object-cover" /> : <CarFront className="h-5 w-5 text-muted-foreground" />}</span><span><span className="block max-w-56 truncate font-semibold">{vehicle.title}</span><span className="text-xs text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</span>{needsLocationRemediation(vehicle) && <span className="block text-xs font-medium text-amber-800">ZIP mapping needed</span>}</span></button></td>
                    <td className="px-4 py-3">{vehicle.user?.name ?? "Unknown seller"}</td>
                    <td className="px-4 py-3 font-medium">{money(vehicle.price)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle(vehicle.status)}`}>{vehicle.status === "approved" ? "Active" : vehicle.status}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{vehicle.status === "pending" && pendingSince(vehicle) ? <><span className="block">{timeLabel(pendingSince(vehicle)!)} ET</span><span className="text-xs">Pending since</span></> : <><span className="block">{dateLabel(vehicle.createdAt)}</span><span className="text-xs">{vehicle.status === "pending" ? "Created; submission time unavailable" : "Created"}</span></>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{(vehicle.viewCount ?? 0).toLocaleString()}</td>
                  </tr>;
                })}
                {vehicles && visible.length === 0 && <tr><td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">{vehicles.length ? "No listings match your search or filter." : "No vehicle listings have been created yet."}</td></tr>}
                {!vehicles && <tr><td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">Loading vehicles…</td></tr>}
              </tbody>
            </table>
          </div>
          {filtered.length > PAGE_SIZE && <div className="flex items-center justify-between gap-3 border-t border-black/10 px-5 py-4 text-xs text-muted-foreground sm:px-7"><span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button><span>Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button></div></div>}
        </section>
      </div>

      <dialog ref={dialogRef} onClose={() => setSelectedId(null)} aria-labelledby="vehicle-detail-heading" className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-xl overflow-y-auto border-0 bg-white p-0 text-foreground shadow-2xl backdrop:bg-black/60">
        {selected && <div>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white px-5 py-4 sm:px-7"><p className="market-eyebrow">Vehicle review</p><button type="button" onClick={() => setSelectedId(null)} aria-label="Close vehicle details" className="rounded-full p-2 hover:bg-black/5"><X className="h-5 w-5" /></button></div>
          <div className="p-5 sm:p-7">
            {(() => { const photo = selected.thumbnailPhotos?.[0] ?? selected.photos[0] ?? ""; return isTrustedImageUrl(photo) ? <Image src={photo} alt={selected.title} width={800} height={480} className="h-52 w-full rounded-xl object-cover" /> : <div className="flex h-40 items-center justify-center rounded-xl bg-black/5"><CarFront className="h-10 w-10 text-muted-foreground" /></div>; })()}
            {selected.thumbnailPhotos && selected.thumbnailPhotos.length > 1 && <div className="mt-2 flex gap-2 overflow-x-auto">{selected.thumbnailPhotos.slice(1).filter(isTrustedImageUrl).map((photo, index) => <Image key={photo} src={photo} alt={`${selected.title} photo ${index + 2}`} width={120} height={90} className="h-20 w-28 shrink-0 rounded-lg object-cover" />)}</div>}
            <div className="mt-5 flex items-start justify-between gap-3"><div><h2 id="vehicle-detail-heading" className="text-2xl font-semibold">{selected.title}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.year} {selected.make} {selected.model}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(selected.status)}`}>{selected.status === "approved" ? "Active" : selected.status}</span></div>
            <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-[hsl(var(--bone))] p-4 text-sm"><div><p className="text-xs text-muted-foreground">Asking price</p><p className="mt-1 font-semibold">{money(selected.price)}</p></div><div><p className="text-xs text-muted-foreground">Mileage</p><p className="mt-1 font-semibold">{selected.mileage.toLocaleString()} {selected.mileageUnit ?? "mi"}</p></div><div><p className="text-xs text-muted-foreground">Created</p><p className="mt-1 font-semibold">{dateLabel(selected.createdAt)}</p></div><div><p className="text-xs text-muted-foreground">Views</p><p className="mt-1 font-semibold">{(selected.viewCount ?? 0).toLocaleString()}</p></div>{selected.status === "pending" && <div className="col-span-2"><p className="text-xs text-muted-foreground">Latest submission</p><p className="mt-1 font-semibold">{pendingSince(selected) ? `${timeLabel(pendingSince(selected)!)} ET` : "Unavailable in moderation history; check the event log"}</p></div>}{selected.vin && <div className="col-span-2"><p className="text-xs text-muted-foreground">VIN</p><p className="mt-1 break-all font-mono text-xs">{selected.vin}</p></div>}</div>
            <section className="mt-7 rounded-xl border border-black/10 p-4 text-sm" aria-labelledby="availability-heading">
              <h3 id="availability-heading" className="font-semibold">Availability</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div><dt className="text-xs text-muted-foreground">Next confirmation due</dt><dd>{selected.availabilityDueAt ? new Date(selected.availabilityDueAt).toLocaleString() : "No active clock"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Last confirmed</dt><dd>{selected.availabilityConfirmedAt ? new Date(selected.availabilityConfirmedAt).toLocaleString() : "Not yet confirmed"}</dd></div>
                {selected.availabilityExpiredAt && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Expired</dt><dd>{new Date(selected.availabilityExpiredAt).toLocaleString()}</dd></div>}
              </dl>
              {selected.status === "reserved" && <p className="mt-3 text-xs text-muted-foreground">The availability clock is paused while this vehicle is reserved.</p>}
              <details className="mt-3"><summary className="cursor-pointer font-medium">Availability history ({selected.availabilityHistory?.length ?? 0})</summary><ol className="mt-2 space-y-2 border-l border-black/10 pl-4">{selected.availabilityHistory?.map((entry, index) => <li key={index}><span className="capitalize">{entry.kind.replaceAll("_", " ")}</span><span className="ml-2 text-xs text-muted-foreground">{new Date(entry.at).toLocaleString()}</span></li>)}</ol></details>
            </section>
            <section className="mt-7 rounded-xl border border-black/10 p-4 text-sm" aria-labelledby="category-heading">
              <h3 id="category-heading" className="font-semibold">Vehicle category</h3>
              <p className="mt-2 capitalize">{selected.vehicleCategory ?? "Unknown (legacy listing)"}</p>
              {selected.vehicleCategory === "specialty" && <p className="mt-2 text-xs leading-5 text-muted-foreground">Before approval, manually verify road registration and lawful transfer eligibility. Review unusual serial numbers, modified or kit construction, and title evidence; the seller’s category choice is only a claim.</p>}
              {!selected.vehicleCategory && <p className="mt-2 text-xs leading-5 text-muted-foreground">Set and verify a category before approving a re-reviewed legacy listing.</p>}
            </section>
            <section className="mt-7 rounded-xl border border-black/10 bg-[hsl(var(--bone))] p-4 text-sm" aria-labelledby="enhanced-review-heading">
              <h3 id="enhanced-review-heading" className="font-semibold">Ownership and enhanced review</h3>
              {!enhancedReview ? <p className="mt-2 text-muted-foreground">Loading review state…</p> : <>
                <p className="mt-2">Seller declaration: <span className="font-medium capitalize">{enhancedReview.ownershipRole ?? "Not yet declared"}</span></p>
                <p className="mt-1">Lien status: <span className="font-medium capitalize">{selected.lienStatus ?? "Not disclosed (legacy)"}</span></p>
                {selected.lienStatus === "outstanding" && <div className="mt-2 rounded-lg border border-black/10 bg-white p-3"><p className="text-xs font-semibold">Private seller-stated payoff/transfer plan</p><p className="mt-1 whitespace-pre-wrap break-words">{selected.lienPayoffPlan || "Missing; request correction before approval."}</p></div>}
                <p className="mt-1">Review triggers: <span className="font-medium">{enhancedReview.triggers.length ? enhancedReview.triggers.join(", ").replaceAll("_", " ") : "None recorded"}</span></p>
                <p className="mt-1">Current revision: <span className="font-mono">{enhancedReview.revision}</span> · {enhancedReview.cleared ? "enhanced review cleared" : enhancedReview.triggers.length ? "enhanced review required" : "ordinary review"}</p>
                {enhancedReview.request && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">Seller request: {enhancedReview.request}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{enhancedReview.requiresDocument ? "Verified, unexpired private evidence is required before clearance." : "Evidence may be requested when the case warrants it."} Review documents privately in the safety workspace.</p>
                {enhancedReview.documents.length > 0 && <label className="mt-3 block text-xs font-semibold">Private evidence reviewed in safety workspace<select value={evidenceDocumentId} onChange={event => setEvidenceDocumentId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm font-normal"><option value="">No document selected</option>{enhancedReview.documents.map(document => <option key={document.id} value={document.id}>{document.status} document · expires {dateLabel(document.expiresAt)}</option>)}</select></label>}
                <label className="mt-3 block text-xs font-semibold">Evidence request trigger<select value={evidenceTrigger} onChange={event => setEvidenceTrigger(event.target.value as EvidenceTrigger)} className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm font-normal"><option value="ambiguous_ownership">Ambiguous ownership</option><option value="vin_identity">VIN or identity mismatch</option><option value="fraud_report">Fraud report</option><option value="repeat_activity">Repeat listing activity</option><option value="title">Title concern</option><option value="lien">Lien or payoff concern</option></select></label>
                <label className="mt-3 block text-xs font-semibold">Factual review reason or seller instructions<textarea value={evidenceReason} onChange={event => setEvidenceReason(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-black/15 bg-white p-3 text-sm font-normal" placeholder="Describe the requested evidence or recorded resolution without copying private document contents" /></label>
                <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={busy || !evidenceReason.trim()} onClick={() => saveEvidenceReview("request")}>Request evidence and hold</Button><Button variant="outline" disabled={busy || !evidenceReason.trim() || selected.status !== "pending" || selected.lienStatus === "uncertain" || !enhancedReview.triggers.length || enhancedReview.cleared || (enhancedReview.requiresDocument && !evidenceDocumentId)} onClick={() => saveEvidenceReview("clear")}>Clear enhanced review</Button></div>
                <p className="mt-2 text-xs text-muted-foreground">Clearance is tied to this pending listing revision. A later edit requires review again. Approval is a separate action below.</p>
                <Link href="/admin/safety" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">Open private evidence review</Link>
                {evidenceFeedback && <p role="status" className="mt-2 text-xs">{evidenceFeedback}</p>}
              </>}
            </section>
            <section className="mt-7"><h3 className="text-sm font-semibold">Seller</h3><p className="mt-2 text-sm">{selected.user?.name ?? "Unknown seller"}{selected.user?.email ? ` · ${selected.user.email}` : ""}</p><p className="mt-1 break-words text-xs text-muted-foreground">Listing contact: {selected.contactInfo}</p></section>
            <section className="mt-7 rounded-xl border border-black/10 bg-[hsl(var(--bone))] p-4" aria-labelledby="repeat-review-heading">
              <h3 id="repeat-review-heading" className="text-sm font-semibold">Repeat-listing review</h3>
              {!risk ? <p className="mt-2 text-sm">Loading review indicators…</p> : <>
                <p className="mt-2 text-sm font-semibold">{risk.flagged ? "Pattern warrants manual review" : "No repeat pattern flagged in sampled records"}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{risk.currentCount} current pending/active/reserved listings; {risk.recentCount} created or submitted in the last 90 days; {risk.openReports} open, reviewing, or escalated reports{risk.truncated ? " (sample limits reached; counts are minimums)" : ""}.</p>
                {risk.repeatedVin && <p className="mt-1 text-xs">A VIN appears more than once among current listings.</p>}
                {risk.sharedLocationCount >= 3 && <p className="mt-1 text-xs">{risk.sharedLocationCount} current listings share a city and state; this alone is not a violation.</p>}
                <p className="mt-2 text-xs leading-5 text-muted-foreground">These are investigation cues, not a dealer determination. Households, collectors, and authorized sellers may have several vehicles. Ownership duration is not available.</p>
              </>}
              <label className="mt-4 block text-xs font-semibold">Next step<select value={reviewStep} onChange={event => setReviewStep(event.target.value as typeof reviewStep)} className="mt-1 block h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm font-normal"><option value="request_evidence">Request ownership or authority evidence</option><option value="escalate">Escalate for review</option><option value="reviewed">Review completed</option></select></label>
              <label className="mt-3 block text-xs font-semibold">Factual reason and next owner<textarea value={reviewReason} onChange={event => setReviewReason(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-black/15 bg-white p-3 text-sm font-normal" placeholder="Do not include VINs, addresses, or document contents" /></label>
              <Button className="mt-3" variant="outline" disabled={busy || !reviewReason.trim()} onClick={saveReview}>Record review step</Button>
              <p className="mt-2 text-xs text-muted-foreground">Recording a request does not contact the seller. Use the private evidence workflow and coordinate the request with support. Approve or reject below after review.</p>
              <Link href="/admin/safety" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">Open safety and private evidence review</Link>
              {reviewFeedback && <p role="status" className="mt-2 text-xs">{reviewFeedback}</p>}
            </section>
            <section className="mt-7"><h3 className="text-sm font-semibold">Description</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--gunmetal))]">{selected.description || "No description provided."}</p></section>
            <section className="mt-7"><h3 className="text-sm font-semibold">Seller disclosures</h3><p className="mt-1 text-xs text-muted-foreground">Compare these statements with the photos, available history, reports, and seller statements. Reject with a reason and request correction when evidence conflicts.</p><dl className="mt-3 space-y-3 text-sm">{[["Mechanical issues", selected.mechanicalIssues], ["Accidents", selected.accidentDisclosure], ["Damage", selected.damageDisclosure]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{displayDisclosure(value)}</dd></div>)}</dl></section>
            {selected.moderationReason && <section className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-semibold">Current moderation reason</h3><p className="mt-2 text-sm">{selected.moderationReason}</p></section>}
            <details className="mt-7 text-sm"><summary className="cursor-pointer font-semibold">Moderation history ({selected.moderationHistory?.length ?? 0})</summary><ol className="mt-3 space-y-3 border-l border-black/10 pl-4">{selected.moderationHistory?.map((entry, index) => <li key={index}><span className="font-medium capitalize">{entry.fromStatus ?? "new"} → {entry.toStatus}</span><span className="ml-2 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span><p className="mt-1 text-muted-foreground">{entry.reason}</p></li>)}</ol></details>
            <div className="mt-7 border-t border-black/10 pt-6"><h3 className="text-sm font-semibold">Admin actions</h3><p className="mt-1 text-xs text-muted-foreground">Status changes are recorded in the moderation history.</p>
              {actionError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{actionError}</p>}
              <label className="mt-5 block text-xs font-semibold">Reason for action<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} rows={3} className="mt-2 w-full rounded-lg border border-black/15 p-3 text-sm font-normal outline-none focus:border-primary" placeholder="Required for rejection and restoration" /></label>
              {!selected.moderationRemovedAt && <>
                <div className="mt-4 flex flex-wrap gap-2">{selected.status === "pending" && <Button disabled={busy} onClick={() => performAction("approve")}>Approve listing</Button>}{["pending", "active", "approved", "reserved"].includes(selected.status) && <Button variant="outline" disabled={busy} onClick={() => performAction("reject")} className="border-rose-300 text-rose-700 hover:bg-rose-50">Reject listing</Button>}</div>
                {(transitions[selected.status]?.length ?? 0) > 0 && <div className="mt-5 flex flex-wrap items-end gap-2"><label className="min-w-44 flex-1 text-xs font-semibold">Change status<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ChangeableStatus | "")} className="mt-2 block h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm font-normal"><option value="">Select status</option>{transitions[selected.status].map((status) => <option key={status} value={status} className="capitalize">{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label><Button variant="outline" disabled={busy || !nextStatus} onClick={() => performAction("change")}>Apply status</Button></div>}
              </>}
              {!selected.moderationRemovedAt && <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50/50 p-4"><h4 className="text-sm font-semibold">Trust & safety takedown</h4><p className="mt-1 text-xs text-muted-foreground">Remove this listing from the marketplace and record a safety reason.</p><div className="mt-3 flex flex-wrap items-end gap-2"><label className="min-w-44 flex-1 text-xs font-semibold">Safety reason<select value={safetyReason} onChange={(event) => setSafetyReason(event.target.value as SafetyReason)} className="mt-2 block h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm font-normal">{safetyReasons.map((code) => <option key={code} value={code}>{reasonLabel(code)}</option>)}</select></label><Button variant="outline" disabled={busy} onClick={() => performAction("takedown")} className="border-rose-300 text-rose-700 hover:bg-rose-50">Take down listing</Button></div></div>}
              {selected.moderationRemovedAt && <div className="mt-4"><p className="text-sm text-muted-foreground">This listing was removed by moderation. Enter a reason above to return it to the review queue.</p><Button className="mt-3" variant="outline" disabled={busy} onClick={() => performAction("restore")}>Return for review</Button></div>}
              {["active", "approved"].includes(selected.status) && <Link href={`/vehicles/${selected._id}`} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View public listing <ArrowUpRight className="h-4 w-4" /></Link>}
            </div>
          </div>
        </div>}
      </dialog>
    </main>
  );
}
