"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useUser } from "@clerk/nextjs";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

type ContactKind = "email" | "phone";
type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
type PendingVerification =
  | { kind: "email"; value: string; resource: ClerkUser["emailAddresses"][number] }
  | { kind: "phone"; value: string; resource: ClerkUser["phoneNumbers"][number] };

function errorMessage(error: unknown) {
  return isClerkAPIResponseError(error)
    ? error.errors[0]?.longMessage || error.errors[0]?.message || "Unable to update your profile. Please try again."
    : "Unable to update your profile. Please try again.";
}

export function EditProfileDialog() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    if (busy) return;
    if (nextOpen && user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
      setEmail(pending?.kind === "email" ? pending.value : user.primaryEmailAddress?.emailAddress ?? "");
      setPhone(pending?.kind === "phone" ? pending.value : user.primaryPhoneNumber?.phoneNumber ?? "");
      setError("");
      setFeedback("");
    }
    setOpen(nextOpen);
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || first.length > 50 || last.length > 50) {
      setError("Enter a first name of up to 50 characters and a last name of up to 50 characters.");
      return;
    }
    setBusy(true); setError(""); setFeedback("");
    try {
      await user.update({ firstName: first, lastName: last });
      setFeedback("Name saved. Your account details may take a moment to refresh.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function beginContactChange(event: FormEvent<HTMLFormElement>, kind: ContactKind) {
    event.preventDefault();
    if (!user || busy) return;
    const value = kind === "email" ? email.trim().toLowerCase() : phone.trim();
    if (kind === "email" && (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
      setError("Enter a valid email address.");
      return;
    }
    if (kind === "phone" && !/^\+[1-9]\d{7,14}$/.test(value)) {
      setError("Enter a phone number with country code, such as +15551234567.");
      return;
    }
    const current = kind === "email" ? user.primaryEmailAddress?.emailAddress.toLowerCase() : user.primaryPhoneNumber?.phoneNumber;
    if (value === current) {
      setFeedback(`${kind === "email" ? "Email address" : "Phone number"} is already current.`);
      setError("");
      return;
    }
    setBusy(true); setError(""); setFeedback("");
    try {
      if (kind === "email") {
        const address = user.emailAddresses.find((item) => item.emailAddress.toLowerCase() === value)
          ?? await user.createEmailAddress({ email: value });
        if (address.verification.status === "verified") {
          await user.update({ primaryEmailAddressId: address.id });
          setFeedback("Email address updated.");
        } else {
          await address.prepareVerification({ strategy: "email_code" });
          setPending({ kind, value, resource: address });
          setCode("");
          setFeedback("We sent a verification code to your new email address.");
        }
      } else {
        const number = user.phoneNumbers.find((item) => item.phoneNumber === value)
          ?? await user.createPhoneNumber({ phoneNumber: value });
        if (number.verification.status === "verified") {
          await user.update({ primaryPhoneNumberId: number.id });
          setFeedback("Phone number updated.");
        } else {
          await number.prepareVerification();
          setPending({ kind, value, resource: number });
          setCode("");
          setFeedback("We sent a verification code to your new phone number.");
        }
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function verifyContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !pending || busy || !code.trim()) return;
    setBusy(true); setError(""); setFeedback("");
    try {
      if (pending.kind === "email") {
        const verified = pending.resource.verification.status === "verified"
          ? pending.resource
          : await pending.resource.attemptVerification({ code: code.trim() });
        if (verified.verification.status !== "verified") throw new Error("Email verification is incomplete");
        setPending({ ...pending, resource: verified });
        await user.update({ primaryEmailAddressId: verified.id });
        setFeedback("Email address verified and updated.");
      } else {
        const verified = pending.resource.verification.status === "verified"
          ? pending.resource
          : await pending.resource.attemptVerification({ code: code.trim() });
        if (verified.verification.status !== "verified") throw new Error("Phone verification is incomplete");
        setPending({ ...pending, resource: verified });
        await user.update({ primaryPhoneNumberId: verified.id });
        setFeedback("Phone number verified and updated.");
      }
      setPending(null);
      setCode("");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="outline">Edit profile <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[hsl(var(--midnight)/0.75)] backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[calc(100dvh-2rem)] max-w-lg -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl sm:p-8"
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
          onInteractOutside={(event) => { if (busy) event.preventDefault(); }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="market-eyebrow">Your profile</p>
              <Dialog.Title className="mt-4 text-2xl font-semibold">Edit your details</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                Update your name and verify new contact details before they appear on your account.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild><Button type="button" variant="ghost" size="icon" disabled={busy} aria-label="Close profile editor"><X className="h-5 w-5" /></Button></Dialog.Close>
          </div>

          <div className="mt-6 space-y-6">
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
            {feedback && <p role="status" className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feedback}</p>}

            <form onSubmit={saveName} className="space-y-4">
              <h3 className="font-semibold">Name</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="profile-first-name">First name</Label><Input id="profile-first-name" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={50} required disabled={busy} /></div>
                <div className="space-y-2"><Label htmlFor="profile-last-name">Last name</Label><Input id="profile-last-name" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={50} disabled={busy} /></div>
              </div>
              <Button type="submit" disabled={busy || !user}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save name</Button>
            </form>

            <div className="border-t border-black/10 pt-6">
              <form onSubmit={(event) => beginContactChange(event, "email")} className="space-y-3">
                <Label htmlFor="profile-email">Email address</Label>
                <div className="flex flex-col gap-3 sm:flex-row"><Input id="profile-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy || pending !== null} /><Button type="submit" variant="outline" disabled={busy || !user || pending !== null}>Update email</Button></div>
              </form>
              {pending?.kind === "email" && <VerificationForm code={code} setCode={setCode} busy={busy} onSubmit={verifyContact} onCancel={() => { setPending(null); setCode(""); setError(""); }} destination={pending.value} />}
            </div>

            <div className="border-t border-black/10 pt-6">
              <form onSubmit={(event) => beginContactChange(event, "phone")} className="space-y-3">
                <Label htmlFor="profile-phone">Phone number</Label>
                <p className="text-xs text-muted-foreground">Include your country code, for example +15551234567.</p>
                <div className="flex flex-col gap-3 sm:flex-row"><Input id="profile-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={busy || pending !== null} /><Button type="submit" variant="outline" disabled={busy || !user || pending !== null}>Update phone</Button></div>
              </form>
              {pending?.kind === "phone" && <VerificationForm code={code} setCode={setCode} busy={busy} onSubmit={verifyContact} onCancel={() => { setPending(null); setCode(""); setError(""); }} destination={pending.value} />}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function VerificationForm({ code, setCode, busy, onSubmit, onCancel, destination }: {
  code: string;
  setCode: (value: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  destination: string;
}) {
  return <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
    <p className="text-sm">Enter the verification code sent to <strong className="break-all">{destination}</strong>.</p>
    <div className="space-y-2"><Label htmlFor="profile-code">Verification code</Label><Input id="profile-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required disabled={busy} /></div>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || !code.trim()}>Verify & save</Button><Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button></div>
  </form>;
}
