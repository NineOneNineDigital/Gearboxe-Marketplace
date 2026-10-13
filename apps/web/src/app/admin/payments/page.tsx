"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

export default function PaymentOperationsPage() {
  const isAdmin = useQuery(api.users.isAdmin);
  const payments = useQuery(api.eventBookings.paymentOperations, isAdmin ? {} : "skip");
  const webhooks = useQuery(api.paymentWebhookRecords.getFailures, isAdmin ? {} : "skip");
  const retryRefund = useMutation(api.eventBookings.retryRefund);
  const retryWebhook = useMutation(api.paymentWebhookRecords.retry);
  const retryLegacyMigration = useMutation(api.eventBookings.retryLegacyMigration);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function retryPayment(id: Id<"eventPayments">) {
    const reason = window.prompt("Reason for retrying this failed refund:");
    if (!reason?.trim()) return;
    setBusy(id); setError(""); setNotice("");
    try { await retryRefund({ paymentRecordId: id, reason: reason.trim() }); setNotice("Refund retry queued."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to retry refund."); } finally { setBusy(""); }
  }
  async function retryLegacy(registrationId: Id<"registrations">) {
    const reason = window.prompt("Reason for retrying this legacy payment migration:");
    if (!reason?.trim()) return;
    setBusy(registrationId); setError(""); setNotice("");
    try { await retryLegacyMigration({ registrationId, reason: reason.trim() }); setNotice("Legacy payment migration retry queued."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to retry legacy payment migration."); } finally { setBusy(""); }
  }
  async function retryDelivery(eventId: string) {
    setBusy(eventId); setError(""); setNotice("");
    try { await retryWebhook({ eventId }); setNotice("Webhook retry queued."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to retry webhook."); } finally { setBusy(""); }
  }

  if (isAdmin === undefined) return <p role="status" className="p-8">Checking access…</p>;
  if (!isAdmin) return <p role="alert" className="p-8">Admin access required.</p>;
  const refunds = payments ? [...payments.failedRefunds, ...payments.pendingRefunds, ...payments.processingRefunds] : undefined;
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6"><h1 className="text-3xl font-bold">Payment operations</h1><p className="text-sm text-muted-foreground">Monitor payment webhook processing and automatic refunds. Retries preserve the original payment and refund references.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status">{notice}</p>}
    <h2 className="text-xl font-semibold">Refunds requiring processing</h2>
    {refunds === undefined ? <p role="status">Loading refunds…</p> : refunds.length === 0 ? <p>No outstanding refunds.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50"><tr><th className="p-3">Payment / refund</th><th className="p-3">Status / reason</th><th className="p-3">Amount</th><th className="p-3">Attempts / next retry</th><th className="p-3">Last result</th><th className="p-3">Action</th></tr></thead><tbody>{refunds.map((payment) => <tr key={payment._id} className="border-b last:border-0"><td className="break-all p-3 font-mono text-xs">{payment.stripePaymentId}<br />{payment.stripeRefundId ?? "No refund reference yet"}</td><td className="p-3">{payment.status}<br />{payment.refundStatus}<br />{payment.refundReason}</td><td className="p-3">{new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency }).format((payment.refundAmount ?? payment.amount) / 100)}</td><td className="p-3">{payment.attempts} attempts<br />{new Date(payment.nextAttemptAt).toLocaleString()}</td><td className="max-w-sm break-words p-3">{payment.lastError ?? "—"}</td><td className="p-3">{payment.status === "refund_failed" && <Button variant="outline" size="sm" disabled={!!busy} onClick={() => retryPayment(payment._id)}>Retry refund</Button>}</td></tr>)}</tbody></table></div>}
    <h2 className="text-xl font-semibold">Payments requiring reconciliation</h2>
    <p className="text-sm text-muted-foreground">Review failed external or partial refunds against Stripe before changing admission or initiating another refund.</p>
    {!payments ? <p role="status">Loading payment reconciliation…</p> : payments.paidReconciliationFailures.length === 0 ? <p>No paid payments requiring reconciliation.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50"><tr><th className="p-3">Payment / registration</th><th className="p-3">Status</th><th className="p-3">Last result</th><th className="p-3">Updated</th></tr></thead><tbody>{payments.paidReconciliationFailures.map((payment) => <tr key={payment._id} className="border-b last:border-0"><td className="break-all p-3 font-mono text-xs">{payment.stripePaymentId}<br />{payment.registrationId ?? "No registration"}</td><td className="p-3">{payment.status}</td><td className="max-w-sm break-words p-3">{payment.lastError}</td><td className="p-3">{new Date(payment.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
    <h2 className="text-xl font-semibold">Reserved places requiring reconciliation</h2>
    <p className="text-sm text-muted-foreground">These places remain reserved until Stripe confirms their payment or expiry. Background processing retries automatically.</p>
    {!payments ? <p role="status">Loading reservation reconciliation…</p> : payments.heldReconciliationFailures.length === 0 ? <p>No reserved places requiring reconciliation.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50"><tr><th className="p-3">Reservation / checkout</th><th className="p-3">Event / vehicle</th><th className="p-3">Deadline</th><th className="p-3">Last result</th></tr></thead><tbody>{payments.heldReconciliationFailures.map((reservation) => <tr key={reservation._id} className="border-b last:border-0"><td className="break-all p-3 font-mono text-xs">{reservation._id}<br />{reservation.stripeSessionId ?? "Checkout not yet bound"}</td><td className="break-all p-3 font-mono text-xs">{reservation.eventId}<br />{reservation.vehicleId}</td><td className="p-3">{new Date(reservation.expiresAt).toLocaleString()}</td><td className="max-w-sm break-words p-3">{reservation.lastError}</td></tr>)}</tbody></table></div>}
    <h2 className="text-xl font-semibold">Legacy payment migration failures</h2>
    <p className="text-sm text-muted-foreground">Older registrations need their original Stripe payment linked before an automatic refund can be processed. Review the original checkout and registration before retrying.</p>
    {!payments ? <p role="status">Loading legacy migration failures…</p> : payments.legacyMigrationFailures.length === 0 ? <p>No legacy migration failures.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50"><tr><th className="p-3">Registration / checkout</th><th className="p-3">Event / vehicle</th><th className="p-3">Payment status</th><th className="p-3">Attempts / next retry</th><th className="p-3">Last result</th><th className="p-3">Action</th></tr></thead><tbody>{payments.legacyMigrationFailures.map((registration) => <tr key={registration._id} className="border-b last:border-0"><td className="break-all p-3 font-mono text-xs">{registration._id}<br />{registration.stripePaymentId ?? "No payment reference"}</td><td className="break-all p-3 font-mono text-xs">{registration.eventId}<br />{registration.vehicleId}</td><td className="p-3">{registration.paymentStatus}</td><td className="p-3">{registration.legacyMigrationAttempts ?? 0} attempts<br />{registration.legacyMigrationNextAttemptAt ? new Date(registration.legacyMigrationNextAttemptAt).toLocaleString() : "—"}</td><td className="max-w-sm break-words p-3">{registration.legacyMigrationError ?? "—"}</td><td className="p-3"><Button variant="outline" size="sm" disabled={!!busy} onClick={() => retryLegacy(registration._id)}>Retry migration</Button></td></tr>)}</tbody></table></div>}
    <h2 className="text-xl font-semibold">Payment webhook deliveries</h2>
    {webhooks === undefined ? <p role="status">Loading webhook deliveries…</p> : webhooks.length === 0 ? <p>No pending or failed webhook deliveries.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50"><tr><th className="p-3">Stripe event</th><th className="p-3">Status</th><th className="p-3">Attempts / next retry</th><th className="p-3">Updated</th><th className="p-3">Last result</th><th className="p-3">Action</th></tr></thead><tbody>{webhooks.map((delivery) => <tr key={delivery._id} className="border-b last:border-0"><td className="break-all p-3 text-xs">{delivery.eventId}<br />{delivery.type}<br />{delivery.objectId}</td><td className="p-3">{delivery.status}</td><td className="p-3">{delivery.attempts} attempts<br />{new Date(delivery.nextAttemptAt).toLocaleString()}</td><td className="p-3">{new Date(delivery.updatedAt).toLocaleString()}</td><td className="max-w-sm break-words p-3">{delivery.lastError ?? "—"}</td><td className="p-3">{delivery.status === "failed" && <Button variant="outline" size="sm" disabled={!!busy} onClick={() => retryDelivery(delivery.eventId)}>Retry webhook</Button>}</td></tr>)}</tbody></table></div>}
  </main>;
}
