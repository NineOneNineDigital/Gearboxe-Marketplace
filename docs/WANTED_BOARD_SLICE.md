# Wanted board: GBXMRKT-43 slice

The public `/wanted` board shows active requests with a general city and state, budget, radius or Nationwide, optional criteria, and a Report control. The query explicitly projects public fields and omits the buyer's ZIP and identity. A signed-in account with verified email can post and edit from `/myAccount/my-requests`. Public text validation rejects the private ZIP and obvious contact information. Creation uses the shared fixed daily rate window for five new requests per account; edits and renewals do not consume that quota.

Requests expire 30 days after creation or a Still looking action. A minute-level sweep marks them expired so subscribed boards update; public reads also check the deadline directly. Expired and closed requests appear only in the owner's Past list. A scheduled job fires three days before expiry, with an hourly recovery sweep. It creates one in-app notification and, subject to notification preferences, one email outbox event. Reminders use the expiry timestamp in their dedupe key so renewal starts a new cycle. Deletion hides a request from the board and owner list while retaining its row as a soft-deleted reference.

## Follow-on dependencies

- GBXMRKT-44 must implement request-based conversations and snapshot title, budget, and criteria at the first participant interaction. Current conversations are vehicle-based, so the board does not yet let sellers contact buyers or preserve a request conversation after deletion.
- GBXMRKT-46 account deletion and retention policy must decide when soft-deleted request rows and private ZIP values can be purged after participant snapshots exist. Do not treat the current soft delete as full data erasure.
- Reports enter the existing trust queue with `wantedRequestId` and a safe request summary. Administrators can take down a request from the report case; the owner is notified and cannot republish that request through edit or renewal. Account suspension also removes that account's active wanted requests. A separate restoration workflow is not included; the owner may appeal through Safety & support.
