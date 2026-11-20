"use client";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { PrivateWantedPhoto, SelectedWantedPhotos, useWantedPhotoUpload, validateWantedPhotoFiles } from "@/components/ui/wanted-private-media";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { use, useEffect, useState } from "react";

const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

export default function WantedConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = use(params);
  const { user, isLoading } = useCurrentUser();
  const thread = useQuery(api.wantedConversations.getThread, user ? { conversationId: conversationId as Id<"wantedConversations"> } : "skip");
  const { results: messages, status: messageStatus, loadMore } = usePaginatedQuery(api.wantedConversations.listMessages, user ? { conversationId: conversationId as Id<"wantedConversations"> } : "skip", { initialNumItems: 30 });
  const listings = useQuery(api.vehicles.getVehiclesByUser, user && thread?.conversation.role === "seller" ? { userId: user._id } : "skip");
  const send = useMutation(api.wantedConversations.send);
  const markRead = useMutation(api.wantedConversations.markRead);
  const setBlock = useMutation(api.wantedConversations.setBlock);
  const report = useMutation(api.wantedConversations.report);
  const dismiss = useMutation(api.wantedConversations.dismiss);
  const reopen = useMutation(api.wantedConversations.reopen);
  const photos = useWantedPhotoUpload();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");

  const unreadIds = messages.filter(message => !message.read && !message.isMine).slice(0, 100).map(message => message._id);
  const unreadKey = unreadIds.join(",");
  useEffect(() => {
    if (unreadIds.length > 0 && user) void markRead({ conversationId: conversationId as Id<"wantedConversations">, messageIds: unreadIds }).catch(() => {});
    // The stable key changes only when new unread messages arrive or they are marked read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, unreadKey, user?._id, markRead]);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    let photoIds: Id<"wantedReplyPhotos">[] = [];
    try {
      if (!thread) throw new Error("Conversation unavailable");
      photoIds = await photos.upload(files, thread.conversation.requestId, conversationId as Id<"wantedConversations">);
      await send({ conversationId: conversationId as Id<"wantedConversations">, content, photoIds });
      setContent(""); setFiles([]);
    } catch (cause) { if (photoIds.length) await photos.discard(photoIds); setError(cause instanceof Error ? cause.message : "Could not send message."); }
    finally { setBusy(false); }
  }

  async function toggleBlock() {
    if (!thread) return;
    setBusy(true); setError("");
    try { await setBlock({ conversationId: conversationId as Id<"wantedConversations">, blocked: !thread.blocked }); setNotice(thread.blocked ? "Account unblocked." : "Account blocked."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update block."); }
    finally { setBusy(false); }
  }

  async function submitReport(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await report({ conversationId: conversationId as Id<"wantedConversations">, reason, details }); setReportOpen(false); setDetails(""); setNotice("Report sent to the safety team."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send report."); }
    finally { setBusy(false); }
  }

  async function changeDismissed() {
    if (!thread || thread.conversation.role !== "buyer") return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (thread.dismissed) { await reopen({ conversationId: conversationId as Id<"wantedConversations"> }); setNotice("Conversation reopened."); }
      else { await dismiss({ conversationId: conversationId as Id<"wantedConversations"> }); setNotice("You passed on this response. The seller cannot send more messages unless you reopen it."); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this conversation."); }
    finally { setBusy(false); }
  }

  function shareListing(id: string) {
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (!origin) { setError("The listing link is unavailable right now."); return; }
    setContent(previous => `${previous.trim()}${previous.trim() ? "\n" : ""}${origin}/vehicles/${id}`);
  }

  return <div className="market-page min-h-screen flex flex-col"><Navbar /><main className="market-shell flex-1 py-10 space-y-6">
    <Link className="text-sm underline" href="/myAccount/wanted-messages">Back to wanted conversations</Link>
    {isLoading ? <p role="status">Loading your account…</p> : !user ? <p><Link className="underline" href={`/sign-in?next=${encodeURIComponent(`/myAccount/wanted-messages/${conversationId}`)}`}>Sign in</Link> to see this conversation.</p> : thread === undefined ? <p role="status">Loading conversation…</p> : !thread ? <p>This conversation is unavailable.</p> : <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5 min-w-0">
          <div><h1 className="text-2xl font-bold">Conversation with {thread.otherUserName}</h1><p className="mt-1 text-sm text-muted-foreground">About “{thread.conversation.requestSnapshot.title}”</p></div>
          {thread.conversation.role === "buyer" && <Button type="button" variant="outline" disabled={busy || thread.otherUserName === "Deleted account"} onClick={changeDismissed}>{thread.dismissed ? "Reopen conversation" : "Pass on this response"}</Button>}
          {thread.dismissed && <p role="status" className="rounded-md border bg-slate-50 p-3 text-sm">The buyer passed on this response. Messaging stays paused until the buyer explicitly reopens this conversation.</p>}
          {messageStatus === "CanLoadMore" && <Button type="button" variant="outline" onClick={() => loadMore(30)}>Load earlier messages</Button>}
          <ol className="space-y-3" aria-label="Conversation messages">{[...messages].reverse().map(message => <li key={message._id} className={`max-w-[95%] rounded-xl border p-4 sm:max-w-[85%] ${message.isMine ? "ml-auto bg-primary/5" : "bg-white"}`}>
            <p className="text-xs font-semibold">{message.isMine ? "You" : thread.otherUserName}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.content}</p>
            {message.photoIds.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{message.photoIds.map((photoId, index) => <PrivateWantedPhoto key={photoId} photoId={photoId} label={`Private vehicle photo ${index + 1}`} />)}</div>}
            <p className="mt-2 text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</p>
          </li>)}</ol>
          {!thread.canContact && <p role="status" className="rounded-md border bg-slate-50 p-3 text-sm">This conversation is read only. Messaging is unavailable.</p>}
          {thread.canContact && <form onSubmit={sendMessage} className="space-y-3 rounded-xl border bg-white p-4"><label className="block text-sm font-medium">Message<textarea required minLength={1} maxLength={2000} rows={4} className="mt-1 w-full rounded-md border p-2" value={content} onChange={event => setContent(event.target.value)} /></label>
            {listings && listings.some(listing => ["active", "approved", "reserved"].includes(listing.status) && !listing.moderationRemovedAt && (listing.status === "reserved" || listing.availabilityDueAt === undefined || listing.availabilityDueAt > Date.now())) && <label className="block text-sm">Share one of your approved listings<select className="mt-1 w-full rounded-md border p-2" value="" onChange={event => { if (event.target.value) shareListing(event.target.value); }}><option value="">Choose a listing to add its link</option>{listings.filter(listing => ["active", "approved", "reserved"].includes(listing.status) && !listing.moderationRemovedAt && (listing.status === "reserved" || listing.availabilityDueAt === undefined || listing.availabilityDueAt > Date.now())).map(listing => <option key={listing._id} value={listing._id}>{listing.year} {listing.make} {listing.model}</option>)}</select></label>}
            <label className="block text-sm">Private photos (optional, up to 10)<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="mt-1 block w-full text-sm" onChange={event => { const selected = Array.from(event.target.files ?? []); try { validateWantedPhotoFiles(selected); setFiles(selected); setError(""); } catch (cause) { setFiles([]); setError(cause instanceof Error ? cause.message : "Invalid photos."); } }} /></label>
            <SelectedWantedPhotos files={files} />
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<Button disabled={busy || !content.trim()} type="submit">{busy ? "Sending…" : "Send message"}</Button>
          </form>}
          <div className="flex flex-wrap gap-3 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={toggleBlock}>{thread.blocked ? "Unblock account" : "Block account"}</Button><Button type="button" variant="outline" onClick={() => setReportOpen(!reportOpen)}>Report conversation</Button></div>
          {reportOpen && <form onSubmit={submitReport} className="space-y-3 rounded-lg border p-4"><label className="block text-sm">Reason<select value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-md border p-2"><option value="spam">Spam</option><option value="scam">Scam</option><option value="unsafe_content">Unsafe content</option><option value="false_information">False information</option><option value="privacy">Privacy</option><option value="other">Other</option></select></label><label className="block text-sm">Details<textarea required maxLength={2000} value={details} onChange={event => setDetails(event.target.value)} className="mt-1 w-full rounded-md border p-2" /></label><Button type="submit" disabled={busy}>Send report</Button></form>}
          {notice && <p role="status" className="text-sm">{notice}</p>}
          {error && !thread.canContact && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
        <aside className="h-fit space-y-5 rounded-xl border bg-white p-5"><section><h2 className="font-semibold">Original buyer request</h2><p className="mt-2 text-sm">{thread.conversation.requestSnapshot.title}</p><p className="mt-1 text-sm">Budget up to {money(thread.conversation.requestSnapshot.maxBudget)}</p><p className="mt-1 text-sm">{thread.conversation.requestSnapshot.area} · {thread.conversation.requestSnapshot.radiusMiles ? `${thread.conversation.requestSnapshot.radiusMiles} miles` : "Nationwide"}</p><p className="mt-2 text-xs text-muted-foreground">This original context stays with the private conversation if the request closes or expires.</p></section><section className="border-t pt-4"><h2 className="font-semibold">Seller&apos;s vehicle</h2><p className="mt-2 text-sm">{thread.conversation.sellerVehicle.year} {thread.conversation.sellerVehicle.make} {thread.conversation.sellerVehicle.model}</p><p className="mt-1 text-sm">{money(thread.conversation.sellerVehicle.askingPrice)} · about {thread.conversation.sellerVehicle.mileage.toLocaleString()} miles</p><p className="mt-1 text-sm">{thread.conversation.sellerVehicle.city}, {thread.conversation.sellerVehicle.state}</p></section></aside>
      </div>
    </>}
  </main><Footer /></div>;
}
