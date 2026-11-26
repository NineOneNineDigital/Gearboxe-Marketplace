# Nationwide private-seller launch policy

Status: Founder product decisions recorded November 4–5, 2026. Operational review and final public wording remain open in GBXMRKT-5 and GBXMRKT-2.

## Who may submit

- A private seller in any of the 50 U.S. states or Washington, DC may create a listing without an invitation. Raleigh–Durham–Chapel Hill outreach provides optional help and does not grant special publishing rights.
- The seller must have verified email and phone and either be the titled owner or provide private documentation that the owner authorized the sale. An ownership attestation is required. An authorized seller is not automatically treated as a dealer, but the moderator must inspect the authority evidence before approval.
- Every listing requires human approval before publication. Draft, pending, and rejected listings remain private. There is no fixed listing-count cap for private accounts. Repeated or high-volume activity prompts human review for undisclosed dealer activity; it is not automatic proof of a violation.

## Vehicle and title boundaries

- Eligible categories are passenger cars, trucks, SUVs, and street-legal specialty vehicles with transferable ownership documentation. Dealer inventory, curbstoning, title jumping, parts-only vehicles, and unresolved ownership are outside launch scope.
- A disclosed branded title may be considered after enhanced manual review. A disclosed lien may be considered only with a documented payoff and transfer path, also subject to enhanced review. Moderators may ask for additional private evidence when risk or the case requires it; ordinary titled owners are not required to upload documents by default.
- Listings must accurately state mileage, title and known condition information. The full VIN is public after approval only. A seller's contact details, ownership evidence, and exact vehicle location remain private unless the seller chooses to share contact details in a conversation.
- Gearboxe does not guarantee condition, title, transfer, or completion of a sale, and does not hold vehicle-purchase funds.

## Moderation and support decision path

1. Verify the seller account and attestation. If the seller is acting for the titled owner, request and review authority evidence through the private document workflow. Do not ask for documents in public descriptions or messages.
2. Check vehicle category, location code, VIN, title and lien disclosures, photo coverage, and known condition information. Route branded titles, liens, unusual ownership, repeated listing patterns, or inconsistent data to enhanced review. Do not approve while ownership or a payoff path is unresolved.
3. Record a factual decision basis and action in the admin audit/moderation workflow. Request missing information or reject with a reason when necessary. Do not copy sensitive document contents into notes.
4. For a state-specific title, tax, registration, or transfer question, explain that Gearboxe does not supply state-specific instructions at launch. Direct the parties to the relevant state motor-vehicle agency or their own qualified adviser. Escalate suspected fraud, stolen vehicles, threats, or privacy incidents under `TRUST_SAFETY.md`.
5. The founder is the primary moderation/support owner. Name and train a backup before public launch; staff coverage must meet the one-business-day review target, including the holiday period. Escalate unusual out-of-state cases to the designated moderation or safety lead before approval.

### Internal support answers to rehearse

Use these as case-handling guidance, not approved public policy copy. Confirm the
facts in the listing and current policy before answering; record the case owner
and any promised follow-up in the private support record.

| Seller question | Supported answer and next step |
| --- | --- |
| “Can I list from my state, or do I need an invitation?” | Eligible private sellers in all 50 states and DC may start a draft without an invitation. Submission still needs verified contact, required listing details, and manual review. Do not promise approval or nearby buyer demand. |
| “I am selling for the titled owner. What do I upload?” | Explain that vehicle-specific authority evidence is reviewed privately before approval. Direct the seller to the private evidence request flow and ask them to cover unrelated sensitive details; do not accept documents in listing text or an ordinary message. A moderator decides whether the evidence is sufficient. |
| “Can I list a branded title or vehicle with a loan?” | A disclosed branded title or outstanding lien may be reviewed, but publication needs enhanced moderator clearance. For a lien, ask for a credible payoff and transfer path through the private workflow. An uncertain lien status must be clarified before approval. Do not promise a transfer outcome. |
| “How do I transfer title or pay tax in my state?” | Gearboxe does not give state-specific transfer or tax instructions. Point the parties to the relevant state motor-vehicle agency or their own qualified adviser, and escalate any suspected title-jumping or fraud signal to the safety lead. |

If a question reveals new ownership, title, lien, location, or condition facts,
return the listing to the applicable review path rather than answering around
an unresolved hold. Do not turn a count-based repeat-listing cue into a dealer
finding without a documented human decision.

## Implementation map and remaining gaps

- `apps/web/convex/lib/vehicleValidation.ts` enforces private seller type and valid state/DC codes at submission; `discoveryPolicy.ts` validates public state filters. Seller and vehicle states may differ.
- New submissions require an approximate vehicle location for ZIP/radius discovery. The editor can resolve a private vehicle ZIP to rounded coordinates or use browser location while the seller is near the vehicle. Public listing responses omit the ZIP and coordinates. Before launch, audit already approved listings without coordinates and obtain corrected seller locations; those records remain in nationwide browsing but cannot appear in distance results until corrected.
- `apps/web/convex/lib/trustGuards.ts` requires verified seller email and phone. The existing ownership attestation is in the private safety flow. Manual approval is enforced by the listing status transition.
- GBXMRKT-9 owns risk-based ownership and authorized-seller evidence review; GBXMRKT-16 owns lien disclosure and payoff-path enforcement; GBXMRKT-17 owns vehicle-category enforcement; GBXMRKT-27 owns repeated-listing signals; GBXMRKT-7 verifies open self-service end to end. These controls must pass before the policy is represented as fully enforced.
- GBXMRKT-2 owns final public terms, privacy, and marketplace wording. No state-specific transfer, tax, registration, or legal compliance claim should be published without a verified source and an owner for updates.

## Self-service release verification

The public **Sell your vehicle** link takes a signed-out seller through signup and back to the listing editor. The seller can save a private draft before verifying both contact methods. From a saved draft, **Trust & safety** opens the matching owned listing for attestation and provides a return link. Submission sends it to the moderation queue. Rejected listings can be corrected and resubmitted. A moderator selling a vehicle needs another moderator to approve their own listing.

The automated listing-lifecycle suite exercises ordinary accounts from North Carolina, Washington, DC, and Alaska. It covers Clerk account synchronization, an unverified phone, attestation, draft autosave, rejection and correction, moderator approval and national search indexing. Validation tests cover all 50 states and DC. These tests use local fixtures.

Before opening a hosted release, verify that the target Clerk instance permits open registration and supports email and phone verification. In isolated staging, follow the seller link on a phone-sized browser, complete real signup and contact verification, upload the five required views, leave for attestation, return to the same draft, and submit. Use a separate moderator to reject with an actionable reason, then approve the corrected listing. Confirm the anonymous national search and direct URL reveal the approved listing only after approval. Test an authorized seller and a lien case after their evidence workflows are ready. Record the environment, build, UTC time, outcome and any failed step without recording contact details, credentials, or private documents. The launch owner records production smoke after an authorized release and confirms primary and backup coverage of the one-business-day review target.

## Incident response for open intake

Triage reports in the existing moderation queue. For each credible abuse case, record the affected listing or account, the factual reason, moderator and follow-up owner. Hold pending listings for review, remove an affected public listing when warranted, or suspend the responsible account. Preserve review history and direct the seller to the appeal process. Use the repeat-listing indicators below to prioritize review. Keep other eligible sellers' signup, drafts and approved listings available. For a systemic publishing failure, stop moderator approvals while the release owner investigates and use the deployment rollback procedure for the affected release. Reopen corrected or restored listings through independent manual review. Escalate queue delays to the backup moderator and record the handoff.

## Repeat-listing investigation cues

The listing review panel computes an on-demand, operator-only snapshot from at most the 100 newest seller listings and up to 11 reports in each open/reviewing/escalated status. It flags five current pending, active, or reserved listings, five listings created or submitted in the last 90 days regardless of current status, or three current listings plus an open report or a repeated VIN. It also shows when three or more sampled current listings share a city and state; that is context, not a flag by itself. Legacy `approved` listings count as active. Draft, rejected, sold, withdrawn, and archived listings do not count as current inventory but do count as recent activity when created or submitted within the window. A truncated sample is labeled as a minimum and must not be treated as a complete history. These adjustable thresholds are investigation cues, not proof of dealer activity or a limit on submissions. Ownership start dates are not collected, so no ownership-duration signal is inferred.

Review the facts and consider ordinary household, collector, and authorized-seller explanations. When needed, record the factual basis and next owner in the review panel, coordinate a request for ownership or authority evidence through the private support workflow, and review submitted documents in Safety. Recording a request does not notify the seller. Escalate uncertainty to the moderation lead; approve or reject using the existing listing controls, recording a reason and preserving the normal appeal path. Do not put VINs, precise locations, or document contents in audit notes. The derived snapshot is not stored or shared with the seller; review steps are retained in the existing operator audit log, which currently has no automated retention limit; an owner must define one. Ownership documents follow the existing private-document retention workflow.

The indicator is fetched only when an operator opens one listing, using seller and report-status indexes and fixed read limits; it adds no per-row queue queries and makes no unbounded national scan. If the sample truncates or national volume grows, use an indexed, paginated investigation or a purpose-built aggregate with an explicit retention policy before interpreting a complete history.
