# Gearboxe Market MVP Operating Model

Status: Approved for MVP planning
Scope: First production launch of the private-party vehicle marketplace and popup market platform

## 1. Product Position

Gearboxe Market is a curated private-party vehicle marketplace that helps
buyers and sellers complete a safer, better documented sale. Gearboxe provides
listing tools, messaging, moderation, event registration, educational guidance,
and access to third-party services.

For the MVP, Gearboxe is not the seller, buyer, dealer, broker, lender,
insurer, title agent, escrow holder, or custodian of vehicle-purchase funds.
Vehicle price negotiation and payment take place directly between buyer and
seller or through an approved third-party provider.

## 2. Initial Market

Recommended launch market: Raleigh–Durham–Chapel Hill, North Carolina.

The first launch should operate in one metro area so Gearboxe can establish a
repeatable moderation process, support local inspections and title services,
and run popup markets without introducing multi-state operational complexity.

Expansion into another state or metro requires a launch review covering local
title-transfer guidance, taxes, event requirements, partner availability, and
support capacity.

## 3. User Eligibility

### Sellers

An MVP seller must:

- be at least 18 years old;
- have a verified email address and phone number;
- be the titled owner or have documented authority to sell the vehicle;
- accept the seller representations and marketplace rules;
- provide accurate mileage, title, damage, and condition disclosures; and
- use Gearboxe as a private seller rather than as an undisclosed dealer.

Dealer inventory, curbstoning, title jumping, parts-only vehicles, vehicles
without transferable ownership documentation, and prohibited or fraudulent
content are not allowed.

### Buyers

Browsing is public. An authenticated account with verified contact information
is required to favorite a vehicle, message a seller, report content, request a
partner service, or participate in a popup market workflow.

## 4. Vehicle Eligibility

The MVP supports passenger cars, trucks, SUVs, and street-legal specialty
vehicles that can be legally transferred by a private seller.

Recommended title policy:

- clean titles are permitted;
- rebuilt, salvage, flood, lemon-law, or other branded titles require explicit
  disclosure and enhanced manual review;
- vehicles with unresolved ownership or title documentation are prohibited;
- known liens must be disclosed and require a documented payoff path; and
- odometer status must be declared as actual, exempt, or not actual.

Vehicles manufactured in 1981 or later should use a valid 17-character VIN.
Earlier vehicles may use their original manufacturer serial or chassis number
and require manual review.

## 5. Listing Lifecycle

The production lifecycle is:

1. Draft
2. Submitted
3. Pending review
4. Approved and active, or rejected with a reason
5. Reserved, sold, withdrawn, or expired
6. Archived

Every new or materially edited listing is reviewed before public publication.
Gearboxe targets a one-business-day moderation response during the pilot.

Listings expire after 45 days unless the seller confirms availability. Sellers
must promptly mark vehicles reserved, sold, or withdrawn. Gearboxe may suspend
or remove listings when accuracy, safety, ownership, or policy concerns arise.

## 6. Marketplace Revenue

Recommended pilot pricing:

- standard marketplace listings are free;
- buyer browsing and messaging are free;
- popup market vehicle registration is a configurable flat fee, initially
  recommended at $49 per vehicle;
- optional partner services are paid to the partner or processed as a clearly
  disclosed referral transaction; and
- Gearboxe does not collect a percentage of the private vehicle sale in the
  MVP.

Any future success fee, transaction fee, deposit, escrow, financing, insurance,
or warranty revenue requires a separate legal, compliance, and operating-model
review.

## 7. Buyer and Seller Privacy

Public seller information is limited to:

- first name or chosen display name;
- general location at city or metro level;
- account tenure; and
- seller verification indicators.

Email address, phone number, home address, identity documents, ownership
documents, and precise vehicle location are not public. Buyers and sellers
communicate through Gearboxe messaging until they independently choose to share
contact details.

The full VIN is public on approved listings so every shopper can independently
obtain history, specification, and recall information. VINs remain private on
draft, pending, rejected, withdrawn, and archived listings.

## 8. Trust and Safety

The MVP requires:

- manual review before publication;
- verified seller email and phone number;
- seller ownership and disclosure attestations;
- reporting and blocking controls;
- moderation notes and an immutable administrative audit trail;
- messaging and listing rate limits;
- prohibited-content and repeat-offender enforcement;
- prominent private-sale, test-drive, payment, and meeting safety guidance;
- a documented escalation path for fraud, threats, stolen vehicles, and law
  enforcement requests; and
- a support process for listing, payment, event, and account disputes.

Gearboxe does not guarantee vehicle condition, seller statements, title status,
or completion of a sale. Partner results and reports must identify the partner
that provided them.

## 9. Popup Market Model

Only approved listings may register for a popup market. A registration is tied
to one seller, one approved vehicle, and one event.

Recommended event rules:

- capacity is enforced before payment;
- payment creates an idempotent registration and receipt;
- each registration receives a non-guessable QR credential;
- check-in is restricted to authorized event staff;
- event staff can search the roster when QR scanning is unavailable;
- seller instructions and event terms are delivered before the event; and
- refunds are available until seven calendar days before the event, with
  documented exceptions for cancellation or material event changes.

Gearboxe may remove a vehicle from an event for safety, documentation,
misrepresentation, or policy reasons.

## 10. Partner Services

Potential service categories, subject to founder review during the partnership
phase, include:

1. VIN decoding and recall data
2. Vehicle-history report access
3. Pre-purchase inspection booking
4. Title and registration assistance

No partner or service category is approved by this operating model. Before an
integration is selected, the founder will review its customer value, provider,
commercial structure, implementation approach, data sharing, support ownership,
and regulatory implications.

An approved service may launch as a tracked referral or concierge-assisted
request before implementing a full API integration. Partner branding, pricing,
responsibility, data sharing, customer support ownership, and referral
compensation must be disclosed.

Escrow, vehicle-purchase payments, financing, insurance binding, warranties,
and transportation are post-MVP services unless a qualified partner assumes
the regulated activity and the legal and operational model is approved.

## 11. Customer Support

Gearboxe owns first-line support for accounts, listings, messaging, moderation,
event registration, and event operations. A partner owns fulfillment questions
for its service, with Gearboxe providing escalation and status visibility.

Pilot support target:

- acknowledge standard requests within one business day;
- prioritize payment, safety, fraud, and account-access incidents; and
- retain an auditable record of support and moderation actions.

## 12. MVP Non-Goals

The first production release does not include:

- Gearboxe custody of vehicle-purchase funds;
- an internal Gearboxe escrow product;
- direct lending or credit decisions;
- direct insurance underwriting or binding;
- guaranteed vehicle condition or seller representations;
- dealer inventory;
- nationwide launch;
- native mobile applications; or
- automated approval without human review.

## 13. Pilot Success Measures

The pilot should measure:

- approved listings and approval turnaround time;
- listing completion and photo-upload completion rates;
- buyer-to-seller conversation starts;
- seller response rate and time;
- reported or removed listings;
- vehicles marked reserved or sold;
- event registration conversion;
- payment and webhook failure rate;
- event attendance and check-in success;
- support volume and response time; and
- partner-service request and completion rates.

## 14. Production Launch Gates

The MVP may enter a controlled pilot when:

- the repository has a clean production build and CI pipeline;
- all listing media is durably stored;
- listing, messaging, moderation, payment, and check-in critical paths pass
  automated end-to-end tests;
- reporting, blocking, audit logging, and rate limiting are operational;
- legal terms, privacy disclosures, safety guidance, event terms, and refund
  policies have been approved;
- production monitoring and incident ownership are configured;
- live Stripe and Clerk webhook flows have been verified; and
- staff have completed moderation, support, payment, and event runbooks.

## 15. Approved Founder Decisions

The following decisions were approved for the MVP:

1. Initial launch market: Raleigh–Durham–Chapel Hill, North Carolina
2. Standard marketplace listings are free
3. Initial popup registration price is $49 per vehicle
4. Branded-title vehicles require disclosure and enhanced manual review
5. Full VINs are public on approved listings
6. Event refunds are available until seven calendar days before the event
7. Gearboxe remains outside the vehicle-purchase fund flow for the MVP
8. All other defaults in this operating model are approved

Partner selection is intentionally deferred. Each partner and service category
requires founder review during the partnership implementation phase.
