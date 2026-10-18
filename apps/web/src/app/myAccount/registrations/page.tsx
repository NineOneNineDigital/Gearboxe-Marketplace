"use client";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { QRDisplay } from "@/components/ui/qr-display";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowUpRight, CalendarDays, CreditCard, Ticket, Timer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

type StatusTone = "success" | "warning" | "neutral";

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const color = tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-black/10 bg-[hsl(var(--bone))] text-[hsl(var(--gunmetal))]";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

function receiptLink(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["pay.stripe.com", "receipts.stripe.com"].includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

function RegistrationStatus({ status, eventCancelled, checkedIn }: { status: string; eventCancelled: boolean; checkedIn: boolean }) {
  if (status === "completed" && eventCancelled) return <StatusPill label="Event cancelled · refund to follow" tone="warning" />;
  if (status === "completed") return <StatusPill label={checkedIn ? "Checked in" : "Confirmed · paid"} tone="success" />;
  if (status === "refund_pending") return <StatusPill label="Cancelled · refund pending" tone="warning" />;
  if (status === "refunded") return <StatusPill label="Cancelled · refunded" tone="neutral" />;
  return <StatusPill label={`Payment: ${status.replaceAll("_", " ")}`} tone="neutral" />;
}

function PaymentStatus({ status }: { status: string }) {
  if (status === "paid") return <StatusPill label="Payment received" tone="success" />;
  if (status === "refunded") return <StatusPill label="Refund confirmed" tone="neutral" />;
  if (status === "refund_failed") return <StatusPill label="Refund delayed · contact support" tone="warning" />;
  return <StatusPill label="Refund pending" tone="warning" />;
}

export default function RegistrationsPage() {
  return <Suspense fallback={<div className="market-page flex min-h-screen items-center justify-center" role="status">Loading registrations…</div>}><RegistrationsContent /></Suspense>;
}

function RegistrationsContent() {
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const search = useSearchParams();
  const mine = useQuery(api.eventBookings.getMine, user ? {} : "skip");
  const requestRefund = useMutation(api.eventBookings.requestRefund);
  const refresh = useAction(api.registrationPayments.refreshCheckout);
  const cancel = useAction(api.registrationPayments.cancelCheckout);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function perform(key: string, operation: () => Promise<unknown>, success: string) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await operation();
      setNotice(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update registration.");
    } finally {
      setBusy("");
    }
  }

  const returnReservation = search.get("reservationId");
  const refreshedReturn = useRef("");
  useEffect(() => {
    if (!user || !returnReservation || search.get("payment") !== "success" || refreshedReturn.current === returnReservation) return;
    refreshedReturn.current = returnReservation;
    let active = true;
    void refresh({ reservationId: returnReservation as Id<"eventReservations"> }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Payment verification is pending. Refresh its status below.");
    });
    return () => { active = false; };
  }, [refresh, returnReservation, search, user]);

  const confirmedCount = mine?.registrations.filter((registration) => registration.paymentStatus === "completed" && !registration.event?.cancelledAt).length ?? 0;
  const openCheckoutCount = mine?.reservations.filter((reservation) => reservation.status === "held").length ?? 0;

  return (
    <div className="market-page flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-[hsl(var(--bone))]">
        <section className="relative overflow-hidden bg-[hsl(var(--midnight))] text-[hsl(var(--bone))]">
          <div className="market-grid pointer-events-none absolute inset-0 opacity-20" />
          <div className="market-shell relative py-8 sm:py-10">
            <Link href="/myAccount" className="inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--chrome))] hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
            <p className="market-eyebrow mt-5 text-[hsl(var(--chrome))]">Your garage / Events</p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-4xl">Event registrations<span className="text-primary">.</span></h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--chrome))]">Your event places, checkout activity, and payment receipts.</p>
              </div>
              <Button asChild size="sm" className="text-white"><Link href="/events">Explore events <ArrowUpRight className="h-4 w-4" /></Link></Button>
            </div>
          </div>
          <div className="market-ruler relative opacity-60" />
        </section>

        <div className="market-shell space-y-10 py-10 sm:py-12">
          {search.get("payment") === "success" && <div role="status" className="rounded-xl border border-primary/25 bg-primary/5 p-5 text-sm leading-6"><p className="font-semibold">Checkout returned successfully</p><p className="mt-1 text-muted-foreground">Your place is confirmed when payment verification shows a completed registration below.</p>{returnReservation && <Button variant="outline" size="sm" className="mt-3" disabled={!!busy} onClick={() => perform(returnReservation, () => refresh({ reservationId: returnReservation as Id<"eventReservations"> }), "Payment status refreshed. Check your registration below.")}>Refresh payment status</Button>}</div>}
          {search.get("payment") === "cancelled" && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">Checkout was interrupted. You can continue or cancel the reservation below. Unpaid reservations expire automatically.</p>}
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">{notice}</p>}

          {isLoading ? <p role="status">Loading your account…</p> : !isAuthenticated ? (
            <div className="rounded-2xl border border-black/10 bg-white p-8"><p className="mb-5 text-sm text-muted-foreground">Sign in to see your registrations and receipts.</p><Button asChild><Link href="/sign-in?redirect_url=%2FmyAccount%2Fregistrations">Sign in</Link></Button></div>
          ) : mine === undefined ? <p role="status">Loading registrations…</p> : <>
            <div className="grid gap-3 sm:grid-cols-3" aria-label="Event account overview">
              <div className="flex items-center gap-4 rounded-xl border border-black/10 bg-white p-5"><Ticket className="h-6 w-6 text-primary" aria-hidden="true" /><div><p className="market-metric text-2xl font-semibold">{confirmedCount}</p><p className="text-xs text-muted-foreground">Confirmed places</p></div></div>
              <div className="flex items-center gap-4 rounded-xl border border-black/10 bg-white p-5"><Timer className="h-6 w-6 text-primary" aria-hidden="true" /><div><p className="market-metric text-2xl font-semibold">{openCheckoutCount}</p><p className="text-xs text-muted-foreground">Open checkouts</p></div></div>
              <div className="flex items-center gap-4 rounded-xl border border-black/10 bg-white p-5"><CreditCard className="h-6 w-6 text-primary" aria-hidden="true" /><div><p className="market-metric text-2xl font-semibold">{mine.payments.length}</p><p className="text-xs text-muted-foreground">Payment records</p></div></div>
            </div>

            <section aria-labelledby="registrations-heading" className="space-y-5">
              <div><p className="market-eyebrow">01 / Your places</p><h2 id="registrations-heading" className="mt-3 text-2xl font-semibold">Registrations</h2></div>
              {mine.registrations.length === 0 ? <div className="rounded-2xl border border-black/10 bg-white p-8"><CalendarDays className="h-7 w-7 text-primary" aria-hidden="true" /><p className="mt-4 font-semibold">No registrations yet</p><p className="mt-1 text-sm text-muted-foreground">Find an upcoming event and register an approved vehicle.</p><Button asChild variant="outline" className="mt-5"><Link href="/events">Browse events <ArrowUpRight className="h-4 w-4" /></Link></Button></div> : (
                <div className="space-y-4">{mine.registrations.map((registration) => {
                  const receipt = receiptLink(registration.receiptUrl);
                  const eventCancelled = !!registration.event?.cancelledAt;
                  const vehicle = registration.vehicle ? `${registration.vehicle.year} ${registration.vehicle.make} ${registration.vehicle.model}` : "Vehicle unavailable";
                  return <article key={registration._id} className="rounded-2xl border border-black/10 bg-white p-6 market-card-shadow sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Event place</p><h3 className="mt-2 text-xl font-semibold">{registration.event?.name ?? "Event"}</h3><p className="mt-1 text-sm text-muted-foreground">{vehicle}</p></div><RegistrationStatus status={registration.paymentStatus} eventCancelled={eventCancelled} checkedIn={!!registration.checkedIn} /></div>
                    {registration.event && <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-y border-black/10 py-4 text-sm"><p><span className="text-muted-foreground">When</span><br /><time dateTime={new Date(registration.event.date).toISOString()} className="font-medium">{new Date(registration.event.date).toLocaleString()}</time></p><p><span className="text-muted-foreground">Where</span><br /><span className="font-medium">{registration.event.location}</span></p></div>}
                    {registration.event?.vendorInstructions && <div className="mt-5 rounded-xl bg-[hsl(var(--bone))] p-4"><h4 className="text-sm font-semibold">Vendor instructions</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{registration.event.vendorInstructions}</p></div>}
                    {registration.event?.onSiteContact && <p className="mt-5 break-words text-sm"><span className="font-semibold">On-site contact:</span> {registration.event.onSiteContact.name} · {registration.event.onSiteContact.phone}{registration.event.onSiteContact.email && ` · ${registration.event.onSiteContact.email}`}</p>}
                    {registration.paymentStatus === "completed" && !eventCancelled && registration.qrCodeData && <div className="mt-6 border-t border-black/10 pt-6"><p className="mb-4 text-sm">{registration.checkedIn ? "Checked in at the event." : "Show this code at event check-in."}</p><QRDisplay qrCodeData={registration.qrCodeData} title="Registration confirmation" /></div>}
                    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/10 pt-5">
                      {receipt && <Button asChild variant="outline" size="sm"><a href={receipt} target="_blank" rel="noopener noreferrer">View payment receipt <ArrowUpRight className="h-4 w-4" /></a></Button>}
                      {registration.canRefund && !eventCancelled ? <Button variant="outline" size="sm" disabled={!!busy} onClick={() => { if (window.confirm("Cancel this registration and request a refund? Your registration will be cancelled immediately; the refund is confirmed after Stripe processes it.")) perform(registration._id, () => requestRefund({ registrationId: registration._id }), "Registration cancelled. Your refund is being processed."); }}>{busy === registration._id ? "Requesting refund…" : "Cancel and request refund"}</Button> : registration.paymentStatus === "completed" && !eventCancelled && <p className="text-xs leading-5 text-muted-foreground">Self-service refunds are available at least seven calendar days before the event. <Link href="/contact" className="text-primary underline">Contact support</Link> for assistance.</p>}
                    </div>
                    <details className="mt-5 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Registration references</summary><p className="mt-2 break-all">Registration: {registration._id}<br />Payment: {registration.stripePaymentId}{registration.stripeRefundId && <><br />Refund: {registration.stripeRefundId}</>}</p></details>
                  </article>;
                })}</div>
              )}
            </section>

            <section aria-labelledby="reservations-heading" className="space-y-5">
              <div><p className="market-eyebrow">02 / Checkout</p><h2 id="reservations-heading" className="mt-3 text-2xl font-semibold">Checkout reservations</h2></div>
              {mine.reservations.length === 0 ? <p className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-muted-foreground">No checkout reservations.</p> : <div className="grid gap-4 lg:grid-cols-2">{mine.reservations.map((reservation) => <article key={reservation._id} className="rounded-2xl border border-black/10 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{reservation.eventName || "Event checkout"}</h3><p className="mt-1 text-sm text-muted-foreground">{reservation.vehicleName || "Vehicle registration"}</p></div><StatusPill label={reservation.status.replaceAll("_", " ")} tone={reservation.status === "held" ? "warning" : reservation.status === "paid" ? "success" : "neutral"} /></div><p className="mt-5 text-sm"><span className="text-muted-foreground">Checkout deadline</span><br /><time dateTime={new Date(reservation.expiresAt).toISOString()} className="font-medium">{new Date(reservation.expiresAt).toLocaleString()}</time></p>{reservation.lastError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{reservation.lastError}</p>}<div className="mt-5 flex flex-wrap gap-2 border-t border-black/10 pt-5"><Button variant="outline" size="sm" disabled={!!busy} onClick={() => perform(reservation._id, () => refresh({ reservationId: reservation._id }), "Payment status refreshed.")}>{busy === reservation._id ? "Refreshing…" : "Refresh status"}</Button>{reservation.status === "held" && <><Button asChild size="sm"><Link href={`/events/${reservation.eventId}/register?vehicleId=${reservation.vehicleId}`}>Continue checkout</Link></Button><Button variant="outline" size="sm" disabled={!!busy} onClick={() => perform(reservation._id, () => cancel({ reservationId: reservation._id }), "Checkout reservation cancelled or reconciled. Check its status above.")}>Cancel checkout</Button></>}{["expired", "cancelled", "failed"].includes(reservation.status) && <Button asChild variant="outline" size="sm"><Link href={`/events/${reservation.eventId}/register?vehicleId=${reservation.vehicleId}`}>Try registering again</Link></Button>}</div></article>)}</div>}
            </section>

            <section aria-labelledby="payments-heading" className="space-y-5">
              <div><p className="market-eyebrow">03 / Payment history</p><h2 id="payments-heading" className="mt-3 text-2xl font-semibold">Payments and refunds</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Extra payments do not create extra registrations. Duplicate or invalid payments are refunded automatically; pending refunds are confirmed after Stripe processes them.</p></div>
              {mine.payments.length === 0 ? <p className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-muted-foreground">No payment records yet.</p> : <div className="grid gap-4 lg:grid-cols-2">{mine.payments.map((payment) => {
                const receipt = receiptLink(payment.receiptUrl);
                return <article key={payment._id} className="rounded-2xl border border-black/10 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Payment</p><h3 className="mt-2 text-xl font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency }).format(payment.amount / 100)}</h3></div><PaymentStatus status={payment.status} /></div>{payment.refundReason && <p className="mt-4 text-sm text-muted-foreground">Reason: {payment.refundReason.replaceAll("_", " ")}</p>}<div className="mt-5 border-t border-black/10 pt-4">{receipt && <a href={receipt} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View receipt <ArrowUpRight className="h-4 w-4" /></a>}<details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Payment references</summary><p className="mt-2 break-all">Payment: {payment.stripePaymentId}{payment.stripeRefundId && <><br />Refund: {payment.stripeRefundId}</>}</p></details></div></article>;
              })}</div>}
            </section>
          </>}
        </div>
      </main>
      <Footer />
    </div>
  );
}
