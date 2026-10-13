"use client";
import { useEffect, useRef, useState } from "react";
import { useConvex, useConvexConnectionState, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "./button";
import { QRScannerComponent } from "./qr-scanner";
import { csvCell, isNetworkFailure, MAX_PENDING_CHECK_INS, PENDING_CHECK_IN_TTL, readPendingCheckIns, type PendingCheckIn } from "@/lib/event-operations-client";
import Link from "next/link";
type Row = { registrationId: Id<"registrations">; sellerName: string; vehicleLabel: string; paymentStatus: string; checkedIn: boolean; revision: number };
export function EventOperationsWorkspace() {
  const { user, isLoading } = useCurrentUser();
  const events = useQuery(api.eventOperations.assignedEvents, user ? {} : "skip");
  const [eventId, setEventId] = useState<Id<"events"> | null>(null);
  const event = events?.find(row => row._id === eventId);
  return <main className="mx-auto max-w-6xl space-y-6 p-6"><h1 className="text-3xl font-bold">Popup market operations</h1><p>Only assigned events are available. Admission requires backend confirmation.</p>{isLoading ? <p>Loading account…</p> : !user ? <Link className="underline" href="/sign-in?redirect_url=%2Fstaff%2Fevents">Sign in to work an event</Link> : events === undefined ? <p>Loading assignments…</p> : <><label className="block">Assigned event<select className="ml-3 rounded border bg-white p-2" value={eventId ?? ""} onChange={e => setEventId(e.target.value as Id<"events"> || null)}><option value="">Select an event</option>{events.map(row => <option key={row._id} value={row._id}>{row.name} — {row.staffRole}</option>)}</select></label>{events.length === 0 && <p>No events are assigned to your account.</p>}{event && <EventDesk key={`${user._id}:${event._id}`} eventId={event._id} actorId={user._id} manager={event.staffRole === "manager"} contact={event.onSiteContact} />}</>}</main>;
}
function EventDesk({ eventId, actorId, manager, contact }: { eventId: Id<"events">; actorId: string; manager: boolean; contact?: { name: string; phone: string; email?: string } }) {
  const convex = useConvex();
  const connection = useConvexConnectionState();
  const checkIn = useMutation(api.eventOperations.checkInRegistration);
  const undo = useMutation(api.eventOperations.undoCheckIn);
  const refund = useMutation(api.eventOperations.requestRefund);
  const exportRoster = useMutation(api.eventOperations.exportRoster);
  const incident = useMutation(api.eventOperations.recordIncident);
  const resolve = useMutation(api.eventOperations.resolveIncident);
  const metrics = useQuery(api.eventOperations.getMetrics, { eventId });
  const [search, setSearch] = useState("");
  const roster = usePaginatedQuery(api.eventOperations.getRoster, { eventId, search }, { initialNumItems: 50 });
  const incidents = usePaginatedQuery(api.eventOperations.listIncidents, manager ? { eventId } : "skip", { initialNumItems: 25 });
  const [lookupId, setLookupId] = useState("");
  const [candidate, setCandidate] = useState<Row | null>(null);
  const [pending, setPending] = useState<PendingCheckIn[]>([]);
  const pendingRef = useRef<PendingCheckIn[]>([]);
  const qrPending = useRef<{ value: string; at: number } | null>(null);
  const [qrWaiting, setQrWaiting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const scope = `event-checkin:${actorId}:${eventId}`;
  useEffect(() => {
    active.current = true;
    try { const saved = readPendingCheckIns(sessionStorage.getItem(scope), eventId, Date.now()); pendingRef.current = saved; setPending(saved); } catch { /* Storage may be unavailable. */ }
    return () => { active.current = false; qrPending.current = null; try { sessionStorage.removeItem(scope); } catch { /* No persisted tokens. */ } };
  }, [scope, eventId]);
  function save(rows: PendingCheckIn[]) { pendingRef.current = rows; setPending(rows); try { sessionStorage.setItem(scope, JSON.stringify(rows)); } catch { /* Keep memory queue when storage is unavailable. */ } }
  async function perform(operation: () => Promise<unknown>, success: string) { setBusy(true); setError(""); try { await operation(); if (active.current && success) setNotice(success); } catch (caught) { if (active.current) setError(caught instanceof Error ? caught.message : "Operation failed."); } finally { if (active.current) setBusy(false); } }
  async function validate(qrCodeData?: string) {
    setBusy(true); setError(""); setNotice("Validating with the backend — do not admit yet."); setCandidate(null); qrPending.current = null; setQrWaiting(false);
    try {
      if (!connection.isWebSocketConnected) throw new Error("Backend connection offline");
      const row = await convex.query(api.eventOperations.lookup, { eventId, ...(qrCodeData ? { qrCodeData } : { registrationId: lookupId as Id<"registrations"> }) });
      if (!active.current) return;
      qrPending.current = null; setQrWaiting(false); setCandidate(row);
      setNotice(row ? "Backend validated this paid registration. Confirm admission below." : "No active paid registration matches this event. Do not admit.");
    } catch (caught) {
      if (!active.current) return;
      if (qrCodeData && isNetworkFailure(caught)) { qrPending.current = { value: qrCodeData, at: Date.now() }; setQrWaiting(true); }
      setError(isNetworkFailure(caught) ? "Validation is pending connectivity. Do not admit. Retry validation when connected, then confirm admission." : caught instanceof Error ? caught.message : "Validation failed.");
    } finally { if (active.current) setBusy(false); }
  }
  async function submit(intent: PendingCheckIn, allowQueue = true) {
    try {
      if (allowQueue && !pendingRef.current.some(row => row.requestId === intent.requestId)) {
        if (pendingRef.current.length >= MAX_PENDING_CHECK_INS) throw new Error("Pending queue is full. Resolve existing requests first.");
        save([...pendingRef.current, intent]);
      }
      if (!connection.isWebSocketConnected) throw new Error("Backend connection offline");
      const result = await checkIn({ eventId, expectedActorId: actorId as Id<"users">, registrationId: intent.registrationId as Id<"registrations">, requestId: intent.requestId, expectedRevision: intent.expectedRevision });
      if (!active.current) return;
      save(pendingRef.current.filter(row => row.requestId !== intent.requestId));
      setNotice(result.checkedIn ? "Backend confirmed check-in. This vendor may enter." : "Current backend state is not checked in. Do not admit; validate again."); setCandidate(null);
    } catch (caught) {
      if (!active.current) return;
      if (isNetworkFailure(caught) && allowQueue) {
        if (!pendingRef.current.some(row => row.requestId === intent.requestId)) {
          if (pendingRef.current.length >= MAX_PENDING_CHECK_INS) throw new Error("Pending queue is full. Resolve existing requests first.");
          save([...pendingRef.current, intent]);
        }
        setError("Check-in awaits backend confirmation. Do not admit. Retry pending requests when connected.");
      } else { save(pendingRef.current.filter(row => row.requestId !== intent.requestId)); throw caught; }
    }
  }
  function admit(row: Row) { void perform(() => submit({ eventId, registrationId: row.registrationId, requestId: crypto.randomUUID(), expectedRevision: row.revision, queuedAt: Date.now() }), ""); }
  async function retry() {
    for (const row of [...pendingRef.current]) { if (Date.now() - row.queuedAt > PENDING_CHECK_IN_TTL) { save(pendingRef.current.filter(item => item.requestId !== row.requestId)); continue; } await submit(row); }
  }
  async function download() {
    if (!connection.isWebSocketConnected) throw new Error("Connect to the backend before exporting the roster.");
    const rows: Row[] = []; let cursor: string | null = null;
    for (let page = 0; page < 1000; page++) { const result: {page: Row[]; isDone: boolean; continueCursor: string} = await exportRoster({ eventId, expectedActorId: actorId as Id<"users">, paginationOpts: { cursor, numItems: 100 } }); if (!active.current) return; rows.push(...result.page); if (result.isDone) { const csv = [['Registration ID','Seller name','Vehicle','Payment status','Checked in'], ...rows.map(row => [row.registrationId,row.sellerName,row.vehicleLabel,row.paymentStatus,row.checkedIn ? 'yes' : 'no'])].map(row => row.map(csvCell).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'})); const link = document.createElement('a'); link.href = url; link.download = `event-${eventId}-roster.csv`; link.click(); URL.revokeObjectURL(url); return; } cursor = result.continueCursor; } throw new Error('Export limit reached. Contact support.');
  }
  return <section className="space-y-6">
    {!connection.isWebSocketConnected && <p role="status" className="rounded border border-amber-500 p-3">Backend connection is unavailable. Check-ins remain pending. Do not admit until the backend confirms.</p>}
    {contact && <p>On-site contact: {contact.name} · {contact.phone}{contact.email && ` · ${contact.email}`}</p>}
    {metrics && <div className="rounded border bg-white p-4">Capacity {metrics.capacity} · Confirmed {metrics.confirmed} · Checkout holds {metrics.held} · Waitlisted {metrics.waiting} · Attended {metrics.attended} · Available {metrics.available}{!metrics.complete && <p>Metrics incomplete: administrator migration required.</p>}</div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status" className="rounded border p-3">{notice}</p>}
    {pending.length > 0 && <div className="rounded border border-amber-500 p-4"><p>{pending.length} requests pending backend confirmation — these vendors are not admitted.</p><Button disabled={busy} onClick={() => perform(retry, "Pending requests processed. Check the current roster before admission.")}>Retry pending requests</Button><Button variant="outline" disabled={busy} onClick={() => save([])}>Discard pending requests</Button></div>}
    <div className="grid gap-6 md:grid-cols-2"><QRScannerComponent onScan={value => { if (!busy && value.length <= 500) void validate(value); }} /><div className="space-y-3"><h2 className="text-xl font-semibold">Manual registration lookup</h2><label className="block">Registration ID<input className="block w-full rounded border p-2" value={lookupId} onChange={e => setLookupId(e.target.value)} /></label><Button disabled={busy || !lookupId.trim()} onClick={() => validate()}>Validate registration</Button>{qrWaiting && <Button variant="outline" disabled={busy} onClick={() => { const qr = qrPending.current; if (qr && Date.now() - qr.at < PENDING_CHECK_IN_TTL) void validate(qr.value); else { qrPending.current = null; setQrWaiting(false); setError("Captured code expired. Scan it again."); } }}>Retry captured code validation</Button>}{candidate && <div className="rounded border p-4"><p>{candidate.sellerName} · {candidate.vehicleLabel}</p><p>{candidate.checkedIn ? "Already checked in" : "Paid registration — awaiting admission"}</p>{!candidate.checkedIn && <Button disabled={busy} onClick={() => admit(candidate)}>Confirm admission</Button>}</div>}</div></div>
    <div className="space-y-3"><h2 className="text-xl font-semibold">Event roster</h2><label className="block">Search seller or vehicle<input className="ml-2 rounded border p-2" maxLength={200} value={search} onChange={e => setSearch(e.target.value)} /></label><p className="text-sm">Search covers the whole event. Use registration ID lookup above for a specific confirmation.</p>{manager && <Button disabled={busy || !connection.isWebSocketConnected} variant="outline" onClick={() => perform(download, "Roster exported. Handle vendor names privately.")}>Export roster CSV</Button>}{roster.results.map(row => <div key={row.registrationId} className="flex flex-wrap items-center gap-3 rounded border bg-white p-4"><div className="flex-1"><p>{row.sellerName} · {row.vehicleLabel}</p><p className="text-xs">{row.registrationId} · {row.paymentStatus} · {row.checkedIn ? 'Checked in' : 'Not checked in'}</p></div>{row.paymentStatus === 'completed' && !row.checkedIn && <Button disabled={busy} onClick={() => admit(row)}>Check in</Button>}{manager && row.checkedIn && <Button variant="outline" disabled={busy || !connection.isWebSocketConnected} onClick={() => { const reason = window.prompt('Reason for undoing check-in (recorded in audit log)'); if (reason?.trim()) void perform(() => undo({ eventId, expectedActorId: actorId as Id<"users">, registrationId: row.registrationId, expectedRevision: row.revision, reason }), 'Check-in undone.'); }}>Undo check-in</Button>}{manager && row.paymentStatus === 'completed' && <Button variant="outline" disabled={busy || !connection.isWebSocketConnected} onClick={() => { const reason = window.prompt('Refund reason (cancels registration and invalidates QR)'); if (reason?.trim() && window.confirm('Cancel registration and request a full refund?')) void perform(() => refund({ eventId, expectedActorId: actorId as Id<"users">, registrationId: row.registrationId, reason }), 'Registration cancelled; refund pending provider confirmation.'); }}>Incident refund</Button>}</div>)}{roster.status === 'CanLoadMore' && <Button variant="outline" onClick={() => roster.loadMore(50)}>Load more registrations</Button>}</div>
    <IncidentForm disabled={busy || !connection.isWebSocketConnected} onSubmit={(reason, notes, severity, escalate) => perform(() => incident({ eventId, expectedActorId: actorId as Id<"users">, reason, notes, severity, escalate }), 'Incident recorded. Escalated incidents require contacting the on-site manager.')} />
    {manager && <div className="space-y-3"><h2 className="text-xl font-semibold">Incidents</h2>{incidents.results.map(row => <div key={row._id} className="rounded border p-3"><p>{row.severity} · {row.status} · {row.reason}</p><p className="whitespace-pre-wrap">{row.notes}</p>{row.status !== 'resolved' && <Button variant="outline" disabled={busy || !connection.isWebSocketConnected} onClick={() => { const reason = window.prompt('Resolution reason'); if (reason?.trim()) void perform(() => resolve({ expectedActorId: actorId as Id<"users">, incidentId: row._id, reason }), 'Incident resolved with audit record.'); }}>Resolve</Button>}</div>)}{incidents.status === 'CanLoadMore' && <Button onClick={() => incidents.loadMore(25)}>Load more incidents</Button>}</div>}
  </section>;
}
function IncidentForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (reason: string, notes: string, severity: 'low'|'medium'|'high'|'critical', escalate: boolean) => Promise<void> }) {
  const [reason,setReason] = useState(''); const [notes,setNotes] = useState(''); const [severity,setSeverity] = useState<'low'|'medium'|'high'|'critical'>('low'); const [escalate,setEscalate] = useState(false);
  return <form className="space-y-3 rounded border bg-white p-4" onSubmit={e => { e.preventDefault(); if (!disabled) void onSubmit(reason, notes, severity, escalate); }}><h2 className="text-xl font-semibold">Record an incident</h2><label className="block">Reason<input required maxLength={500} className="ml-2 rounded border p-2" value={reason} onChange={e => setReason(e.target.value)} /></label><label className="block">Severity<select value={severity} className="ml-2 rounded border p-2" onChange={e => setSeverity(e.target.value as typeof severity)}>{['low','medium','high','critical'].map(value => <option key={value}>{value}</option>)}</select></label><label className="block">Notes<textarea required maxLength={5000} className="block w-full rounded border p-2" value={notes} onChange={e => setNotes(e.target.value)} /></label><label className="block"><input type="checkbox" checked={escalate} onChange={e => setEscalate(e.target.checked)} /> Escalate to event manager</label><p className="text-sm">For urgent danger, contact emergency services and the on-site manager. Recording an incident does not place an emergency call.</p><Button disabled={disabled}>Save incident</Button></form>;
}
