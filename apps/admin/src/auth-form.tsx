"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon } from "@/components/ui/google-icon";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Mode = "password" | "second-factor";
type SignInResource = Awaited<ReturnType<NonNullable<ReturnType<typeof useSignIn>["signIn"]>["create"]>>;
type SignInSecondFactor = NonNullable<SignInResource["supportedSecondFactors"]>[number];

function authError(error: unknown) {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage || error.errors[0]?.message || "Unable to sign in. Please try again.";
  }
  return "Unable to sign in. Please try again.";
}

function factorLabel(factor: SignInSecondFactor) {
  if (factor.strategy === "totp") return "Authenticator app";
  if (factor.strategy === "phone_code") return "Text message";
  return "Backup code";
}

export function AdminSignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [factors, setFactors] = useState<SignInSecondFactor[]>([]);
  const [selectedFactor, setSelectedFactor] = useState<SignInSecondFactor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resumingSecondFactor = useRef(false);

  useEffect(() => {
    if (authLoaded && isSignedIn) router.replace("/");
  }, [authLoaded, isSignedIn, router]);

  // An OAuth callback can return to this page with a pending second factor.
  useEffect(() => {
    if (!isLoaded || !signIn || busy || mode !== "password" || signIn.status !== "needs_second_factor" || resumingSecondFactor.current) return;
    resumingSecondFactor.current = true;
    const available = signIn.supportedSecondFactors ?? [];
    const factor = available.find((item) => item.strategy === "totp") ?? available[0];
    if (!factor) {
      setError("No supported verification method is available for this account.");
      return;
    }
    setFactors(available);
    if (factor.strategy === "phone_code") {
      void signIn.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: factor.phoneNumberId })
        .then(() => { setSelectedFactor(factor); setMode("second-factor"); })
        .catch((caught: unknown) => setError(authError(caught)));
    } else {
      setSelectedFactor(factor);
      setMode("second-factor");
    }
  }, [busy, isLoaded, mode, signIn]);

  async function finish(attempt: SignInResource) {
    if (!attempt.createdSessionId || !setActive) throw new Error("No session was created. Please try again.");
    await setActive({ session: attempt.createdSessionId });
    router.replace("/");
    router.refresh();
  }

  async function selectFactor(factor: SignInSecondFactor) {
    if (!isLoaded || !signIn) return;
    if (factor.strategy === "phone_code") {
      await signIn.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: factor.phoneNumberId });
    }
    setSelectedFactor(factor);
    setCode("");
    setMode("second-factor");
  }

  async function continueAttempt(attempt: SignInResource) {
    if (attempt.status === "complete") {
      await finish(attempt);
      return;
    }
    if (attempt.status === "needs_second_factor") {
      const available = attempt.supportedSecondFactors ?? [];
      if (!available.length) throw new Error("No supported verification method is available for this account.");
      setFactors(available);
      await selectFactor(available.find((factor) => factor.strategy === "totp") ?? available[0]);
      return;
    }
    throw new Error("This account needs another sign-in step. Contact Gearboxe support.");
  }

  async function run(operation: () => Promise<void>) {
    if (!isLoaded || busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error && !isClerkAPIResponseError(caught) ? caught.message : authError(caught));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signIn) return;
    const activeSignIn = signIn;
    void run(async () => {
      if (mode === "password") {
        setCode("");
        await continueAttempt(await activeSignIn.create({ identifier: email.trim(), password }));
      } else if (selectedFactor) {
        await continueAttempt(await activeSignIn.attemptSecondFactor({ strategy: selectedFactor.strategy, code: code.trim() }));
      }
    });
  }

  function startOAuth() {
    if (!signIn) return;
    const activeSignIn = signIn;
    void run(async () => {
      await activeSignIn.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: "/" });
    });
  }

  if (!isLoaded || !authLoaded || isSignedIn) {
    return <Card className="w-full border-gray-200 bg-white p-8 text-center text-sm text-gray-600 shadow-lg" role="status">
      {isSignedIn ? "Opening your workspace…" : "Loading sign in…"}
    </Card>;
  }

  const isPassword = mode === "password";
  const isSecondFactor = mode === "second-factor";

  return <Card className="w-full border-gray-200 bg-white p-8 shadow-lg">
      <form className="space-y-6" onSubmit={submit}>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

        {isPassword && <div className="space-y-2">
          <Label htmlFor="admin-email" className="text-sm font-medium text-gray-700">Email address</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <Input id="admin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="border-gray-300 bg-white pl-10 text-gray-900" placeholder="Enter your email" />
          </div>
        </div>}

        {isPassword && <div className="space-y-2">
          <Label htmlFor="admin-password" className="text-sm font-medium text-gray-700">Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <Input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="border-gray-300 bg-white pl-10 pr-10 text-gray-900" placeholder="Enter your password" />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>}

        {isSecondFactor && <div className="space-y-2">
          <Label htmlFor="admin-code" className="text-sm font-medium text-gray-700">{selectedFactor ? `${factorLabel(selectedFactor)} code` : "Verification code"}</Label>
          <Input id="admin-code" type="text" inputMode={selectedFactor?.strategy === "backup_code" ? "text" : "numeric"} autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} className="border-gray-300 bg-white text-gray-900" placeholder="Enter your code" />
          {selectedFactor?.strategy === "phone_code" && <button type="button" disabled={busy} onClick={() => void run(() => selectFactor(selectedFactor))} className="text-sm font-medium text-primary hover:underline disabled:opacity-50">Resend code</button>}
        </div>}

        {isSecondFactor && factors.length > 1 && <div className="flex flex-wrap gap-2" aria-label="Verification methods">
          {factors.map((factor) => <Button key={factor.strategy} type="button" size="sm" variant={selectedFactor?.strategy === factor.strategy ? "default" : "outline"} disabled={busy} onClick={() => void run(() => selectFactor(factor))}>{factorLabel(factor)}</Button>)}
        </div>}

        <Button type="submit" disabled={busy} className="w-full bg-primary py-3 text-base font-medium text-white hover:bg-primary/90">
          {busy ? "Please wait…" : isPassword ? "Sign in" : "Verify and sign in"}
        </Button>

        {!isPassword && <button type="button" onClick={() => { setError(""); setCode(""); setMode("password"); }} className="w-full text-sm font-medium text-primary hover:underline">Back to sign in</button>}
      </form>

      {isPassword && <div className="mt-6">
        <div className="relative flex items-center justify-center text-sm text-gray-500"><span className="absolute inset-x-0 border-t border-gray-200" /><span className="relative bg-white px-2">Or continue with</span></div>
        <Button type="button" variant="outline" disabled={busy} onClick={startOAuth} className="mt-6 w-full border-gray-200 hover:bg-gray-50"><GoogleIcon className="mr-2 h-5 w-5" />Continue with Google</Button>
      </div>}
  </Card>;
}
