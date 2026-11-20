"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrivatePhotoRequestPhoto, usePhotoRequestUpload } from "@/components/ui/photo-request-private-media";
import { SelectedWantedPhotos, validateWantedPhotoFiles } from "@/components/ui/wanted-private-media";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";

const suggestedViews = ["Front", "Rear", "Driver side", "Passenger side", "Interior", "Engine bay", "Undercarriage", "Damage or issue"];
const openStatuses = new Set(["requested", "replied", "followup"]);

function PhotoRequestEntries({ requestId, role, readOnly }: { requestId: Id<"photoRequests">; role?: "buyer" | "seller"; readOnly: boolean }) {
  const { results, status, loadMore } = usePaginatedQuery(api.photoRequests.listEntries, { requestId }, { initialNumItems: 20 });
  const selections = useQuery(api.photoRequestModeration.mySelections, role === "seller" && !readOnly ? { requestId } : "skip");
  const select = useMutation(api.photoRequestModeration.select);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function selectPhoto(photoId: Id<"photoRequestPhotos">, existingCaption?: string) {
    const caption = (captions[photoId] ?? existingCaption ?? "").trim();
    if (!caption) { setError("Add a caption before selecting a photo for the public listing."); return; }
    setBusyPhotoId(photoId); setError(""); setNotice("");
    try { await select({ photoId, caption }); setNotice("Photo submitted for independent review. It remains private until approved."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit this photo for review."); }
    finally { setBusyPhotoId(null); }
  }

  return <div className="mt-3 border-t pt-3">
    {(status === "CanLoadMore" || status === "LoadingMore") && <Button type="button" variant="outline" size="sm" disabled={status === "LoadingMore"} onClick={() => loadMore(20)}>{status === "LoadingMore" ? "Loading…" : "Load earlier updates"}</Button>}
    {status === "LoadingFirstPage" && <p role="status" className="text-sm">Loading request updates…</p>}
    <ol className="mt-2 space-y-3" aria-label="Photo request updates">{[...results].reverse().map(entry => <li key={entry._id} className="rounded-md bg-slate-50 p-3 text-sm"><p className="font-medium">{entry.senderRole === "buyer" ? "Buyer" : "Seller"} · {entry.kind === "followup" ? "Follow-up" : entry.kind === "request" ? "Request" : "Reply"}</p><p className="mt-1 whitespace-pre-wrap">{entry.content}</p>
      {(entry.photoIds ?? []).length > 0 && <ul className="mt-3 flex flex-wrap gap-3" aria-label="Private reply photos">{(entry.photoIds ?? []).map((photoId, index) => {
        const selection = selections?.find(item => item.photoId === photoId);
        return <li key={photoId} className="max-w-[180px] space-y-2"><PrivatePhotoRequestPhoto photoId={photoId} label={`Private vehicle photo ${index + 1}`} />
          {role === "seller" && !readOnly && (selections === undefined ? <p className="text-xs">Loading public review status…</p> : <div className="space-y-2"><label className="block text-xs">Caption for public listing<input className="mt-1 w-full rounded-md border p-1 text-sm" maxLength={200} value={captions[photoId] ?? selection?.caption ?? ""} onChange={event => setCaptions(current => ({ ...current, [photoId]: event.target.value }))} disabled={selection?.status === "pending" || selection?.status === "approved"} /></label>{selection && <p className="text-xs">Public review: <span className="capitalize">{selection.status}</span>{selection.reason ? ` — ${selection.reason}` : ""}</p>}{(!selection || selection.status === "rejected" || selection.status === "stale") && <Button type="button" variant="outline" size="sm" disabled={busyPhotoId === photoId} onClick={() => void selectPhoto(photoId, selection?.caption)}>{busyPhotoId === photoId ? "Submitting…" : "Select for public review"}</Button>}</div>)}
        </li>;
      })}</ul>}
      <p className="mt-1 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p></li>)}</ol>
    {notice && <p role="status" className="mt-2 text-sm text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
  </div>;
}

export function PhotoRequestPanel({ vehicleId, recipientId, conversationId, conversationLoading, readOnly }: { vehicleId: Id<"vehicles">; recipientId: Id<"users">; conversationId?: Id<"conversations">; conversationLoading: boolean; readOnly: boolean }) {
  const state = useQuery(api.photoRequests.getForConversation, conversationId ? { conversationId } : "skip");
  const eligibility = useQuery(api.photoRequests.getEligibility,
    conversationLoading || (conversationId && state === undefined) ? "skip" :
      state?.role === "seller" ? { vehicleId, buyerId: state.buyerId } : { vehicleId, expectedSellerId: recipientId });
  const { results: requests, status: historyStatus, loadMore: loadMoreHistory } = usePaginatedQuery(api.photoRequests.listHistory, conversationId && state ? { conversationId } : "skip", { initialNumItems: 10 });
  const open = useMutation(api.photoRequests.open);
  const reply = useMutation(api.photoRequests.reply);
  const followUp = useMutation(api.photoRequests.followUp);
  const decline = useMutation(api.photoRequests.decline);
  const close = useMutation(api.photoRequests.close);
  const setDisabled = useMutation(api.photoRequests.setDisabled);
  const privatePhotos = usePhotoRequestUpload();
  const [views, setViews] = useState<string[]>([]);
  const [otherView, setOtherView] = useState("");
  const [note, setNote] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyFiles, setReplyFiles] = useState<Record<string, File[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const role = state?.role;
  const canOpen = !readOnly && (!conversationId || state) && eligibility?.canOpen === true;
  const disabled = state?.disabled ?? eligibility?.disabled ?? false;

  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this photo request."); return false; }
    finally { setBusy(false); }
  }

  function toggleView(view: string) {
    setViews(current => current.includes(view) ? current.filter(item => item !== view) : [...current, view]);
  }

  async function createRequest(event: React.FormEvent) {
    event.preventDefault();
    const selected = [...views, otherView.trim()].filter(Boolean);
    if (!selected.length) { setError("Choose at least one view to request."); return; }
    if (await perform(() => open({ vehicleId, views: selected, ...(note.trim() ? { note: note.trim() } : {}) }), "Your private photo request was sent to the seller.")) {
      setViews([]); setOtherView(""); setNote("");
    }
  }

  async function sendEntry(requestId: Id<"photoRequests">, kind: "reply" | "followup") {
    const content = drafts[requestId]?.trim() ?? "";
    if (!content) { setError("Write a message before sending."); return; }
    if (kind === "followup") {
      if (await perform(() => followUp({ requestId, content }), "Follow-up sent privately.")) setDrafts(current => ({ ...current, [requestId]: "" }));
      return;
    }
    setBusy(true); setError(""); setNotice("");
    let photoIds: Id<"photoRequestPhotos">[] = [];
    try {
      photoIds = await privatePhotos.upload(replyFiles[requestId] ?? [], requestId);
      await reply({ requestId, content, photoIds });
      setDrafts(current => ({ ...current, [requestId]: "" }));
      setReplyFiles(current => ({ ...current, [requestId]: [] }));
      setNotice("Reply sent privately.");
    } catch (cause) {
      if (photoIds.length) await privatePhotos.discard(photoIds);
      setError(cause instanceof Error ? cause.message : "Could not send this reply.");
    } finally { setBusy(false); }
  }

  async function toggleDisabled() {
    if (role !== "seller" || !state) return;
    await perform(() => setDisabled({ vehicleId, buyerId: state.buyerId, disabled: !disabled }), disabled ? "Future photo requests from this buyer are enabled." : "Future photo requests from this buyer are disabled. Ordinary messaging remains available.");
  }

  return <Card className="mt-6">
    <CardHeader><CardTitle className="text-lg">Private photo requests</CardTitle><p className="text-sm text-muted-foreground">Requests and replies here are visible only to this conversation&apos;s participants.</p></CardHeader>
    <CardContent className="space-y-5">
      {state === undefined && conversationId ? <p role="status">Loading photo requests…</p> : null}
      {(conversationLoading || eligibility === undefined) ? <p role="status">Checking photo-request availability…</p> : null}
      {notice && <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {readOnly && <p role="status" className="rounded-md border bg-slate-50 p-3 text-sm">This participant deleted their account. The existing request history and private photos remain readable, but the conversation is read only.</p>}
      {role === "seller" && state && !readOnly && <div className="rounded-md border bg-slate-50 p-3 text-sm"><p>{disabled ? "You have disabled future photo requests from this buyer for this listing." : "You can disable future photo requests from this buyer for this listing."} Ordinary messages remain available.</p><Button type="button" variant="outline" size="sm" className="mt-2" disabled={busy} onClick={toggleDisabled}>{disabled ? "Enable future photo requests" : "Disable future photo requests"}</Button></div>}
      {requests.length === 0 && historyStatus !== "LoadingFirstPage" && <p className="text-sm text-muted-foreground">No private photo requests in this conversation yet.</p>}
      {historyStatus === "LoadingFirstPage" && conversationId && <p role="status">Loading request history…</p>}
      {requests.map(request => <section key={request._id} className="rounded-lg border p-4" aria-label={`Photo request ${new Date(request.createdAt).toLocaleDateString()}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Requested views: {request.views.join(", ")}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{request.status === "followup" ? "Follow-up sent" : request.status}</span></div>
        {request.note && <p className="mt-2 whitespace-pre-wrap text-sm">{request.note}</p>}
        <PhotoRequestEntries requestId={request._id} role={role} readOnly={readOnly} />
        {role === "seller" && !readOnly && (request.status === "requested" || request.status === "followup") && <div className="mt-4 space-y-2"><label className="block text-sm font-medium">Reply privately<textarea className="mt-1 w-full rounded-md border p-2" rows={3} maxLength={2000} value={drafts[request._id] ?? ""} onChange={event => setDrafts(current => ({ ...current, [request._id]: event.target.value }))} /></label><label className="block text-sm">Private reply photos (optional, up to 10)<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="mt-1 block w-full text-sm" onChange={event => { const files = Array.from(event.target.files ?? []); try { validateWantedPhotoFiles(files); setReplyFiles(current => ({ ...current, [request._id]: files })); setError(""); } catch (cause) { setReplyFiles(current => ({ ...current, [request._id]: [] })); setError(cause instanceof Error ? cause.message : "Invalid photos."); } }} /></label><SelectedWantedPhotos files={replyFiles[request._id] ?? []} /><div className="flex flex-wrap gap-2"><Button type="button" disabled={busy || !drafts[request._id]?.trim()} onClick={() => void sendEntry(request._id, "reply")}>Send reply</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void perform(() => decline({ requestId: request._id }), "Request declined and closed. Future requests remain available unless you disable them separately.")}>Decline this request</Button></div></div>}
        {role === "buyer" && !readOnly && request.status === "replied" && (state?.canFollowUp && state.openRequestId === request._id ? <div className="mt-4 space-y-2"><label className="block text-sm font-medium">Follow up with the seller<textarea className="mt-1 w-full rounded-md border p-2" rows={3} maxLength={2000} value={drafts[request._id] ?? ""} onChange={event => setDrafts(current => ({ ...current, [request._id]: event.target.value }))} /></label><Button type="button" disabled={busy || !drafts[request._id]?.trim()} onClick={() => void sendEntry(request._id, "followup")}>Send follow-up</Button></div> : <p className="mt-3 text-sm text-muted-foreground">Follow-up is unavailable while this listing or conversation cannot accept it.</p>)}
        {!readOnly && openStatuses.has(request.status) && <Button type="button" variant="ghost" size="sm" className="mt-3" disabled={busy} onClick={() => void perform(() => close({ requestId: request._id }), "Photo request closed.")}>Close request</Button>}
      </section>)}
      {(historyStatus === "CanLoadMore" || historyStatus === "LoadingMore") && <Button type="button" variant="outline" disabled={historyStatus === "LoadingMore"} onClick={() => loadMoreHistory(10)}>{historyStatus === "LoadingMore" ? "Loading…" : "Load older requests"}</Button>}
      {role !== "seller" && canOpen && <form onSubmit={createRequest} className="space-y-3 rounded-lg border bg-slate-50 p-4"><h3 className="font-semibold">Ask for more photos</h3><fieldset><legend className="text-sm font-medium">Which views would help? Choose one or more.</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{suggestedViews.map(view => <label key={view} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={views.includes(view)} onChange={() => toggleView(view)} />{view}</label>)}</div></fieldset><label className="block text-sm">Another view (optional)<input className="mt-1 w-full rounded-md border p-2" minLength={3} maxLength={100} value={otherView} onChange={event => setOtherView(event.target.value)} placeholder="For example, rear seats" /></label><label className="block text-sm">Additional note (optional)<textarea className="mt-1 w-full rounded-md border p-2" rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} /></label><Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send private photo request"}</Button></form>}
      {role !== "seller" && !canOpen && (state || eligibility) && <p className="text-sm text-muted-foreground">{disabled ? "The seller is not accepting new photo requests from this buyer on this listing." : eligibility?.reason ?? "New photo requests are unavailable for this listing right now."}</p>}
    </CardContent>
  </Card>;
}
