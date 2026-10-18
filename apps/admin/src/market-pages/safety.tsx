"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { safetyReasons, reasonLabel, type SafetyReason } from "@/components/ui/safety-controls";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

export default function AdminSafetyPage() {
  const { isAuthenticated } = useConvexAuth();
  const isAdmin = useQuery(api.users.isAdmin, isAuthenticated ? {} : "skip");
  const queue = useQuery(api.trust.adminQueue, isAdmin ? {} : "skip");
  const audit = useQuery(api.trust.auditLog, isAdmin ? {} : "skip");
  const [feedback, setFeedback] = useState("");
  return <main className="mx-auto max-w-7xl px-4 py-10 space-y-6">
    <h1 className="text-3xl font-bold">Trust & safety moderation</h1>
    <p className="text-muted-foreground">Review concerns, record reasons and notes, and respond to appeals. Activity indicators support investigation; they are not proof of abuse.</p>
    {feedback && <p role="status" className="rounded-md border bg-white p-4 break-words">{feedback}</p>}
    {isAdmin === false ? <p>Administrator access required. <Link href="/myAccount" className="underline">Back to account</Link></p> : !queue ? <p role="status">Loading moderation queue…</p> : <>
      <Card><CardHeader><CardTitle>Reports</CardTitle></CardHeader><CardContent className="space-y-4">
        {queue.reports.length === 0 && <p>No reports.</p>}
        {queue.reports.map((report) => <ReportCase key={report._id} report={report} onFeedback={setFeedback} />)}
      </CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Appeals & support</CardTitle></CardHeader><CardContent className="space-y-4">{queue.appeals.length === 0 && <p>No requests.</p>}{queue.appeals.map((appeal) => <AppealCase key={appeal._id} appeal={appeal} onFeedback={setFeedback} />)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Private ownership evidence</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Review only for the stated ownership purpose. Do not copy sensitive document contents into notes.</p>{queue.documents.length === 0 && <p>No documents.</p>}{queue.documents.map((document) => <EvidenceCase key={document._id} document={document} onFeedback={setFeedback} />)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Optional identity reviews</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Verify only after a manual review with the seller. A request alone is not evidence.</p>{queue.identities.length === 0 && <p>No identity reviews.</p>}{queue.identities.map((review) => <IdentityCase key={review._id} review={review} onFeedback={setFeedback} />)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Abuse escalation</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>For immediate danger, advise the reporter to contact emergency services. Escalate threats, suspected stolen vehicles, fraud rings, or disclosure of private documents to the designated safety lead.</p><p>Record factual evidence, the reason code and the next owner in a case note. Apply suspension or takedown when warranted. Keep the appeal open for independent review.</p><p>Never send private documents through public links or put full VINs, phone numbers or precise addresses into notes. Follow the operating procedure in docs/TRUST_SAFETY.md.</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Immutable admin audit log</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Latest 200 entries. Entries cannot be edited or deleted through the application.</p>{audit?.map((entry) => <div key={entry._id} className="rounded-md border p-3 text-sm break-words"><p className="font-medium">{reasonLabel(entry.action)} · {new Date(entry.createdAt).toLocaleString()}</p><p>Reason: {entry.reason}</p>{"actorId" in entry && entry.actorId && <p>Actor: {entry.actorId}</p>}{entry.targetUserId && <p>User: {entry.targetUserId}</p>}{"vehicleId" in entry && entry.vehicleId && <p>Listing: {entry.vehicleId}</p>}</div>)}</CardContent></Card>
    </>}
  </main>;
}

function useModerationFeedback(onFeedback: (text: string) => void) {
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try { await action(); onFeedback("Moderation action saved."); }
    catch (error) { onFeedback(error instanceof Error ? error.message : "Unable to save moderation action."); }
    finally { setBusy(false); }
  }
  return { busy, run };
}

function ReportCase({ report, onFeedback }: { report: Doc<"trustReports"> & { indicators: string[] }; onFeedback: (text: string) => void }) {
  const moderate = useMutation(api.trust.moderateReport);
  const suspend = useMutation(api.trust.setSuspension);
  const takedown = useMutation(api.trust.takedownListing);
  const restore = useMutation(api.trust.restoreListing);
  const [reason, setReason] = useState<SafetyReason>(report.reason as SafetyReason);
  const [status, setStatus] = useState<"reviewing" | "resolved" | "dismissed" | "escalated">("reviewing");
  const [note, setNote] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const notes = useQuery(api.trust.caseNotes, showNotes ? { reportId: report._id } : "skip");
  const { busy, run } = useModerationFeedback(onFeedback);
  return <div className="space-y-3 rounded-md border p-4">
    <p className="font-semibold">{reasonLabel(report.reason)} · {report.status}</p><p className="text-xs break-words">Case {report._id} · User {report.targetUserId}</p>
    {report.vehicleId && <Link href={`/vehicles/${report.vehicleId}`} className="text-sm underline">View listing</Link>}
    <p className="text-sm whitespace-pre-wrap break-words">{report.details}</p>
    {report.indicators.length > 0 && <p className="text-sm rounded-md bg-amber-50 p-3">Activity indicators: {report.indicators.map(reasonLabel).join(", ")}</p>}
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void run(async () => { await moderate({ reportId: report._id, status, reason, note }); setNote(""); }); }}>
      <div className="flex flex-wrap gap-3"><label className="text-sm">Reason code<select className="block rounded-md border p-2 mt-1" value={reason} onChange={(event) => setReason(event.target.value as SafetyReason)}>{safetyReasons.map((code) => <option key={code} value={code}>{reasonLabel(code)}</option>)}</select></label><label className="text-sm">Case status<select className="block rounded-md border p-2 mt-1" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{["reviewing", "resolved", "dismissed", "escalated"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
      <label className="block text-sm">Private moderation note<Textarea required maxLength={2000} className="mt-1" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <Button size="sm" disabled={busy || !note.trim()}>Save case decision</Button>
    </form>
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => suspend({ targetUserId: report.targetUserId, suspended: true, reason }))}>Suspend user & remove listings</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => suspend({ targetUserId: report.targetUserId, suspended: false, reason }))}>Restore account access</Button>{report.vehicleId && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => takedown({ vehicleId: report.vehicleId!, reason }))}>Take down listing</Button>}{report.vehicleId && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => restore({ vehicleId: report.vehicleId!, reason }))}>Return listing for review</Button>}<Button size="sm" variant="outline" onClick={() => setShowNotes(!showNotes)}>{showNotes ? "Hide" : "Show"} notes</Button></div>
    {showNotes && <div className="space-y-2">{notes?.length === 0 && <p className="text-sm">No notes.</p>}{notes?.map((entry) => <p key={entry._id} className="text-sm whitespace-pre-wrap break-words">{new Date(entry.createdAt).toLocaleString()} · {reasonLabel(entry.reason)}: {entry.note}</p>)}</div>}
  </div>;
}

function AppealCase({ appeal, onFeedback }: { appeal: Doc<"trustAppeals">; onFeedback: (text: string) => void }) {
  const resolve = useMutation(api.trust.resolveAppeal);
  const reinstate = useMutation(api.trust.setSuspension);
  const restore = useMutation(api.trust.restoreListing);
  const [response, setResponse] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [reason, setReason] = useState<SafetyReason>("other");
  const { busy, run } = useModerationFeedback(onFeedback);
  return <div className="rounded-md border p-4 space-y-3"><p className="text-sm">{appeal.status} · User {appeal.userId}</p><p className="text-sm whitespace-pre-wrap break-words">{appeal.message}</p>{appeal.response && <p className="text-sm whitespace-pre-wrap break-words">Response: {appeal.response}</p>}{appeal.status !== "resolved" && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void run(() => resolve({ appealId: appeal._id, response })); }}><label className="block text-sm">Response to user<Textarea className="mt-1" value={response} maxLength={2000} required onChange={(event) => setResponse(event.target.value)} /></label><Button size="sm" disabled={busy || !response.trim()}>Respond & resolve</Button></form>}<div className="border-t pt-3 space-y-3"><label className="block text-sm">Reason for reinstatement<select className="mt-1 block rounded-md border p-2" value={reason} onChange={(event) => setReason(event.target.value as SafetyReason)}>{safetyReasons.map((code) => <option key={code} value={code}>{reasonLabel(code)}</option>)}</select></label><Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => reinstate({ targetUserId: appeal.userId, suspended: false, reason }))}>Restore account access</Button><label className="block text-sm">Listing reference to return for review<input className="mt-1 block w-full rounded-md border p-2" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} /></label><Button size="sm" variant="outline" disabled={busy || !vehicleId.trim()} onClick={() => run(() => restore({ vehicleId: vehicleId.trim() as Id<"vehicles">, reason }))}>Return listing for review</Button><p className="text-xs text-muted-foreground">Restoring account access does not republish removed listings. Return eligible listings for moderation review separately.</p></div></div>;
}

function EvidenceCase({ document, onFeedback }: { document: Omit<Doc<"ownershipDocuments">, "storageId">; onFeedback: (text: string) => void }) {
  const review = useMutation(api.trust.reviewDocument);
  const { getToken } = useAuth();
  const [reason, setReason] = useState("");
  const { busy, run } = useModerationFeedback(onFeedback);
  async function openDocument() {
    const token = await getToken({ template: "convex" });
    if (!token) throw new Error("Please sign in again to review documents.");
    const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!siteUrl) throw new Error("Private document service is not configured.");
    const response = await fetch(`${siteUrl}/trust/document?id=${encodeURIComponent(document._id)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Document unavailable or expired.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = "ownership-evidence"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="rounded-md border p-4 space-y-3"><p className="text-sm break-words">{document.status} · User {document.userId}</p><p className="text-sm">Expires {new Date(document.expiresAt).toLocaleString()}</p><Button size="sm" variant="outline" disabled={busy || document.expiresAt <= Date.now()} onClick={() => run(openDocument)}>Download private evidence</Button><label className="block text-sm">Review reason<Textarea className="mt-1" value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} /></label><div className="flex gap-2">{[true, false].map((verified) => <Button key={String(verified)} size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => run(() => review({ documentId: document._id, verified, reason }))}>{verified ? "Verify ownership evidence" : "Reject evidence"}</Button>)}</div></div>;
}

function IdentityCase({ review, onFeedback }: { review: Doc<"identityReviews">; onFeedback: (text: string) => void }) {
  const decide = useMutation(api.trust.reviewIdentity);
  const [reason, setReason] = useState("");
  const { busy, run } = useModerationFeedback(onFeedback);
  return <div className="rounded-md border p-4 space-y-3"><p className="text-sm break-words">{review.status} · User {review.userId}</p><label className="block text-sm">Review basis<Textarea className="mt-1" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="flex gap-2">{[true, false].map((verified) => <Button key={String(verified)} size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => run(() => decide({ reviewId: review._id, verified, reason }))}>{verified ? "Verify identity" : "Reject request"}</Button>)}</div></div>;
}
