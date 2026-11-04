"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { Textarea } from "@/components/ui/textarea";
import { reasonLabel } from "@/components/ui/safety-controls";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useClerk, useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

export default function SafetyPage() {
  const { user, isLoading } = useCurrentUser();
  const { openUserProfile } = useClerk();
  const { getToken } = useAuth();
  const safety = useQuery(api.trust.getMySafety, user ? {} : "skip");
  const vehicles = useQuery(api.vehicles.getVehiclesByUser, user && user.suspendedAt === undefined ? { userId: user._id } : "skip");
  const attest = useMutation(api.trust.attestOwnership);
  const requestIdentity = useMutation(api.trust.requestIdentityReview);
  const upload = useMutation(api.trust.createDocumentUpload);
  const appeal = useMutation(api.trust.submitAppeal);
  const block = useMutation(api.trust.setBlock);
  const [vehicleId, setVehicleId] = useState("");
  const [attested, setAttested] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setFeedback("");
    try { await action(); setFeedback(success); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Unable to save. Please try again."); }
    finally { setBusy(false); }
  }

  async function uploadDocument() {
    if (!file) throw new Error("Choose a document first.");
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Use a PDF, JPEG or PNG smaller than 10 MB.");
    const ticket = await upload({ ...(vehicleId ? { vehicleId: vehicleId as Id<"vehicles"> } : {}) });
    const token = await getToken({ template: "convex" });
    if (!token) throw new Error("Please sign in again before uploading.");
    const response = await fetch(ticket.uploadUrl, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type, "X-Upload-Token": ticket.token }, body: file });
    if (!response.ok) throw new Error("Document upload failed. Please try again.");
    setFile(null); setUploadKey((key) => key + 1);
  }

  return <div className="market-page min-h-screen flex flex-col"><Navbar /><main className="market-shell flex-1 py-10 space-y-6">
    <Link href="/myAccount" className="text-sm underline">Back to account</Link>
    <h1 className="text-3xl font-bold">Trust & safety</h1>
    <p className="text-muted-foreground">Manage verification, ownership evidence, blocked users, and support requests.</p>
    {isLoading ? <p role="status">Loading your account…</p> : !user ? <Button asChild><Link href="/sign-in">Sign in</Link></Button> : !safety ? <p role="status">Loading safety information…</p> : <>
      {safety.user.suspendedAt && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4">Your account is suspended. Reason: {safety.user.suspensionReason}. You can submit an appeal below.</p>}
      {feedback && <p role="status" className="rounded-md border p-4 break-words">{feedback}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Seller verification</CardTitle></CardHeader><CardContent className="space-y-4">
          <p>Email: <strong>{safety.user.emailVerified ? "Verified" : "Not verified"}</strong></p>
          <p>Phone: <strong>{safety.user.phoneVerified ? "Verified" : "Not verified"}</strong></p>
          <p className="text-sm text-muted-foreground">Add and verify your email and phone in account settings. Verification confirms access to a contact method; it does not guarantee a safe transaction.</p>
          <Button variant="outline" onClick={() => openUserProfile()}>Manage email & phone</Button>
          <div className="border-t pt-4 space-y-3"><h2 className="font-semibold">Optional identity review</h2><p className="text-sm">Status: {safety.identity?.status ?? "Not requested"}</p><p className="text-sm text-muted-foreground">Request a manual review. Support will coordinate evidence through this private workflow. Do not put identity documents in listing photos or messages.</p><Button disabled={busy || safety.identity?.status === "pending"} onClick={() => run(() => requestIdentity({}), "Identity review requested.")}>Request identity review</Button></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Ownership & private documents</CardTitle></CardHeader><CardContent className="space-y-4">
          <label className="block text-sm font-medium">Your listing<select className="mt-1 block w-full rounded-md border p-2" value={vehicleId} onChange={(event) => { setVehicleId(event.target.value); setAttested(false); }}><option value="">Choose a listing</option>{vehicles?.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.title}</option>)}</select></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={attested} onChange={(event) => setAttested(event.target.checked)} />I am the owner or am authorized by the owner to sell this vehicle, and the listing is accurate.</label>
          <Button disabled={busy || !vehicleId || !attested} onClick={() => run(() => attest({ vehicleId: vehicleId as Id<"vehicles"> }), "Ownership attestation saved.")}>Save ownership attestation</Button>
          {vehicles?.find((vehicle) => vehicle._id === vehicleId)?.ownershipAttestedAt && <p className="text-sm text-green-800">Ownership attestation is recorded for this listing.</p>}
          <div className="border-t pt-4 space-y-3"><p className="text-sm">Ownership evidence is private to you and authorized moderators. Upload only the necessary page; cover unrelated addresses, signatures and account numbers. Documents expire after 30 days.</p><label className="block text-sm font-medium">Private ownership document (PDF, JPEG or PNG, up to 10 MB)<input key={uploadKey} className="mt-2 block w-full text-sm" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><Button disabled={busy || !file} onClick={() => run(uploadDocument, "Private document uploaded for review.")}>Upload private document</Button></div>
          {safety.documents.map((document) => <p key={document._id} className="text-sm">Document review: {document.status} · expires {new Date(document.expiresAt).toLocaleDateString()}</p>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Blocked users & reports</CardTitle></CardHeader><CardContent className="space-y-4">
          {safety.blocks.length === 0 && <p className="text-sm">No blocked users.</p>}
          {safety.blocks.map((entry) => <div key={entry._id} className="flex items-center justify-between gap-3"><span>{entry.name ?? "User"}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => block({ targetUserId: entry.blockedUserId, blocked: false }), "User unblocked.")}>Unblock</Button></div>)}
          <h2 className="font-semibold border-t pt-4">Your reports</h2>
          {safety.reports.length === 0 && <p className="text-sm">No reports submitted.</p>}
          {safety.reports.map((report) => <p key={report._id} className="text-sm">{reasonLabel(report.reason)} · {report.status} · {new Date(report.createdAt).toLocaleDateString()}</p>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Appeals & support</CardTitle></CardHeader><CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Appeal a suspension or listing removal, or ask for help with an abuse concern. Include the listing or report reference and relevant facts. Do not include sensitive documents here.</p>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void run(async () => { await appeal({ message }); setMessage(""); }, "Support request received."); }}><label className="block text-sm font-medium">Message<Textarea className="mt-1" required minLength={10} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} /></label><Button disabled={busy || message.trim().length < 10}>Submit appeal or support request</Button></form>
          {safety.appeals.map((entry) => <div key={entry._id} className="rounded-md border p-3 text-sm space-y-2"><p>{entry.status} · {new Date(entry.createdAt).toLocaleDateString()}</p><p className="whitespace-pre-wrap break-words">{entry.message}</p>{entry.response && <p className="whitespace-pre-wrap break-words">Support response: {entry.response}</p>}</div>)}
        </CardContent></Card>
      </div>
    </>}
  </main><Footer /></div>;
}
