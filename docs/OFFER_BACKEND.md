# Private offer operations

The founder-approved [offer lifecycle](OFFER_LIFECYCLE_DRAFT.md) governs prices, actions, deadlines, and the public meaning of Reserved. The private Convex functions live in `apps/web/convex/offers.ts`. The ordinary conversation remains the link between buyer, seller and vehicle across separate negotiations.

## Configuration and rollout

`OFFERS_ENABLED=true` enables participant and support deal-changing mutations in Convex. Missing, false, or other values keep them disabled. The corresponding web build flag is `NEXT_PUBLIC_OFFERS_ENABLED=true`. Reads, support audits, status reconciliation and deletion continue when writes are disabled.

Set Convex `OFFER_REVIEWER_USER_IDS` to the comma-separated Convex user IDs of the founder and trained backup. These accounts must have active admin or super-admin roles. Due reservations enter `offers.reviewQueue` even with an incomplete recipient roster. The alert contains generic copy. To inspect private terms or the action history, use `offers.inspectForSupport` with the thread ID and a case reason. Each page of results creates a separate audit record. Operators can handle ordinary reports through the existing listing, account, and conversation safety tools.

Before enabling public traffic, verify effective Terms and Privacy versions, private notification delivery and opt-outs, operator coverage, deletion in the serving database, the retention of backups/exports, and the isolated browser journey including a competing acceptance. Keep the flags disabled in production until those checks are complete.

## Transactions and jobs

The buyer enters whole dollars. The backend validates $1–$100,000,000 before converting to integer cents. A submit request ID belongs to its authenticated buyer and price/listing. A repeat returns the same thread. All other participant mutations require the last observed thread version. The recipient can respond to the current proposal until its exact expiry timestamp. A buyer can withdraw their own unanswered proposal. Basic spam controls allow 20 proposal writes per account and 100 per listing per ten-minute window. Both new proposals and counteroffers consume these limits.

An acceptance transaction reads the vehicle, the private offer cycle shared by all prospective buyers of that vehicle, and the current proposal. It reserves the listing, records the winning thread and agreed price, updates discovery, enqueues notifications, and schedules the reservation check together. The vehicle and search rows contain the public listing price alone. Existing manual reservations retain their own listing workflow.

At day seven, the seller receives a reminder and the founder/backup queue receives one pending review. The listing stays reserved. The seller has one seven-day self-extension. Subsequent extensions require an authorized support actor and a reason. Canceling the agreement leaves its public state Reserved and retention open until the seller or an authorized moderator chooses Sold or Available. Returning the unedited listing to Active starts a new 45-day availability period. Closing the cycle immediately invalidates prior proposals before the bounded history cleanup runs. A fresh offer uses a new thread.

A block between the two participants stops new offer negotiation. It does not trap an accepted, nonbinding agreement: either participant may cancel it, and the seller may still choose Sold or Available for the listing. Suspended accounts remain subject to account access controls; authorized support can resolve a held reservation.

Proposal expiry jobs carry the proposal version. Review jobs carry the reservation thread ID and expected due time. A one-minute recovery cron catches overdue work. A late job cannot change a replacement proposal or reservation. Server reads and response mutations apply the exact deadline even while a scheduled job is outstanding.

## Closure and retention

An unanswered proposal closes at expiry, decline, withdrawal, or the effective closure of its listing cycle, whichever applicable event occurred first. Sale, removal, and seller-controlled release close the accepted thread. A delayed listing availability check uses the actual 45-day deadline. A reservation awaiting outcome stays open across missed reviews.

Closed history expires six UTC calendar months after closure, preserving time of day and clamping month ends. A scheduled purge removes proposal/action records, privileged access records, linked inbox and outbox records, then the private thread with its price, identities, request key and reservation details. Long histories resume in bounded transactions. The recovery cron also sweeps overdue records. Participant and support offer reads enforce the cutoff during delayed deletion. Reopening a listing creates a new cycle and leaves the original purge date intact. The independently retained conversation and its ordinary messages follow the messaging policy. The prospective engagement metric stores a private buyer–listing pair, seller ID, first contact source and timing for deduplication and response reporting. It contains no offer price or action history. Those metric records have a separate cutoff six calendar months after the first inquiry, independent of offer closure. The operator must verify both retention workflows under the approved Privacy Policy.

Backing up the database creates a separate copy. Before launch, inventory provider backups, operator support exports and access logs against the approved Privacy Policy. Record the actual backup expiry, secure export disposal, and restoration steps. On restoration, keep the deployment private and run due lifecycle reconciliations and purges before reopening reads. Private terms must stay out of ordinary support notes, exports and delivery-provider payloads unless covered by the approved process. Hosted backup disposal and provider-side retention require operational verification.

## Verification

Run `pnpm --filter @gearboxe/web exec node --experimental-strip-types --test scripts/offers.test.mjs`, then `pnpm check`. The backend tests exercise authorization, private access, stale mutations, acceptance write conflicts, calendar boundaries, due reviews, suspension, moderation, public projections and multi-batch deletion.

For GBXMRKT-3, use an isolated Convex environment with real Clerk identities. Submit two private buyer proposals on one approved listing, attempt both acceptances concurrently from independent clients, and query both threads and the vehicle after both responses. Exactly one thread should be reserved. Verify that the parked participant sees only their own terms. The anonymous vehicle page should show Reserved and its listing price. Test release, a fresh negotiation, notification delivery, and the deletion boundary with isolated fixtures before sign-off.
