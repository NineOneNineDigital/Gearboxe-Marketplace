# Vehicle listing specification

Listings store identity (VIN/serial, year, make, model, trim, body style), powertrain,
colors, mileage and unit, odometer declaration, title status, seller state,
condition, mechanical issues, accident and damage disclosures, owner count when
known, service records, modifications, seller type, city/state/postal code,
features, asking price in USD and negotiability. Unknown details must be explicitly
declared; an empty features array means no options declared. MVP submissions
remain restricted to private sellers per the approved operating model.

## Lifecycle and moderation

New listings may be saved as drafts or submitted as pending. Submission and
approval require the full specification. Sellers can submit drafts/rejections,
reserve active listings, release a reservation, mark sold, or archive. Only an
administrator can approve pending listings or reject listings; rejection requires
a reason. Editing any non-draft listing returns it to pending review, including
administrator edits. Sold and archived listings cannot be edited; archived
listings can be reopened as drafts. Seller controls include editing drafts and
rejected listings so incomplete legacy records can be completed before review.

Every status change and edit appends actor, timestamp, before/after status and
reason to listing history and a separate operator-only moderation log. These
logs survive listing deletion. Public projections omit moderation notes, history
and contact information. Inactive listings remain accessible only to their
owner and administrators.

Existing records are compatible: new schema fields are optional only to allow
older records to load, and existing `approved` listings are treated as active.
No disclosure is guessed or backfilled. Editing/submitting older listings requires
completing the new fields. New writes use the seven statuses: draft, pending,
active, rejected, reserved, sold and archived.

## Buyer availability messages

On `/vehicles`, clicking a card opens its public detail page. Favorites and
Check availability have separate controls. Check availability opens an editable
message draft; sending requires an authenticated buyer and adds the message to
the buyer/seller conversation for that vehicle. Existing conversations are reused.
Sellers cannot send availability messages to themselves.

## Auto.dev VIN decoding

Set `AUTO_DEV_API_KEY` in the **Convex deployment** environment. Do not prefix it
with NEXT_PUBLIC or put it in frontend configuration. No additional package is
required. The authenticated `vin.decodeVin` action calls the documented
[Auto.dev v2 VIN endpoint](https://docs.auto.dev/v2/reference/decodeVin)
with server-side bearer authentication and a ten-second timeout. Only normalized
vehicle specification fields are returned, never provider account metadata.

Requests are limited to one per user every ten seconds. Successful decodes are
cached by VIN for 30 days. Invalid, missing, ambiguous or malformed provider
results and rate/network failures show recoverable errors; manual entry remains
available. Vehicles before 1981 may use manufacturer serials and manual review.

Verification status is server controlled: a listing is `decoded` only if a cached
successful decode matches its VIN, year, make and model; otherwise it is
`unverified`. Changing those fields recomputes verification. A decode does not
verify ownership, title, history, mileage, condition or seller disclosures and
does not bypass moderation. Auto.dev may not return every specification field;
sellers must complete missing fields manually.

Tests use documented response fixtures, with no paid requests. Before deployment,
configure the key and smoke-test a valid VIN, unknown VIN, pending submission,
approval, rejection and seller status changes against a staging Convex deployment.
