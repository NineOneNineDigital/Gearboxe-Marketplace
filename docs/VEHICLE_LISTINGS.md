# Vehicle listing specification

Listings store identity (VIN/serial, year, make, model, trim, body style), powertrain,
colors, mileage and unit, odometer declaration, title status, seller state,
condition, mechanical issues, accident and damage disclosures, owner count when
known, service records, modifications, seller type, city/state,
features, asking price in USD and negotiability. Unknown details must be explicitly
declared; an empty features array means no options declared. MVP submissions
remain restricted to private sellers per the approved operating model.

Sensitive-data visibility, retention, seller verification and abuse handling
follow [Trust and safety](TRUST_SAFETY.md).

## Lifecycle and moderation

New listings autosave as incomplete drafts. Saves use a revision check to prevent
one browser tab from overwriting another; retrying draft creation reuses the same
draft. Sellers preview their listing before submitting it as pending. Submission
and approval require verified seller email and phone, ownership attestation,
the full specification and at least one owned, processed
photo with both thumbnail and detail files present in Convex storage. Legacy URL
photos must be replaced before submission. Uploads and failed or unfinished
processing block submission. Duplicate VINs on pending, active or reserved
listings block submission, including older records without normalized VIN keys.

Sellers can edit and resubmit rejected listings while retaining the rejection
reason until resubmission, reserve active listings, release a reservation, mark
sold, withdraw, or archive. Only an
administrator can approve pending listings or reject listings; rejection requires
a reason. Editing pending, active or reserved listings returns them to pending
review, including administrator edits. Sold, withdrawn and archived listings
cannot be edited; withdrawn and self-archived listings can be reopened as drafts.
Listings removed by moderation require an appeal and moderator restoration.
Seller controls include editing drafts and
rejected listings so incomplete legacy records can be completed before review.

Every status change and submitted edit appends actor, timestamp, before/after status and
reason to listing history and a separate operator-only moderation log. These
logs survive listing deletion. Public projections omit moderation notes, history
and contact information. Inactive listings remain accessible only to their
owner and administrators. Existing buyer/seller conversations remain usable
after a listing closes; their sidebar uses a separate minimal context query
without private specifications or draft photos. Only unlinked drafts/rejections
can be deleted. Any conversation or event registration prevents deletion, so
those records cannot become orphaned.

My Listings shows owned listings, moderation reasons, and lifetime view,
favorite, conversation and inbound buyer-message counts. Views count once per
browser session identifier per UTC day; owner/admin views are excluded. Daily
deduplication records expire after seven days while aggregate counts remain.
Durable in-app confirmations cover draft creation, submission, moderation and
status changes; routine autosaves do not create notification or history spam.

Existing records are compatible: new schema fields are optional only to allow
older records to load, and existing `approved` listings are treated as active.
No disclosure is guessed or backfilled. Editing/submitting older listings requires
completing the new fields. New writes use eight statuses: draft, pending,
active, rejected, reserved, sold, withdrawn and archived.

## Buyer availability messages

On `/vehicles`, clicking a card opens its public detail page. Favorites and
Check availability have separate controls. Check availability opens an editable
message draft; sending requires an authenticated buyer and adds the message to
the buyer/seller conversation for that vehicle. Existing conversations are reused.
Sellers cannot send availability messages to themselves.

## Buyer discovery

`discovery.browse` returns cursor pages, not full inventory collections. The
browser requests 12 rows at a time; the server caps page requests at 48 and sets
read budgets of 256 rows / 2 MB. Counts describe loaded results rather than a
costly inventory-wide total. Filters and all seven sort orders persist in the
URL, including navigation back/forward. Error boundaries offer retry while
leaving filters editable. Sparse pages can contain no matches with a continuation
cursor; the UI distinguishes these from an exhausted, empty search.

Public inventory has a transactional catalog and keyword posting index. Approval
and reservation release publish index entries; editing, reservation, sale,
withdrawal and rejection remove them in the same mutation. The index includes
only title, make, model, trim and body style identity words, never extracted VINs,
contact details, private descriptions or disclosures. Keyword search matches
whole words, case/accent-insensitively, with AND semantics. Make/state scopes and
price, normalized mileage, year and creation-time ordering use compound indexes.
Remaining ranges, model equality and additional search words are checked only on
the bounded page. There is no relevance ranking or fuzzy/prefix matching.

Distance searches first choose an indexed geographic rectangle containing the
entire radius, with latitude-strip fallbacks at poles/date-line crossings. Exact
great-circle distance is checked on candidates in miles. Radii are 1–500 miles.
Listings without coordinates are excluded only from distance searches. Sellers
can explicitly add their approximate current location while near the vehicle;
both client and server round coordinates to two decimal places for discovery.
Public responses expose city/state only; postal codes are discarded on write.
Changing vehicle city/state clears the editor's coordinates. No geocoder or
location-provider account is required. Browser geolocation requests permission
only after the user chooses that control. Mileage sorting and maximum mileage
filters normalize kilometers to miles, while cards retain the declared unit.

Authenticated buyers can save up to 25 named filter/sort combinations and remove
them; saved searches do not send alerts. Account history retains the latest 50
distinct views and displays up to 12 available listings. Guests retain up to 12
distinct views in browser storage, falling back to session memory when storage
is unavailable. All history resolutions recheck public listing status and never
reveal draft/rejected/closed records. Featured and related inventory queries are
bounded as well.

Vehicle detail metadata uses a separate minimal public query with request-scoped
deduplication. It emits canonical URLs, Open Graph/Twitter previews and escaped
Car/Offer JSON-LD without private fields. Missing/private listings are noindex;
backend metadata failures use a noindex fallback and log a sanitized operational
warning. Filtered browse URLs canonicalize to `/vehicles` and are noindex. Set
`NEXT_PUBLIC_APP_URL` to the exact public origin for canonical/social URLs.
`robots.txt` advertises `/sitemap-index.xml`, which includes the static sitemap and
listing sitemap shards. Each listing receives a stable publication shard with
500 lifetime slots; closed listings are omitted without shifting other shards.
Backend sitemap failures return an error rather than silently emitting an empty
inventory sitemap.

### Discovery rollout and existing inventory

Deploy the schema/functions to the confirmed, isolated Convex deployment before
rolling out the browser queries. Existing inventory requires a backfill: invoke
`discovery:backfillInternal` in the operator console with `{"cursor":null}`, then
repeat with its `continueCursor` until `isDone` is true. Each mutation handles one
vehicle to bound keyword-index writes. The authenticated `discovery.backfill`
equivalent is admin-only. Both paths are resumable and safe to repeat; they also
remove stale entries for closed listings. New moderation transitions and sample
data writes maintain the catalog automatically. Do not treat an empty, unfilled
catalog as confirmation that the deployment has no vehicles.

Before release, verify backfilled active/legacy-approved listings, private-state
removal, radius queries with real coordinates, cursor continuation under updates,
saved searches, guest/account history, and sitemap/social responses against the
staging deployment. The schema retains optional legacy vehicle `eventId` and
`saleStatus` fields so existing development records can upgrade without deletion.
Current booking and listing flows use registrations and `status` instead. The
configured development backend has been synced and its discovery catalog
backfilled; staging and production rollout still require their own verification.

## Permanent vehicle photos

The listing editor uploads JPEG, PNG and WebP files directly to the Convex HTTP
endpoint `/vehicle-media/upload` using an authenticated, single-use upload lease.
Set **`APP_URL` to the exact frontend origin** (for example
`https://gearboxe.example`, without a trailing slash) in the Convex deployment.
Convex supplies `CONVEX_SITE_URL`. CORS permits only that web origin; upload links
expire after one hour. The web app needs its matching `NEXT_PUBLIC_CONVEX_URL`.

The server caps the actual request stream at 10 MiB, then decodes the image with
Sharp in a Node action. Claimed MIME must match actual JPEG/PNG/WebP contents.
Corrupt files, animations, empty files and images over 40 million pixels are
rejected. EXIF orientation is applied before metadata (including EXIF/GPS) is
removed. Output is WebP: a thumbnail within 480×360 and a detail image within
1920×1440, without enlargement. Original uploads are deleted after processing.
Sharp is an explicit dependency and configured as a Convex Node external package.

Listings reference owned, processed storage records rather than browser URLs.
The editor supports up to 30 photos, captions up to 200 characters, ordering,
replacement, deletion, upload progress and retry. Saves wait for uploads and
deletions to finish; failed uploads must be retried or removed. Existing URL
photos remain compatible and can be retained, reordered or removed; upload a new
file to replace one. Existing URL photos appear before managed storage photos.
Only the configured Convex deployment's `/api/storage/` images and
`images.unsplash.com` are trusted, with matching Next.js image configuration.

Attachment checks run in the listing mutation: media must belong to the seller,
be ready and not belong to another listing. Replacing/removing attached photos
deletes their files when the listing is saved; deleting a listing removes all
its managed files. Unattached uploads expire after 24 hours. A 15-minute cron
cleans expired records and their files, then sweeps tagged media storage files
in batches to catch interrupted writes. Files used by other features are not
deleted. Convex storage uses public bearer URLs, suitable for marketplace photos;
do not upload private documents. Legacy URL photos are not migrated or deleted
from external providers automatically.

Tests run real Sharp processing plus the upload, ownership, replacement and
cleanup handlers locally. Deploy the schema/functions to an isolated staging
Convex deployment and smoke-test authenticated uploads, cross-origin rejection,
retry, save/edit, captions/order, image delivery and cleanup before release.

## Provider-neutral VIN decoding

The listing workflow calls the authenticated `vin.decodeVin` action and consumes
only the shared `DecodedVehicle` contract. Provider adapters implement
`VinDecoder.decode`; their payloads, credentials and endpoints stay behind that
interface. Adding another commercial adapter changes provider selection rather
than the listing form, validation or moderation workflow.

Set `VIN_DECODER_PROVIDER` in the **Convex deployment** environment:

- `auto_dev` (default, preserving existing deployments): also set
  `AUTO_DEV_API_KEY`. The adapter uses the documented
  [Auto.dev v2 VIN endpoint](https://docs.auto.dev/v2/reference/decodeVin)
  with server-side bearer authentication.
- `vpic`: no API credential is required. The adapter uses NHTSA's
  [Decode VIN flat-format JSON endpoint](https://vpic.nhtsa.dot.gov/api/).
  Only a single matching VIN result with error code `0`, no suggested VIN and
  complete year/make/model is accepted; partial or ambiguous decoding remains
  unverified and can be completed manually.

Do not prefix credentials with NEXT_PUBLIC or put them in frontend configuration.
Both adapters use a ten-second timeout and return normalized vehicle fields only.
There is no automatic provider fallback: provider failures remain visible and
manual entry is always available.

Requests are limited to one per user every ten seconds. Successful normalized
decodes are cached by VIN for 30 days, independent of provider, so switching
providers preserves existing verified specifications until the cache expires.
Invalid, missing, ambiguous or malformed results and rate/network failures show
recoverable errors. Vehicles before 1981 may use manufacturer serials and manual
review. Optional specifications absent from either provider must be completed by
the seller.

Verification status is server controlled: a listing is `decoded` only if a cached
successful decode matches its VIN, year, make and model; otherwise it is
`unverified`. Changing those fields recomputes verification. A decode does not
verify ownership, title, history, mileage, condition or seller disclosures and
does not bypass moderation.

Tests use response fixtures without paid requests. Before deployment, configure
the chosen provider and smoke-test a valid VIN, unknown VIN, pending submission,
approval, rejection and seller status changes against a staging Convex deployment.
