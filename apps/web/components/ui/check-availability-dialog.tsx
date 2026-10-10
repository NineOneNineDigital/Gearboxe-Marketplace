"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import * as Dialog from "@radix-ui/react-dialog";
import { useConvexAuth, useMutation } from "convex/react";
import { Check, Loader2, Send, X } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";

interface CheckAvailabilityDialogProps {
  vehicle: Doc<"vehicles">;
}

const MAX_MESSAGE_LENGTH = 2_000;

export function CheckAvailabilityDialog({ vehicle }: CheckAvailabilityDialogProps) {
  const { user, isLoading } = useCurrentUser();
  const { isAuthenticated } = useConvexAuth();
  const sendMessage = useMutation(api.messages.sendMessage);
  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const initialMessage = `Hi, is your ${vehicleLabel} still available?`;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const sendInProgress = useRef(false);
  const messageId = useId();
  const errorId = useId();
  const ownsVehicle = user?._id === vehicle.userId;
  const validMessage = message.trim().length > 0 && message.length <= MAX_MESSAGE_LENGTH;

  const handleOpenChange = (nextOpen: boolean) => {
    if (sendInProgress.current) return;
    if (nextOpen) {
      setMessage(initialMessage);
      setError("");
      setSent(false);
    }
    setOpen(nextOpen);
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendInProgress.current || sent || isLoading || !user || ownsVehicle) return;
    const content = message.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      setError("Enter a message between 1 and 2,000 characters.");
      return;
    }

    sendInProgress.current = true;
    setSending(true);
    setError("");
    try {
      await sendMessage({
        senderId: user._id,
        recipientId: vehicle.userId,
        vehicleId: vehicle._id,
        content,
      });
      setSent(true);
    } catch {
      setError("Your message couldn’t be sent. Please try again.");
    } finally {
      sendInProgress.current = false;
      setSending(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          className="relative z-20 w-full hover:translate-y-0"
          disabled={ownsVehicle}
          title={ownsVehicle ? "This is your listing" : undefined}
        >
          Check availability
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[hsl(var(--midnight)/0.75)] backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[calc(100dvh-2rem)] max-w-lg -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl sm:p-8"
          onEscapeKeyDown={(event) => { if (sendInProgress.current) event.preventDefault(); }}
          onInteractOutside={(event) => { if (sendInProgress.current) event.preventDefault(); }}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">Contact the seller</p>
              <Dialog.Title className="text-xl font-semibold tracking-tight">Check availability</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                Ask about the {vehicleLabel}. Your message will appear in your conversation with the seller.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0" disabled={sending} aria-label="Close availability message">
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          {sent ? (
            <div className="space-y-5">
              <div role="status" className="rounded-lg border border-primary/25 bg-primary/5 p-4">
                <p className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4 text-primary" aria-hidden="true" />Message sent</p>
                <p className="mt-2 text-sm text-muted-foreground">Keep chatting with the seller in your messages.</p>
              </div>
              <Button asChild className="w-full">
                <Link href={`/myAccount/messages/${vehicle._id}/${vehicle.userId}`}>View conversation</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label htmlFor={messageId} className="mb-2 block text-sm font-semibold">Your message</label>
                <Textarea
                  id={messageId}
                  value={message}
                  onChange={(event) => { setMessage(event.target.value); setError(""); }}
                  maxLength={MAX_MESSAGE_LENGTH}
                  rows={5}
                  required
                  disabled={sending}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  className="min-h-36 resize-y"
                />
              </div>
              {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
              {isLoading ? (
                <Button type="button" className="w-full" disabled><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your account…</Button>
              ) : user ? (
                <Button type="submit" className="w-full" disabled={!validMessage || sending || ownsVehicle}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  {sending ? "Sending…" : "Send message"}
                </Button>
              ) : isAuthenticated ? (
                <p role="status" className="text-sm text-muted-foreground">Your account isn’t available yet. Refresh the page to try again.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Sign in to send your message to the seller.</p>
                  <Button asChild className="w-full"><Link href="/sign-in">Sign in to send</Link></Button>
                </>
              )}
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
