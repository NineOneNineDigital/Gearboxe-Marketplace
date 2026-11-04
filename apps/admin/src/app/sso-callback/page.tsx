"use client";

import { AuthShell } from "@/components/ui/auth-shell";
import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function SsoCallbackPage() {
  const clerk = useClerk();
  const started = useRef(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void clerk.handleRedirectCallback({
      signInUrl: "/sign-in",
      signUpUrl: "/access-denied",
      secondFactorUrl: "/sign-in",
      signInFallbackRedirectUrl: "/",
    }).catch(() => setError(true));
  }, [clerk]);

  return <div className="min-h-0 flex-1 overflow-y-auto"><AuthShell area="admin">
    <div className="space-y-4 text-center">
      {error ? <><h1 className="text-xl font-semibold text-gray-900">Sign in could not be completed</h1><Link href="/sign-in" className="text-sm font-medium text-primary underline">Return to sign in</Link></> : <p className="text-sm text-gray-600" role="status">Completing sign in…</p>}
    </div>
  </AuthShell></div>;
}
