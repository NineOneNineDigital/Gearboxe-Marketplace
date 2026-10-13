"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { QRDisplay } from "@/components/ui/qr-display";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

export default function RegistrationsPage() {
  return <Suspense fallback={<p className="p-8">Loading registrations…</p>}><RegistrationsContent /></Suspense>;
}

function receiptLink(value: string | undefined) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" && ["pay.stripe.com", "receipts.stripe.com"].includes(url.hostname) ? url.href : null; } catch { return null; }
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
    setBusy(key); setError(""); setNotice("");
    try { await operation(); setNotice(success); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update registration."); } finally { setBusy(""); }
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

  return <div className="market-page flex min-h-screen flex-col"><Navbar /><main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-12"><h1 className="text-3xl font-bold">Event registrations</h1>
    <p className="text-muted-foreground">Your confirmed registrations, checkout reservations, and payment receipts.</p>
    {search.get("payment") === "success" && <div className="rounded-lg border bg-white p-4"><p>Checkout returned successfully. Your place is confirmed when payment verification below shows a completed registration.</p>{returnReservation && <Button variant="outline" className="mt-3" disabled={!!busy} onClick={() => perform(returnReservation, () => refresh({ reservationId: returnReservation as Id<"eventReservations"> }), "Payment status refreshed. Check your registration below.")}>Refresh payment status</Button>}</div>}
    {search.get("payment") === "cancelled" && <p className="rounded-lg border bg-white p-4">Checkout was interrupted. You can continue your reservation or cancel it below. Unpaid reservations expire automatically.</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status">{notice}</p>}
    {isLoading ? <p role="status">Loading your account…</p> : !isAuthenticated ? <Button asChild><Link href="/sign-in?redirect_url=%2FmyAccount%2Fregistrations">Sign in to view registrations</Link></Button> : mine === undefined ? <p role="status">Loading registrations…</p> : <>
      <h2 className="text-xl font-semibold">Registrations</h2>
      {mine.registrations.length === 0 && <p>No confirmed registrations yet. <Link className="text-primary underline" href="/events">Browse upcoming events</Link></p>}
      {mine.registrations.map((registration) => {
        const receipt = receiptLink(registration.receiptUrl);
        return <Card key={registration._id}><CardContent className="space-y-3 p-6"><h3 className="text-lg font-semibold">{registration.event?.name ?? "Event"}</h3><p>{registration.vehicle?.year} {registration.vehicle?.make} {registration.vehicle?.model}</p>{registration.event && <p className="text-sm text-muted-foreground">{new Date(registration.event.date).toLocaleString()} · {registration.event.location}</p>}
          {registration.event?.vendorInstructions && <div><h4 className="font-semibold">Vendor instructions</h4><p className="whitespace-pre-wrap">{registration.event.vendorInstructions}</p></div>}
          {registration.event?.onSiteContact && <p>On-site contact: {registration.event.onSiteContact.name} · {registration.event.onSiteContact.phone}{registration.event.onSiteContact.email && ` · ${registration.event.onSiteContact.email}`}</p>}
          <p className="font-medium">{registration.paymentStatus === "completed" ? (registration.event?.cancelledAt ? "Event cancelled — refund processing will begin shortly" : "Registration confirmed — payment received") : registration.paymentStatus === "refund_pending" ? "Registration cancelled — refund pending" : registration.paymentStatus === "refunded" ? "Registration cancelled — refund confirmed" : `Payment status: ${registration.paymentStatus}`}</p>
          <p className="break-all text-xs text-muted-foreground">Registration: {registration._id}<br />Payment: {registration.stripePaymentId}{registration.stripeRefundId && <><br />Refund: {registration.stripeRefundId}</>}</p>
          {receipt && <a href={receipt} target="_blank" rel="noopener noreferrer" className="inline-block text-primary underline">View payment receipt</a>}
          {registration.paymentStatus === "completed" && !registration.event?.cancelledAt && registration.qrCodeData && <><p className="text-sm">{registration.checkedIn ? "Checked in" : "Show this code at event check-in."}</p><QRDisplay qrCodeData={registration.qrCodeData} title="Registration confirmation" /></>}
          {registration.canRefund && !registration.event?.cancelledAt ? <Button variant="outline" disabled={!!busy} onClick={() => { if (window.confirm("Cancel this registration and request a refund? Your registration will be cancelled immediately; the refund is confirmed after Stripe processes it.")) perform(registration._id, () => requestRefund({ registrationId: registration._id }), "Registration cancelled. Your refund is being processed."); }}>{busy === registration._id ? "Requesting refund…" : "Cancel registration and request refund"}</Button> : registration.paymentStatus === "completed" && !registration.event?.cancelledAt && <p className="text-sm text-muted-foreground">Self-service refunds are available at least seven calendar days before the event. <Link href="/contact" className="underline">Contact support</Link> for assistance.</p>}
        </CardContent></Card>;
      })}
      <h2 className="text-xl font-semibold">Payments and automatic refunds</h2>
      <p className="text-sm text-muted-foreground">Extra payments do not create extra registrations. Duplicate or invalid payments are refunded automatically; pending refunds become confirmed once Stripe completes them.</p>
      {mine.payments.length === 0 ? <p>No payment records yet.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50"><tr><th className="p-3">Payment</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Receipt / refund</th></tr></thead><tbody>{mine.payments.map((payment) => {
        const receipt = receiptLink(payment.receiptUrl);
        return <tr key={payment._id} className="border-b last:border-0"><td className="break-all p-3 font-mono text-xs">{payment.stripePaymentId}</td><td className="p-3">{new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency }).format(payment.amount / 100)}</td><td className="p-3">{payment.status === "paid" ? "Payment received" : payment.status === "refunded" ? "Refund confirmed" : payment.status === "refund_failed" ? "Refund delayed — contact support" : "Refund pending"}{payment.refundReason && <p className="text-xs text-muted-foreground">{payment.refundReason.replaceAll("_", " ")}</p>}</td><td className="break-all p-3">{receipt && <a href={receipt} target="_blank" rel="noopener noreferrer" className="text-primary underline">View receipt</a>}{payment.stripeRefundId && <p className="mt-2 font-mono text-xs">{payment.stripeRefundId}</p>}</td></tr>;
      })}</tbody></table></div>}
      <h2 className="text-xl font-semibold">Checkout reservations</h2>
      {mine.reservations.length === 0 && <p className="text-muted-foreground">No checkout reservations.</p>}
      {mine.reservations.map((reservation) => <Card key={reservation._id}><CardContent className="space-y-3 p-6"><p className="font-medium">Reservation status: {reservation.status.replaceAll("_", " ")}</p><p className="text-sm">Checkout deadline: {new Date(reservation.expiresAt).toLocaleString()}</p>{reservation.lastError && <p role="alert" className="text-sm text-red-700">{reservation.lastError}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!!busy} onClick={() => perform(reservation._id, () => refresh({ reservationId: reservation._id }), "Payment status refreshed.")}>Refresh status</Button>{["held"].includes(reservation.status) && <><Button asChild><Link href={`/events/${reservation.eventId}/register?vehicleId=${reservation.vehicleId}`}>Continue checkout</Link></Button><Button variant="outline" disabled={!!busy} onClick={() => perform(reservation._id, () => cancel({ reservationId: reservation._id }), "Checkout reservation cancelled or reconciled. Check its status above.")}>Cancel checkout</Button></>}{["expired", "cancelled", "failed"].includes(reservation.status) && <Button asChild variant="outline"><Link href={`/events/${reservation.eventId}/register?vehicleId=${reservation.vehicleId}`}>Try registering again</Link></Button>}</div></CardContent></Card>)}
    </>}
  </main><Footer /></div>;
}
