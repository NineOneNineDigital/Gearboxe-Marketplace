# Trust, safety, and moderation

The account safety center is `/myAccount/safety`; the administrator queue is
`/admin/safety`. Reporting controls appear on listings and conversations. All
permissions, suspension checks, contact restrictions, and quotas are enforced in
Convex, including calls made outside the UI.

## Seller verification and ownership

Clerk manages email and phone verification. Signed Clerk webhook updates supply
the primary email/phone verification status; client requests cannot claim these
statuses. Enable phone verification in the Clerk deployment before accepting
seller submissions. Existing accounts need a refreshed Clerk webhook event to
populate their verification fields. Sellers manage their contact methods through
the safety center's account settings button.

Submitting a listing requires verified email, verified phone, and an attestation
that the seller owns the vehicle or has the owner's authorization to sell it.
Save the draft, select it in the safety center, and record the attestation before
submitting. Changing the VIN invalidates the prior attestation. Optional identity
review is a manual support workflow; requesting it never marks the seller as
verified. Moderators record their review basis and approve or reject the request.

Public seller indicators expose verification booleans and the listing ownership
attestation timestamp, never contact values or document evidence. Attestation and verification are signals, not guarantees of title,
vehicle condition, or transaction safety.

## Privacy, visibility, and retention

| Data | Visibility | Retention and deletion |
| --- | --- | --- |
| Full VIN | Public on active/legacy-approved listings, consistent with the MVP operating model. Private on draft, pending, rejected, withdrawn and archived listings. Listing owners and authorized admins can inspect the private listing. | Kept while the listing is live. Removed from draft, rejected, sold, withdrawn and archived listings after 90 days of inactivity, measured from the latest update or creation. Cached VIN decode records expire after 30 days. |
| Email and phone | The owner and authorized administrators can access account values. Public seller queries expose verification booleans only. Contact fields are omitted from public listings. Buyers and sellers choose independently whether to share contact details in private messages. | Account phone data remains until changed or the Clerk account deletion webhook removes the account record. Private listing contact text follows the inactive-listing 90 day cleanup. Clerk retains its own account data under deployment/provider policy. |
| Ownership document | Uploader and authorized admins only, via an authenticated document endpoint. Never included in public photos, listing responses, messages, or permanent storage URLs. | Access expires exactly 30 days after upload. An hourly bounded cleanup physically deletes expired storage objects and metadata. Cleanup may finish after expiry when there is a backlog; expired files remain inaccessible. |
| Precise location | Do not collect a home/street address. Public listings expose city and state only. New writes discard postal codes and round coordinates to two decimal places, approximately one kilometer. Private listing/admin data can retain those rounded coordinates for discovery. | Precise inputs are discarded on write. The daily bounded privacy sweep sanitizes legacy stored locations. Rounded location is retained with the listing. |
| Reports, private notes, appeals, identity review outcome | Reporters see their submitted reports; appellants see their requests and support responses. Case notes and activity indicators are admin only. Reports do not disclose the reporter to the reported seller. | Retained for continuing abuse investigation and appeal continuity; no automatic expiry in this release. Record references and factual summaries only. Do not put VINs, phone numbers, precise addresses, or document contents into these records. |
| Admin audit log | Authorized admins only. Records actor, action, time, reason and affected record references. | Retained indefinitely. Application APIs provide append/read operations and no edit/delete operations. Corrections require a new entry. Deployment operators still control the underlying database; this is application immutability, not external tamper-proof archival. |

Listing privacy and VIN-cache sweeps run daily in bounded batches; document
cleanup runs hourly. Operators should monitor backlog
and invoke the internal cleanup functions again if needed. Expiry protects
document access even before physical cleanup completes. Ownership files accept
only PDF, JPEG and PNG, up to 10 MiB, through a short-lived authenticated upload
lease. Uploaders should redact unrelated addresses, signatures and account
numbers. Private document downloads are audited, require fresh authorization,
and must not be forwarded or retained outside the review workflow.

These controls cannot detect private data that a seller voluntarily types into
public descriptions or embeds in photographs. Moderators must remove that
content using the privacy reason code. Listing instructions tell users to upload
ownership evidence through the private safety workflow.

## Abuse controls

Blocking prevents new messages in both directions, including through an existing
conversation. Historical conversation records remain available to authorized
participants. Suspended accounts cannot send messages, publish listings or use
other protected marketplace mutations; the safety center remains available for
appeals and support. Suspension archives the seller's listings. Restoring account
access does not automatically republish them.

Server quotas use per-account fixed windows, shared across clients:

| Action | Limit |
| --- | --- |
| Messages | 30 per minute |
| New conversations | 10 per hour |
| Listing creation and submissions (shared quota) | 5 per day |
| Reports | 10 per hour |
| Appeals/support requests | 5 per day |
| Private document uploads | 5 per day |

Messages also reject repeated content in a short interval. These controls reduce
spam from an account; they are not an IP reputation or coordinated-account fraud
detection system. Admin activity indicators flag recent accounts, repeated open
reports, and unverified contact methods. Reports and indicators are allegations
or investigation signals, not automatic grounds for punishment.

Messaging pagination, notification email preferences, Autosend delivery, and
unsubscribe rules are documented in [Messaging and notifications](NOTIFICATIONS.md).

## Moderation, appeals, and escalation

Reason codes are `spam`, `scam`, `harassment`, `unsafe_content`,
`false_information`, `stolen_vehicle`, `privacy`, and `other`. Case decisions
require a reason code and private note. A moderator can mark a case reviewing,
resolved, dismissed or escalated, take down a listing, suspend a user, review
ownership evidence, or review identity evidence. Actions append an admin audit
entry; listing removals also preserve listing moderation history and notify the
owner. The queue prioritizes the oldest unresolved cases (up to 100 per status);
document and identity queues prioritize the oldest 100 pending requests.
The audit UI shows the latest 200 records.

Appeals and support requests enter the same private queue and remain accessible
to suspended users. Staff respond in the application. Prefer a reviewer other
than the original decision-maker. Verify the account and listing references,
compare the appeal with the recorded evidence, state a concrete response, and
record any corrective actions. If an appeal succeeds, restore account access and
separately return eligible archived listings to pending review. They must still
satisfy seller verification, attestation and listing submission checks.

Before launch, designate a safety lead and backup through the team's private
operating roster. The application does not send external escalation alerts.

1. Triage threats, suspected stolen vehicles, coordinated fraud, and exposure of
   private documents promptly. For immediate physical danger, advise the reporter
   to contact local emergency services; the marketplace is not an emergency
   response service.
2. Record factual record references, the reason code, urgency, and next responsible
   person in a moderation note. Preserve evidence within the authorized system.
   Do not duplicate sensitive document contents into notes or chat tools.
3. Mark the case escalated, notify the designated safety lead through the team's
   approved internal channel, and apply proportionate suspension or listing
   takedown when needed to contain ongoing harm.
4. The safety lead coordinates security incidents, privacy incidents, and any
   legally required disclosure with the appropriate organizational owner.
   Verify external requests and authority before disclosing any private data.
5. Record the decision, notify the affected user through the support response,
   and retain the appeal route. Audit corrective actions separately; never edit
   the history to remove the earlier action.

Changing retention periods, collecting identity document files, adding a legal
hold, or exporting private evidence requires an explicit product/operational
decision. The current optional identity feature stores a review outcome and
reason, not government identity images or biometric data.
