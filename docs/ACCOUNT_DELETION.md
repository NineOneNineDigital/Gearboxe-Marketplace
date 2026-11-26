# Account deletion implementation status

GBXMRKT-46: Clerk's `user.deleted` webhook now leaves a stable, scrubbed user tombstone. This keeps participant references intact and prevents an old session or a delayed Clerk upsert from restoring access. A delete event that arrives before a create event also creates a tombstone. Repeated delete events safely reschedule cleanup.

Public listing, wanted-request, and comparison-link reads check the owner's tombstone immediately. A scheduled, paginated cleanup archives the owner's listings, closes any active offer cycle (including a reserved winner), removes listing media, scrubs the source wanted requests, deletes comparison links, marks pending seller photo selections stale, and removes saved searches, favorites, recent views, notifications, and email outbox recipient data. It also removes unused ownership upload leases, VIN decode and trust rate-limit records, blocks created by the deleted user, and unattached private photo uploads. Private message text, wanted conversation snapshots, and photos already attached to messages stay accessible only to the surviving participant. In-flight private photo processing checks the tombstone before completing. New messages and offers involving the deleted user are rejected, and conversation views use “Deleted account.”

Email delivery checks the user's tombstone once when claiming an outbox row and again immediately before calling the provider. A deletion committed after that final check may still race with an in-flight provider call; provider cancellation cannot be guaranteed after submission.

The founder directed us to preserve consent records, payment records, safety reports, and administrator audit logs pending Privacy Policy review. The approved six-month closed-offer action purge remains independent of account deletion. No final retention period is asserted for the preserved records here.

## Account-linked record inventory

| Record class | Current deletion behavior | Remaining decision or check |
| --- | --- | --- |
| Public listings, wanted requests, comparison links, and listing media | Tombstone hides public reads immediately; bounded cleanup removes public content and media. | Verify direct links and search indexes against the isolated backend. |
| Private conversation text and attached photo replies | Retained for the surviving participant as read-only history; unrelated accounts stay denied. | Confirm final Privacy wording and hosted participant access. |
| Favorites, saved searches, recent views, notifications, outbound email recipient details, upload leases, rate limits, and blocks created by the deleted account | Removed or scrubbed in bounded cleanup. | Rehearse interruption and restart on an isolated backend. |
| Blocks created by other users against the deleted account | Currently retained; these rows may represent another user's safety preference. | Decide whether and when to remove the now-inert reference in the Privacy retention review. |
| Ownership documents and identity reviews | Existing evidence expiry and access rules continue; deletion cleanup does not purge them. | Decide record and storage retention with the final Privacy policy. |
| Consent records, payment/event records, safety reports, and administrator audit logs | Preserved under the founder's interim direction. | Set final retention and access rules; inspect provider exports and backups. |
| Closed structured-offer action history | Existing six-calendar-month purge remains separate from account deletion. | Verify the scheduled purge on isolated staging. |

This inventory describes the current implementation; it is not a published retention promise. Do not delete the unresolved record classes merely to make a cleanup run appear complete.

## Work still required before closing GBXMRKT-46

- Audit and remove or anonymize other account-linked records, including ownership evidence, identity reviews, blocks created by other users against the deleted account, event records, and other users' references to removed listings. The current cleanup covers the primary public surfaces and transient account data but is not a full personal-data inventory. Ownership evidence retains its existing 30-day expiry pending the final privacy review.
- Establish final retention and access rules for private messages/photos, wanted conversation snapshots, consent, payments, safety cases, and audit records in the approved Privacy Policy. Verify that provider exports and backups follow that decision.
- Verify deletion against a deployed isolated backend, including webhook replay/order, active sessions, paginated cleanup after interruptions, stale media URLs, and participant-only history. The local test covers multiple cursor pages after earlier rows are removed; a hosted interruption/retry remains unverified.

## Operator recovery for a failed cleanup page

Confirm the target account is already tombstoned and identify the failed scheduled cleanup job in the deployment logs. A repeated `user.deleted` webhook reschedules cleanup, but deployment operators can also invoke the internal `accountDeletion:restart` mutation against the intended deployment with a 10–500 character incident reason. For an isolated deployment, the command shape is:

```sh
pnpm --filter @gearboxe/web exec convex run --deployment-name <deployment-name> accountDeletion:restart '{"clerkUserId":"<deleted-clerk-user-id>","reason":"Cleanup page failed during incident review"}'
```

The function refuses a missing or live account, writes `account_deletion_cleanup_restarted` to `adminAuditLog`, and schedules cleanup again from the first phase. The phases are repeatable; attached private conversation photos and preserved records are not deleted by a restart. Check the scheduled jobs and public projections afterward. Do not use the restart entry point to initiate an account deletion; the signed Clerk `user.deleted` webhook establishes the tombstone.

Local checks: `pnpm --filter @gearboxe/web typecheck` and `pnpm --filter @gearboxe/web exec node --experimental-strip-types --test scripts/account-deletion.test.mjs`.
