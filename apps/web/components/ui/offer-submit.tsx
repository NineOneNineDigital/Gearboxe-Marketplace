"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function OfferSubmit({ vehicleId, sellerId }: { vehicleId: Id<"vehicles">; sellerId: Id<"users"> }) {
  const submit = useMutation(api.offers.submit);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("offer") === "1") setOpen(true);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[0-9]+$/.test(price) || Number(price) < 1 || Number(price) > 100_000_000) {
      setError("Enter a whole-dollar amount from $1 to $100,000,000.");
      return;
    }
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      await submit({ vehicleId, dollars: Number(price), requestId: requestId.current });
      router.push(`/myAccount/messages/${vehicleId}/${sellerId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your offer. Please try again.");
    } finally { setBusy(false); }
  }

  if (!open) return <Button variant="outline" size="lg" className="mt-3 w-full" onClick={() => setOpen(true)}>Make an offer</Button>;
  return <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border p-4">
    <label htmlFor="offer-price" className="block text-sm font-medium">Offer amount (USD)</label>
    <Input id="offer-price" inputMode="numeric" pattern="[0-9]*" value={price} onChange={event => { setPrice(event.target.value); requestId.current = null; }} placeholder="Whole dollars" required />
    <p className="text-sm leading-6 text-muted-foreground">Your offer is a price proposal to the seller. It expires in 48 hours unless the seller responds. Gearboxe does not process payment for the vehicle.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit offer"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div>
    <p className="text-xs text-muted-foreground">Already made an offer? <Link className="underline" href={`/myAccount/messages/${vehicleId}/${sellerId}`}>View your conversation</Link>.</p>
  </form>;
}
