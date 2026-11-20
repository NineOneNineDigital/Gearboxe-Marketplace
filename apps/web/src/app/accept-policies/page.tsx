"use client";

import { AuthShell } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listingReturnPath } from "@/lib/auth-return";
import { clearSignupPolicyIntent, matchingSignupPolicyIntent } from "@/lib/signup-policy-intent";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function clearIntent() {
  try { clearSignupPolicyIntent(window.sessionStorage); } catch { /* storage unavailable */ }
}

export default function AcceptPoliciesPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const status = useQuery(api.users.currentPolicyStatus, isSignedIn ? {} : "skip");
  const acceptPolicies = useMutation(api.users.acceptPolicies);
  const router = useRouter();
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [signupIntentToken, setSignupIntentToken] = useState<string | null>(null);
  const [acceptedForPair, setAcceptedForPair] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attemptedIntent = useRef<string | null>(null);

  useEffect(() => {
    setReturnTo(listingReturnPath(window.location.search));
    setSignupIntentToken(new URLSearchParams(window.location.search).get("policyIntent"));
  }, []);

  useEffect(() => {
    if (!isLoaded || returnTo === null) return;
    if (!isSignedIn) {
      router.replace(`/sign-in?next=${encodeURIComponent(returnTo)}`);
    } else if (status && (!status.published || status.accepted)) {
      router.replace(returnTo);
    }
  }, [isLoaded, isSignedIn, returnTo, router, status]);

  const pair = status?.published;
  const pairKey = pair ? `${pair.termsVersion}\u0000${pair.privacyVersion}` : null;
  const accepted = pairKey !== null && acceptedForPair === pairKey;

  useEffect(() => {
    if (!isSignedIn || !pair || !status?.provisioned || status.accepted || !returnTo || !signupIntentToken || attemptedIntent.current === signupIntentToken) return;
    let valid = false;
    try { valid = matchingSignupPolicyIntent(window.sessionStorage, pair, signupIntentToken); } catch { /* storage unavailable */ }
    if (!valid) return;
    attemptedIntent.current = signupIntentToken;
    setBusy(true);
    void acceptPolicies({ accepted: true, termsVersion: pair.termsVersion, privacyVersion: pair.privacyVersion })
      .then(() => { clearIntent(); router.replace(returnTo); })
      .catch(() => {
        clearIntent();
        setError("We could not record your signup acceptance. Please review the current policies and agree below.");
      })
      .finally(() => setBusy(false));
  }, [acceptPolicies, isSignedIn, pair, returnTo, router, signupIntentToken, status]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted || !pair || !status?.provisioned || !returnTo) return;
    setBusy(true);
    setError("");
    try {
      await acceptPolicies({ accepted: true, termsVersion: pair.termsVersion, privacyVersion: pair.privacyVersion });
      clearIntent();
      router.replace(returnTo);
    } catch {
      clearIntent();
      setAcceptedForPair(null);
      setError("We could not record your acceptance. The policies may have changed; refresh this page and review them again.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell area="market">
    <Card className="space-y-5 border-gray-200 bg-white p-6 shadow-lg sm:p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Review marketplace policies</h1>
      {(!isLoaded || returnTo === null || (isSignedIn && status === undefined) || !pair || status?.accepted) ?
        <p role="status" className="text-sm text-gray-600">Continuing to your account…</p> :
        !status.provisioned ? <div className="space-y-3">
          <p role="status" className="text-sm text-gray-600">Finishing your account setup. Your policy choice has not been recorded yet.</p>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>Check again</Button>
        </div> :
        <form onSubmit={submit} className="space-y-5">
          {busy && signupIntentToken && <p role="status" className="text-sm text-gray-600">Recording your signup acceptance…</p>}
          <p className="text-sm text-gray-700">Read both policies before continuing. This choice will be recorded with the policy versions and the time you accept.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li><a href={pair.termsUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Marketplace Terms (version {pair.termsVersion})</a></li>
            <li><a href={pair.privacyUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Privacy Policy (version {pair.privacyVersion})</a></li>
          </ul>
          <label className="flex items-start gap-3 text-sm text-gray-800">
            <input type="checkbox" checked={accepted} onChange={event => setAcceptedForPair(event.target.checked ? pairKey : null)} required className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
            <span>I have read and agree to these versions of the Marketplace Terms and Privacy Policy.</span>
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={busy || !accepted} className="w-full">{busy ? "Saving…" : "Agree and continue"}</Button>
        </form>}
    </Card>
  </AuthShell>;
}
