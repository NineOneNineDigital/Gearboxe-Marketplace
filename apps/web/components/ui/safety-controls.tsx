"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "./button";
import { Textarea } from "./textarea";

export const safetyReasons = ["spam", "scam", "harassment", "unsafe_content", "false_information", "stolen_vehicle", "privacy", "other"] as const;
export type SafetyReason = typeof safetyReasons[number];
export const reasonLabel = (reason: string) => reason.replaceAll("_", " ");

export function SafetyControls({ vehicleId, targetUserId }: { vehicleId?: Id<"vehicles">; targetUserId: Id<"users"> }) {
  const { user, isLoading } = useCurrentUser();
  const safety = useQuery(api.trust.getMySafety, user ? {} : "skip");
  const reportListing = useMutation(api.trust.reportListing);
  const reportUser = useMutation(api.trust.reportUser);
  const setBlock = useMutation(api.trust.setBlock);
  const [target, setTarget] = useState<"listing" | "user" | null>(null);
  const [reason, setReason] = useState<SafetyReason>("scam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const blocked = safety?.blocks.some((block) => block.blockedUserId === targetUserId);
  if (isLoading || user?._id === targetUserId) return null;
  if (!user) return <p className="text-sm"><Link className="underline" href="/sign-in">Sign in to report a concern</Link></p>;

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true); setFeedback("");
    try { await action(); setFeedback(message); setTarget(null); setDetails(""); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Unable to save. Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-3 border-t pt-4">
    <div className="flex flex-wrap gap-2">
      {vehicleId && <Button size="sm" variant="outline" onClick={() => setTarget("listing")}>Report listing</Button>}
      <Button size="sm" variant="outline" onClick={() => setTarget("user")}>Report user</Button>
      <Button size="sm" variant="outline" disabled={busy || !safety} onClick={() => run(() => setBlock({ targetUserId, blocked: !blocked }), blocked ? "User unblocked." : "User blocked. Neither of you can send new messages to the other.")}>{blocked ? "Unblock user" : "Block user"}</Button>
    </div>
    {target && <form className="space-y-3 rounded-md border p-3" onSubmit={(event) => {
      event.preventDefault();
      void run(() => target === "listing" && vehicleId ? reportListing({ vehicleId, reason, details }) : reportUser({ targetUserId, reason, details }), "Report received. Our moderation team will review it.");
    }}>
      <label className="block text-sm font-medium">Reason for reporting {target}
        <select className="mt-1 block w-full rounded-md border p-2" value={reason} onChange={(event) => setReason(event.target.value as SafetyReason)}>{safetyReasons.map((code) => <option key={code} value={code}>{reasonLabel(code)}</option>)}</select>
      </label>
      <label className="block text-sm font-medium">Details<Textarea className="mt-1" required maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Describe what happened. Do not include private documents or contact information." /></label>
      <p className="text-xs text-muted-foreground">Reports are private. For immediate danger, contact local emergency services.</p>
      <div className="flex gap-2"><Button size="sm" disabled={busy || !details.trim()}>Submit report</Button><Button type="button" size="sm" variant="outline" onClick={() => setTarget(null)}>Cancel</Button></div>
    </form>}
    {feedback && <p role="status" className="text-sm break-words">{feedback}</p>}
  </div>;
}
