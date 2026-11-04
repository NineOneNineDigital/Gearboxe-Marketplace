"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, use, useState } from "react";

export default function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense fallback={<p className="p-8">Loading registration…</p>}><RegistrationForm eventId={id as Id<"events">} /></Suspense>;
}

function RegistrationForm({ eventId }: { eventId: Id<"events"> }) {
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const search = useSearchParams();
  const [selected, setSelected] = useState(search.get("vehicleId") ?? "");
  const [busy, setBusy] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState<string | null>(null);
  const [error, setError] = useState("");
  const offer = useQuery(api.eventBookings.getOffer, user ? { eventId } : "skip");
  const joinWaitlist = useMutation(api.eventWaitlist.join);
  const leaveWaitlist = useMutation(api.eventWaitlist.leave);
  const waitlistEntry = offer?.waitlist.find(row => row.vehicleId === selected && ["waiting", "offered"].includes(row.status));
  const registeredIds = new Set(offer?.registrations.filter((registration) => ["completed", "refund_pending"].includes(registration.paymentStatus)).map((registration) => registration.vehicleId));
  const eligible = offer?.vehicles.find((vehicle) => vehicle._id === selected && !registeredIds.has(vehicle._id));

  const held = offer?.reservations.find(reservation => reservation.vehicleId === selected && reservation.status === "held");
  const checkoutRules = held?.rulesSnapshot ?? offer?.event?.eventRules;
  const acceptRules = !!checkoutRules && acceptedRules === checkoutRules;
  const displayedAmount = held?.amount ?? offer?.amount;

  async function checkout() {
    if (!eligible || busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/create-checkout-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, vehicleId: eligible._id, acceptRules }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Checkout is unavailable. Please try again.");
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("Checkout returned an invalid payment link.");
      window.location.assign(url.href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start checkout.");
      setBusy(false);
    }
  }

  return <div className="market-page flex min-h-screen flex-col"><Navbar /><main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-12">
    <Link href={`/events/${eventId}`} className="text-sm text-primary">Back to event</Link>
    <h1 className="text-3xl font-bold">Register this vehicle</h1>
    {isLoading ? <p role="status">Loading your account…</p> : !isAuthenticated ? <Button asChild><Link href={`/sign-in?redirect_url=${encodeURIComponent(`/events/${eventId}/register${selected ? `?vehicleId=${selected}` : ""}`)}`}>Sign in to register</Link></Button> : !user ? <p>Finish setting up your account before registering.</p> : offer === undefined ? <p role="status">Loading available registrations…</p> : !offer.event ? <p role="alert">Event not found.</p> : <Card><CardHeader><CardTitle>{offer.event.name}</CardTitle></CardHeader><CardContent className="space-y-5">
      <p>{new Date(offer.event.date).toLocaleString("en-US", {timeZone: offer.event.timeZone ?? "America/New_York", timeZoneName: "short"})} · {offer.event.location}</p>
      <p className="text-2xl font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: offer.currency }).format((displayedAmount ?? offer.amount) / 100)} <span className="text-sm font-normal text-muted-foreground">per vehicle</span></p>
      <p className="text-sm text-muted-foreground">The registration fee is set by Gearboxe. A place is reserved when checkout starts. Your place is held for {Math.round(offer.reservationDurationMs / 60_000)} minutes. Complete payment within the checkout deadline; abandoned or expired reservations are released automatically.</p>
      <p>{offer.available} places available · {offer.waiting} vehicles waiting</p>
      {offer.waiting > 0 && !held && <p>Available places are offered to waiting vehicles in order. Join the waitlist to receive an invitation.</p>}
      {offer.event.registrationDeadline && <p>Registration deadline: {new Date(offer.event.registrationDeadline).toLocaleString("en-US", {timeZone: offer.event.timeZone ?? "America/New_York", timeZoneName: "short"})}</p>}
      {!offer.registrationOpen && <p role="status">New registrations and waitlist entries are closed. Existing checkout holds can still be completed before their expiry.</p>}
      {checkoutRules && <div><h3 className="font-semibold">Event rules</h3><p className="whitespace-pre-wrap">{checkoutRules}</p><label className="mt-3 block"><input type="checkbox" checked={acceptRules} onChange={e => setAcceptedRules(e.target.checked ? checkoutRules : null)} /> I agree to these event rules.</label></div>}
      {waitlistEntry && ["waiting", "offered"].includes(waitlistEntry.status) && <div className="rounded border p-3"><p>{waitlistEntry.status === "waiting" ? "You are on the waitlist. We will notify you when checkout is available." : "A place is offered to you. Leaving releases it after any active checkout is safely cancelled."}</p><Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await leaveWaitlist({ waitlistId: waitlistEntry._id }); } catch (error) { setError(error instanceof Error ? error.message : "Unable to leave waitlist."); } finally { setBusy(false); } }}>Leave waitlist</Button></div>}
      {waitlistEntry?.status === "offered" && <p role="status">A place is reserved for you. Complete checkout before the reservation expires.{held && ` Current reservation expires ${new Date(held.expiresAt).toLocaleString()}.`}</p>}
      {offer.event.cancelledAt && <p role="alert">This event has been cancelled. Registration is closed.</p>}
      {offer.vehicles.length === 0 ? <p>You need an approved vehicle listing to register. <Link className="text-primary underline" href="/myAccount/my-listings">Manage your listings</Link></p> : <div className="space-y-2"><label htmlFor="registration-vehicle" className="block font-medium">Choose your approved vehicle</label><select id="registration-vehicle" className="w-full rounded-md border bg-white p-3" value={eligible ? selected : ""} onChange={(event) => { setSelected(event.target.value); setAcceptedRules(null); }}><option value="">Select a vehicle</option>{offer.vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id} disabled={registeredIds.has(vehicle._id)}>{vehicle.year} {vehicle.make} {vehicle.model} — {vehicle.title}{registeredIds.has(vehicle._id) ? " (already registered)" : ""}</option>)}</select></div>}
      <p className="text-sm text-muted-foreground">Cancel at least seven calendar days before the event for a refund. Reopening checkout resumes an existing reservation when possible. Any extra paid checkout is refunded automatically.</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <Button disabled={!eligible || busy || (!!checkoutRules && !acceptRules) || offer.event.date <= Date.now() || !!offer.event.cancelledAt || (!offer.registrationOpen && !held) || ((offer.available <= 0 || offer.waiting > 0) && !held)} onClick={checkout}>{busy ? "Opening secure checkout…" : "Reserve a place and pay"}</Button>
      {eligible && offer.registrationOpen && (offer.available <= 0 || offer.waiting > 0) && !held && !waitlistEntry && <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await joinWaitlist({ eventId, vehicleId: eligible._id }); } catch (error) { setError(error instanceof Error ? error.message : "Unable to join waitlist."); } finally { setBusy(false); } }}>Join waitlist</Button>}
      <p className="text-sm"><Link href="/myAccount/registrations" className="text-primary underline">View registrations, payment status, and receipts</Link></p>
    </CardContent></Card>}
  </main><Footer /></div>;
}
