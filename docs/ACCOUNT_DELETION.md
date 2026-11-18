# Account deletion implementation status

GBXMRKT-46: Clerk's `user.deleted` webhook now leaves a stable, scrubbed user tombstone. This keeps participant references intact and prevents an old session or a delayed Clerk upsert from restoring access. A delete event that arrives before a create event also creates a tombstone. Repeated delete events safely reschedule cleanup.

Public listing and wanted-request reads check the owner's tombstone immediately. A scheduled, paginated cleanup archives the owner's listings, closes any active offer cycle (including a reserved winner), removes listing media, scrubs the source wanted requests, marks pending seller photo selections stale, and removes saved searches, favorites, recent views, notifications, and email outbox recipient data. It also removes unused ownership upload leases, VIN decode and trust rate-limit records, blocks created by the deleted user, and unattached private photo uploads. Private message text, wanted conversation snapshots, and photos already attached to messages stay accessible only to the surviving participant. In-flight private photo processing checks the tombstone before completing. New messages and offers involving the deleted user are rejected, and conversation views use “Deleted account.”

Email delivery checks the user's tombstone once when claiming an outbox row and again immediately before calling the provider. A deletion committed after that final check may still race with an in-flight provider call; provider cancellation cannot be guaranteed after submission.

The founder directed us to preserve consent records, payment records, safety reports, and administrator audit logs pending Privacy Policy review. The approved six-month closed-offer action purge remains independent of account deletion. No final retention period is asserted for the preserved records here.

## Work still required before closing GBXMRKT-46

- Audit and remove or anonymize other account-linked records, including ownership evidence, identity reviews, blocks created by other users against the deleted account, event records, and other users' references to removed listings. The current cleanup covers the primary public surfaces and transient account data but is not a full personal-data inventory. Ownership evidence retains its existing 30-day expiry pending the final privacy review.
- Establish final retention and access rules for private messages/photos, wanted conversation snapshots, consent, payments, safety cases, and audit records in the approved Privacy Policy. Verify that provider exports and backups follow that decision.
- Verify deletion against a deployed isolated backend, including webhook replay/order, active sessions, paginated cleanup after interruptions, stale media URLs, and participant-only history. The local test covers multiple cursor pages after earlier rows are removed; a hosted interruption/retry remains unverified. A repeated `user.deleted` webhook reschedules cleanup, but a documented operator recovery path is still needed if scheduled jobs repeatedly fail.

Local checks: `pnpm --filter @gearboxe/web typecheck` and `pnpm --filter @gearboxe/web exec node --experimental-strip-types --test scripts/account-deletion.test.mjs`.
