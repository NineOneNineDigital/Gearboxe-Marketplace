"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useState } from "react";

type Offer = {
  id: Id<"offerThreads">; buyerId: Id<"users">; sellerId: Id<"users">; senderId: Id<"users">;
  status: string; version: number; priceCents: number;
  expiresAt: number; acceptedAt?: number; checkAt?: number; selfExtended: boolean;
  needsReview: boolean; competingReservation: boolean; allowedActions: string[];
};

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
const date = (at: number) => new Date(at).toLocaleString();

function OfferCard({ offer, userId }: { offer: Offer; userId: Id<"users"> }) {
  const respond = useMutation(api.offers.respond);
  const cancel = useMutation(api.offers.cancel);
  const renew = useMutation(api.offers.renew);
  const finish = useMutation(api.offers.finish);
  const [choice, setChoice] = useState("");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const history = usePaginatedQuery(api.offers.history, { threadId: offer.id }, { initialNumItems: 10 });
  const labels: Record<string, string> = { accept: "Accept", decline: "Decline", counter: "Counteroffer", withdraw: "Withdraw", cancel: "Cancel agreement", renew: "Extend reservation", sold: "Mark sold", available: "Make available again" };
  const actorLabel = (actorId?: Id<"users">) => actorId === userId ? "You" : actorId === offer.sellerId ? "Seller" : actorId === offer.buyerId ? "Buyer" : "Gearboxe";

  async function act() {
    if (choice === "counter" && (!/^[0-9]+$/.test(price) || Number(price) < 1 || Number(price) > 100_000_000)) {
      setError("Enter a whole-dollar amount from $1 to $100,000,000."); return;
    }
    if (["cancel", "sold", "available"].includes(choice) && !reason.trim()) { setError("Enter a reason to continue."); return; }
    setBusy(true); setError("");
    try {
      const base = { threadId: offer.id, version: offer.version };
      if (choice === "cancel") await cancel({ ...base, reason: reason.trim() });
      else if (choice === "renew") await renew(base);
      else if (choice === "sold" || choice === "available") await finish({ ...base, outcome: choice, reason: reason.trim() });
      else if (choice === "accept" || choice === "decline" || choice === "counter" || choice === "withdraw") await respond({ ...base, action: choice, ...(choice === "counter" ? { dollars: Number(price) } : {}) });
      setChoice(""); setPrice(""); setReason("");
    } catch (err) {
      setError(`${err instanceof Error ? err.message : "Unable to complete this action."} The offer may have changed or expired; review its current state before trying again.`);
    } finally { setBusy(false); }
  }

  return <section className="rounded-lg border bg-white p-4 space-y-3" aria-label="Private offer">
    <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">Private offer: {money(offer.priceCents)}</h3><p className="text-sm capitalize text-muted-foreground">{offer.status.replaceAll("_", " ")}</p>{offer.status === "open" && <p className="text-sm text-muted-foreground">Proposed by {actorLabel(offer.senderId).toLowerCase()} · awaiting a response</p>}</div>{offer.status === "open" && <p className="text-sm text-muted-foreground">Expires {date(offer.expiresAt)}</p>}</div>
    {offer.status === "reserved" && <p className="text-sm">Accepting records a nonbinding agreement in principle and marks this listing Reserved. You and the other person still decide how to inspect, pay for, and transfer the vehicle. Gearboxe does not hold purchase funds.</p>}
    {offer.status === "awaiting_outcome" && <p className="text-sm">Either person can end this nonbinding agreement. The seller must then mark the vehicle Sold or Available again; cancellation alone does not change the listing.</p>}
    {offer.competingReservation && <p className="text-sm">This vehicle is Reserved. Your proposal remains visible until it expires, but cannot be accepted while the reservation is active. If the vehicle becomes available again, send a new offer.</p>}
    {offer.checkAt && <p className="text-sm">Reservation check: {date(offer.checkAt)}</p>}
    {offer.needsReview && offer.sellerId === userId && <p className="text-sm">Your vehicle has been Reserved for seven days. Mark it Sold, make it Available again, or extend the reservation once for seven days. If you need more time after that, contact support.</p>}
    {!choice && <div className="flex flex-wrap gap-2">{offer.allowedActions.map(action => <Button key={action} variant="outline" size="sm" onClick={() => { setError(""); setChoice(action); }}>{labels[action] ?? action}</Button>)}</div>}
    {choice && <div className="space-y-3 rounded-md bg-muted p-3">
      {choice === "accept" && <p className="text-sm">Accepting records a nonbinding agreement in principle and marks this listing Reserved. You and the other person still decide how to inspect, pay for, and transfer the vehicle. Gearboxe does not hold purchase funds.</p>}
      {choice === "counter" && <><p className="text-sm">The previous proposal is no longer open. The other person has 48 hours to accept, decline, or counter this price.</p><label className="block text-sm font-medium" htmlFor={`counter-${offer.id}`}>Counteroffer amount (USD)</label><Input id={`counter-${offer.id}`} inputMode="numeric" value={price} onChange={event => setPrice(event.target.value)} placeholder="Whole dollars" /></>}
      {choice === "cancel" && <p className="text-sm">Either person can end this nonbinding agreement. The seller must then mark the vehicle Sold or Available again; cancellation alone does not change the listing.</p>}
      {["cancel", "sold", "available"].includes(choice) && <><label className="block text-sm font-medium" htmlFor={`reason-${offer.id}`}>Reason</label><Input id={`reason-${offer.id}`} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} /></>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={act}>{busy ? "Saving…" : `Confirm ${labels[choice]?.toLowerCase() ?? choice}`}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => { setChoice(""); setError(""); }}>Back</Button></div>
    </div>}
    <details><summary className="cursor-pointer text-sm font-medium">Offer history</summary><ol className="mt-2 space-y-1 text-sm text-muted-foreground">{history.results.map((item, index) => <li key={`${item.version}-${index}`}>{date(item.at)} · {actorLabel(item.actorId)} {item.kind.replaceAll("_", " ")}{item.priceCents !== undefined ? ` · ${money(item.priceCents)}` : ""}</li>)}</ol>{history.status === "CanLoadMore" && <Button variant="link" size="sm" onClick={() => history.loadMore(10)}>Load older history</Button>}</details>
  </section>;
}

export function OfferThread({ conversationId, userId }: { conversationId: Id<"conversations">; userId: Id<"users"> }) {
  const offers = usePaginatedQuery(api.offers.forConversation, { conversationId }, { initialNumItems: 10 });
  if (offers.status === "LoadingFirstPage") return <p role="status" className="p-4 text-sm">Loading offers…</p>;
  if (!offers.results.length) return null;
  return <div className="space-y-3 border-b bg-gray-50 p-4"><h2 className="font-semibold">Offers</h2>{offers.results.map(offer => <OfferCard key={offer.id} offer={offer} userId={userId} />)}{offers.status === "CanLoadMore" && <Button variant="outline" size="sm" onClick={() => offers.loadMore(10)}>Load older offers</Button>}</div>;
}
