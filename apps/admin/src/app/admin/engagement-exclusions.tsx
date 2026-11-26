"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

type Pair = NonNullable<ReturnType<typeof useQuery<typeof api.engagement.reviewPairs>>>["pairs"][number];

function PairRow({ pair }: { pair: Pair }) {
  const setExcluded = useMutation(api.engagement.setExcluded);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const excluded = pair.excludedAt !== null;
  async function submit() {
    setError(""); setBusy(true);
    try {
      await setExcluded({ pairId: pair.id, excluded: !excluded, reason: reason.trim() });
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this pair.");
    } finally { setBusy(false); }
  }
  return <li className="rounded-lg border border-black/10 p-3 text-xs">
    <p className="font-medium">{pair.kind === "active" ? "Active" : "Reserved"} {pair.firstSource} · {new Date(pair.firstAt).toLocaleString()} · {pair.responded ? "seller replied" : "no reply"} · {excluded ? "excluded" : "included"}</p>
    <p className="mt-1 break-all text-muted-foreground">Pair {pair.id} · Listing {pair.vehicleId} · Buyer {pair.buyerId}</p>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`reason-${pair.id}`}>Audit reason for pair {pair.id}</label>
      <input id={`reason-${pair.id}`} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} placeholder={excluded ? "Reason to restore (10–500 characters)" : "Reason to exclude (10–500 characters)"} className="min-w-64 flex-1 rounded-md border border-black/20 px-3 py-2" />
      <button type="button" onClick={submit} disabled={busy || reason.trim().length < 10} className="rounded-md bg-[hsl(var(--midnight))] px-3 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : excluded ? "Restore" : "Exclude"}</button>
    </div>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </li>;
}

export function EngagementExclusions() {
  const review = useQuery(api.engagement.reviewPairs, {});
  return <details className="mt-5 border-t border-black/10 pt-4 text-sm">
    <summary className="cursor-pointer font-semibold">Review engagement exclusions</summary>
    <p className="mt-2 text-xs text-muted-foreground">Use a case reference or factual reason. Do not copy private messages, offer details, or contact information into the reason. Changes are audited. Only the first 500 pairs in the current seven-day cohort can be reviewed here.</p>
    {!review ? <p className="mt-3">Loading pairs…</p> : <>
      {review.truncated && <p className="mt-2 text-xs text-amber-800">The review list is capped at 500 pairs.</p>}
      <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto">{review.pairs.map(pair => <PairRow key={pair.id} pair={pair} />)}</ul>
      {review.pairs.length === 0 && <p className="mt-3 text-muted-foreground">No recorded pairs in this cohort.</p>}
    </>}
  </details>;
}
