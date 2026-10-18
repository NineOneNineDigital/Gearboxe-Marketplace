# Popup-market operations

## Event setup and seller registration

Administrators configure the event fee, IANA time zone, registration deadline,
rules, vendor instructions and on-site contact in `/admin/events`. The deadline
defaults to the event start. New reservations and waitlist promotions stop at
the deadline; an existing hold can still finish payment before its expiry,
provided the event has not started or been cancelled. Fees and accepted rules
are snapshotted on the reservation. Sellers explicitly accept the rules before
Checkout. Occupied events cannot change their rules, date, venue or time zone;
cancel and refund before replacing those commitments.

Rules and vendor instructions are public event content. Do not put private
access codes or personal information in those fields. On-site contacts default
to visibility for paid vendors, assigned staff and administrators. Explicitly
select public visibility only for a contact intended for publication. Refunded
vendors lose access to the private contact. Public event responses do not expose
private cancellation reasons or registration credentials.

When an event is full, sellers can join its FIFO waitlist with an approved vehicle
they own. A seller may have five active waitlist entries and five active checkout
holds. Opening capacity reserves a place for the next eligible seller and sends
an in-app/Autosend invitation linking to that vehicle. It does not charge them.
An invitation lasts 35 minutes; its first claim grants one fresh 35-minute payment
window. Expired, untouched invitations release locally and advance the queue.
Claimed or attempted checkouts require Stripe reconciliation before release.
Suspension, vehicle ownership and eligibility are checked again at promotion
and payment. Offers preserve their fee and rules.

## Staff desk and admission

Gearboxe administrators assign Events Admin (`manager`) or Events Staff (`checkin`)
to individual events in the event editor or the portal's Users & roles page.
The Users & roles page displays each account's event assignments separately from
its global `user`, `admin`, or `superAdmin` role. Staff use the unified administration
portal at `/staff/events`; they do not need global admin access.
Every backend operation derives the current account and verifies its event
assignment. Managers can manage incidents, undo admission, export rosters and
request refunds. Global administrators retain access to all events and the Market
section. Events Admins can add or remove Events Staff for their assigned events
by exact account email. Only Gearboxe administrators can assign or remove Events
Admins, create events, or change event settings.

Scan a seller's QR or use seller/vehicle search and manual registration lookup.
Search covers the event's indexed roster, not just the currently loaded page.
A scan is a lookup: staff must confirm admission after backend validation.
Only a paid registration for the selected, uncancelled event can be admitted.
Repeated requests with the same request ID have one effect. Concurrent requests
and stale revisions cannot overwrite an undo; undo requires a manager's reason
and creates an audit entry. A replay returns current admission state, so a
subsequent refund, undo or event cancellation cannot produce a false success.

The desk shows confirmed registrations, held places, waitlisted sellers,
attendance and available capacity. Attendance records physical check-ins and
remains counted after a refund until explicitly undone; it can therefore exceed
the current confirmed count. Paid occupancy and active holds determine capacity.

## Weak connectivity

The desk monitors the Convex connection. Pending admission intents retain their
request ID and registration revision in session storage, scoped to the current
staff account and event. The queue contains identifiers only, expires after
15 minutes and is limited to 40 entries. Logout and event changes clear it.
Retries recheck authorization and reject an account change, refund or stale
revision. An entry is never displayed as admitted until the backend confirms it.

An unvalidated QR stays in memory only. After reconnecting, staff explicitly
revalidate it and confirm admission. There is no offline admission authority.
For a prolonged outage, contact the on-site manager and restore connectivity;
do not use cached rosters as proof of payment or manually alter inventory.

## Incidents, refunds and exports

Staff can record an incident against the event or a registration, with a reason,
notes and severity. Managers can escalate or resolve incidents with an audited
reason. For immediate physical danger, contact local emergency services and the
on-site lead first; the incident record is an operational record, not emergency
dispatch. Keep notes factual and omit ownership documents and unnecessary
personal information.

An assigned manager may request a full refund exception with a reason, including
after the ordinary seller cancellation cutoff. The existing durable Stripe
refund worker handles it; refund-pending registrations cannot check in, and their
capacity remains occupied until provider success. Failed payments, refunds and
webhooks remain visible to global administrators at `/admin/payments`. Managers
should escalate failures to that operator rather than promising a completed
refund. Follow [Event payments](EVENT_PAYMENTS.md) for reconciliation and retries.

Manager CSV exports are paginated and audited. They contain roster display names,
vehicle labels, registration IDs, payment status and attendance, excluding VINs,
phones, emails, QR credentials and payment references. Formula-leading cells are
escaped. Handle exports privately and delete local copies after event operations.
Search index text contains seller names and vehicle labels only and is staff-only.
Registration, incident, waitlist, deduplication and append-only application audit
records have no automatic expiry in this release. Do not manually delete request
deduplication records: old retries could otherwise repeat an operation. See
[Trust and safety](TRUST_SAFETY.md) for other sensitive-data rules.

## Existing-event rollout and verification

Deploy schema/indexes, backend and frontend together. For existing events, finish
the inventory initialization described in the payment runbook. To index legacy
roster rows, run the internal `eventOperations.backfillRosterSearch` with
`{eventId, cursor: null}` on the explicitly selected deployment; it schedules
bounded continuation pages. New registrations populate search automatically.
For initialized inventories missing attendance, small events can initialize
transactionally; larger events need internal
`eventOperations.startAttendanceBackfill({eventId})`. It temporarily pauses
check-in and undo while counting bounded pages, without replacing capacity
counts. Run migrations before opening the staff desk and confirm complete metrics.

Automated tests cover event assignment boundaries, QR and manual lookup,
idempotent admission, undo and stale replay, incident/refund authorization,
sanitized exports, private contacts, deadlines, offer expiry and inventory races.
Before launch, exercise camera scanning on staff devices; assigned-event denial;
last-place payment and waitlist races; reconnect during admission; logout during
a queued request; undo before retry; expired invitations; and failed/pending
refunds in staging. Local mocks and builds do not establish live provider or
device connectivity behavior.
