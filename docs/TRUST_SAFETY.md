# Trust, safety, and moderation

The account safety center is `/myAccount/safety`; the administrator queue is
`/admin/safety`. Reporting controls appear on listings and conversations. All
permissions, suspension checks, contact restrictions, and quotas are enforced in
Convex, including calls made outside the UI.

## Seller verification and ownership

Buyer engagement uses a separate rule: public browsing needs no account, while saving a listing and sending a buyer-to-seller message require a signed-in account with verified email. Buyer phone verification is not required. Convex uses the email verification status supplied by signed Clerk webhooks; a stale or missing webhook status denies new engagement until it is refreshed. Existing favorites and conversation history stay readable if verification is later lost, and a favorite can still be removed, but new buyer messages and favorites are blocked. Seller replies follow the seller account's existing suspension and messaging controls. Structured offers will use the same buyer-email rule when implemented.


Clerk manages email and phone verification. Signed Clerk webhook updates supply
the primary email/phone verification status; client requests cannot claim these
statuses. Enable phone verification in the Clerk deployment before accepting
seller submissions. Existing accounts need a refreshed Clerk webhook event to
populate their verification fields. Sellers manage their contact methods through
the safety center's account settings button.

Sellers select **titled owner** or **authorized by the titled owner** in Trust & safety for each listing and attest to its accuracy. Submission requires this declaration and verified email and phone. A VIN change clears the declaration. A legacy combined attestation needs an explicit role before a new submission or approval. Existing published listings stay visible until the seller changes their declaration or another moderation or lifecycle action occurs. Updating a published declaration returns the listing to review. Account identity review remains optional and separate.

### Ownership and lien decisions

1. Review the pending listing, seller declaration, title and lien disclosures. An ordinary titled owner with a clean title and no lien can proceed through normal independent moderation without a document upload. An authorized seller needs private, independently reviewed evidence. Branded, other or unknown title status, an outstanding lien, or an uncertain lien enters enhanced review. Prior submitted indicators stay with the case after corrections so the moderator can evaluate the change.
2. If authority, title or payoff is unclear, note what would resolve it. A moderator can request private evidence for ambiguous ownership, a VIN or identity discrepancy, credible fraud reports, repeat-activity concerns, a title issue or a lien. Evaluate the circumstances individually. Open the evidence request for the specific listing and write the seller’s next step. The seller receives an inbox notice and can read the instructions by selecting the listing in Trust & safety. An evidence request against a published listing immediately returns it to private pending review.
3. For an authorized seller, ask for the relevant portion of the titled owner’s signed authorization identifying the vehicle and seller, with enough information to connect the authorization to the titled owner. For an outstanding lien, review the seller’s payoff and title-release path and request private corroboration when needed. Ask for the minimum necessary material and permit unrelated addresses, signatures and account numbers to be covered. Do not request uploads in messages or public photos. These are review criteria, not state-specific transfer instructions.
4. In **Admin → Safety**, inspect the private upload and accept it or reject it with a concise reason suitable for the seller. In the listing review, record a factual resolution for the current revision. An authorized seller or explicit evidence request requires an accepted, unexpired document for that seller, listing and VIN. An uncertain lien must be clarified by the seller before clearance. If information conflicts, request more information, reject with a correction path, or escalate through the private report or appeal queue to the safety lead.
5. Approve the listing separately after the clearance. Edits and resubmissions invalidate previous clearance. Evidence must still be valid when the listing is approved. Document expiry after publication does not by itself withdraw the listing. Sellers can appeal in Trust & safety. An independent authorized moderator may record a new decision with a factual basis; an escalation or appeal cannot override missing evidence, an uncertain lien, or the prohibition on self-review.

Record decisions, their listing revision and relevant case references in the private audit trail. Keep document contents and sensitive identifiers out of notes and notifications. Listing review metadata and audit history currently have no automated deletion schedule; the 30-day limit applies to the uploaded evidence and its document record. Private evidence requirements and uploaded files do not provide a public ownership guarantee. Confirm final trigger wording, reviewer coverage and the public privacy wording before launch.

## Privacy, visibility, and retention

| Data | Visibility | Retention and deletion |
| --- | --- | --- |
| Full VIN | Public on active/legacy-approved and reserved listings, consistent with the MVP operating model. Private on draft, pending, rejected, withdrawn and archived listings. Listing owners and authorized admins can inspect the private listing. | Kept while the listing is live. Removed from draft, rejected, sold, withdrawn and archived listings after 90 days of inactivity, measured from the latest update or creation. Cached VIN decode records expire after 30 days. |
| Email and phone | The owner and authorized administrators can access account values. Public seller queries expose verification booleans only. Contact fields are omitted from public listings. Buyers and sellers choose independently whether to share contact details in private messages. | The Clerk account deletion webhook clears the account email and phone and leaves a scrubbed internal tombstone so participant history remains linked. Private listing contact text is cleared during bounded account cleanup; ordinary inactive listings follow the 90-day sweep. Clerk retains its own account data under deployment/provider policy. |
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

Sellers must describe accidents, damage, and mechanical issues known to them;
they may leave each detail field blank only if they know of no issue to describe.
A blank appears as “No issue disclosed by seller,” not a verification or
condition guarantee. Compare disclosures against photos, VIN/history evidence,
reports, and seller statements. If they conflict, reject the listing with a
specific reason and request correction. Edits to approved listings return them to
review. Existing conversations remain available, but this transition does not
send a conversation-specific disclosure-change notification.

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
