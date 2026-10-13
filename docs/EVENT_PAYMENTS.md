# Event registration and payments

## Seller flow

An event's **Register this vehicle** link opens `/events/<id>/register`. Sellers
select one of their approved/active listings. My Listings also offers event
registration for each approved vehicle. The page displays the server's USD fee
and available capacity before opening hosted Stripe Checkout. The browser never
sets the charged amount or the acting seller account.

The default fee is `EVENT_REGISTRATION_PRICE_CENTS` in Convex, initially `4900`
($49). An authorized administrator can override it with an event's
`registrationFeeCents`. Missing or invalid fee configuration fails closed.
Checkout snapshots the fee, currency, seller email, event name and vehicle name
for stable retries. Changing the default affects new reservations; existing
holds retain their original fee. Event-specific price changes are rejected while
there are active holds.

Return pages do not establish payment success. `/myAccount/registrations` reads
verified backend state and can refresh provider state for the seller's own
reservation. Confirmed registrations show their event, vehicle, payment reference,
Stripe receipt link, and non-guessable admission QR. Separate payment history
shows automatic refunds for extra payments without inventing extra admissions.
Sellers can view receipts and request eligible cancellation even if their account
is suspended.

Registration/payment/refund confirmations use the existing in-app notification
and Autosend outbox with deduplicated event keys. Optional event email preferences
still apply to Gearboxe notifications. Stripe payment receipts can also be sent
by Stripe using the Checkout payment's receipt email; configure receipt behavior
in the Stripe account. No card numbers or payment-method secrets are stored in
Gearboxe.

## Capacity and checkout lifecycle

A Convex mutation first reserves capacity for 35 minutes. Every hold and confirmed
registration updates the same event inventory record in a serializable database
transaction. The last place cannot be reserved by two concurrent sellers.
This relies on Convex's [serializable transactions](https://docs.convex.dev/database/advanced/occ).
Repeated requests for the same event/vehicle reuse its active reservation; a
seller can have at most five active holds. A confirmed registration or pending
cancellation blocks another registration for that event/vehicle.

Stripe Checkout creation uses an idempotency key specific to that reservation.
The configured expiry is identical to the hold deadline, with room above
Stripe's minimum 30-minute Checkout lifetime. A lost response can recover the
same Checkout session instead of creating another charge. Stripe documents
[Checkout expiry](https://docs.stripe.com/api/checkout/sessions/create#checkout_session_create-expires_at)
and [idempotent requests](https://docs.stripe.com/api/idempotent_requests).

Scheduled reconciliation checks active and expired reservations. Once checkout
has been attempted, unpaid holds are released only after authoritative provider
reconciliation. Untouched waitlist invitations can expire locally because Stripe
has never been contacted. Cancelling an
open checkout expires the Stripe session before releasing its place. An expired
local clock by itself does not prove that an earlier payment failed. Failed or
incomplete provider recovery retains the hold and records an operational error,
which staff can inspect; it does not risk overbooking.

A verified payment atomically converts one held place into one confirmed
registration. Replaying the same PaymentIntent returns the same outcome and does
not send another confirmation. A separate duplicate payment, an ineligible
vehicle/seller/event, or a late payment against a released reservation queues an
automatic full refund and grants no new admission. A stray session cannot release
or replace a reservation's correctly bound session.

## Cancellation and refunds

Self-service cancellation is allowed through the event's local calendar date
seven days before the event, inclusive, provided the vehicle has not checked in.
The default event time zone is `America/New_York`; an administrator may specify
another IANA time zone. Calendar dates, rather than fixed 168-hour intervals,
handle daylight-saving transitions. Within the final six calendar days, sellers
use support for exceptions.

A cancellation disables admission immediately and queues the refund. Capacity
remains occupied until Stripe confirms the refund succeeded. A pending, failed,
or cancelled provider refund is never represented as a successful refund.
Full successful refunds release capacity once, invalidate QR credentials, retain
the registration/payment history, and notify the seller. Staff can inspect and
retry failed refunds with an audited reason.

Administrators can cancel an event with a reason. New reservations and check-in
stop immediately. A bounded cancellation job queues full refunds irrespective of
the ordinary refund deadline and expires outstanding checkouts. Changing the date,
address, location or time zone of an occupied event is blocked: cancel/refund the
old bookings and create a replacement event. Events with payment or checkout
history cannot be deleted.

Payment records retain Checkout session, Stripe customer, PaymentIntent, charge,
receipt and refund references, the fee/currency snapshot, provider outcome, retry
attempts, and safe error codes. These records, checkout email snapshots and
admission credentials are available only to their owner and authorized staff.
They are retained for payment reconciliation and registration history without
automatic expiry in this release. Public event pages expose vehicles and public
event details, never payment references, receipts, seller contact data, or QR
credentials.

## Webhooks and recovery

Configure the Stripe endpoint at
`https://<marketplace-origin>/api/webhooks/stripe` for:

- `checkout.session.completed`, `checkout.session.expired`;
- `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`;
- `refund.created`, `refund.updated`, `refund.failed`.

Both Next.js and Convex verify the unmodified request body and Stripe signature.
The backend independently retrieves Stripe state, verifies the reservation's
metadata, amount and USD currency, and records a durable webhook job before
processing it. Jobs deduplicate by Stripe event ID. Failed processing returns a
non-success HTTP response for Stripe's retries and is also retried by the
scheduled worker. Stripe's [webhook guidance](https://docs.stripe.com/webhooks)
explains signature verification and delivery retries.

`/admin/payments` displays webhook failures, unresolved checkout holds, pending
refunds and failed refund jobs. A worker crash can be recovered through the job
lease/due-time mechanism. Retries are bounded; exhausted failures require staff
review and an audited retry. Do not edit payment or inventory counts directly.
External partial refunds and inconsistent provider references require operator
reconciliation rather than falsely releasing a full registration place.

## Configuration and rollout

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`EVENT_REGISTRATION_PRICE_CENTS`, and `APP_URL` in Convex. `APP_URL` must be the
exact marketplace origin, HTTPS outside local development. The same webhook
signing secret belongs in the Next.js deployment; Next.js also retains its Stripe
key for signature verification. The Next.js fee variable is not a Checkout price
source. Keep test and live Stripe environments isolated.

Deploy the schema, backend and web UI together. New events receive inventory
counters immediately. Legacy events with up to 1,000 registration records can
initialize transactionally; larger events require the internal
`eventBookings.startInventoryBackfill` operation. It processes bounded pages
and blocks new booking transitions while initializing the counter. Historical
registration/payment records must be reconciled before replacing their Stripe
references; do not assume an old Checkout session reference is a PaymentIntent.
On event cancellation, the legacy migration worker retrieves and verifies old
Checkout sessions, links the actual PaymentIntent/customer/receipt references,
and queues the refund without counting the existing registration again. Provider
failures retry with bounded backoff and appear in the admin payment operations
page, where staff can request an audited retry.

Staging verification must cover two sellers racing for the last place; repeated
Checkout creation and lost responses; paid completion before and after return;
expired/abandoned sessions; duplicate payment and webhook replay; refund-before-
completion ordering; pending/failed/successful refunds; event cancellation;
seller cancellation at the calendar cutoff; and QR denial after cancellation.
Local tests use mocked Stripe calls and do not create live payments or refunds.

Event deadlines, accepted rules, waitlist offers, assigned manager refund
exceptions and admission operations follow [Popup operations](POPUP_OPERATIONS.md).
