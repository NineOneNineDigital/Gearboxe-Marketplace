# Messaging and notifications

## Account behavior

The Notifications link in the account menu opens `/myAccount/notifications`.
The inbox uses cursor pages of 20 updates, with individual mark-read controls.
Email preferences have a global switch and separate categories for messages,
listing updates, favorites, and events. All categories default to enabled.
Disabling email does not remove in-app updates. Suspended users can still read
their inbox and manage email preferences. Email is sent only to verified email
addresses on accounts that are not suspended.

Message sender and inbox ownership come from the authenticated Convex identity.
Conversation access requires participation. Threads load older messages through
cursor pagination. A block in either direction prevents contact; the message
thread also exposes report and block controls. Sending is limited to 30 messages
per minute and 10 new conversations per hour per sender. Repeating the same
message within a minute is rejected. Messages contain 1–2,000 characters.

New-message email contains a generic notice and an authenticated conversation
link rather than the private message body. Seller listing approval and rejection
produce email; draft and pending-submission updates remain in-app. Favorite
listing status changes notify followers. Successful event payments and check-in
confirmations notify the registration owner. Event keys prevent duplicate
notifications for repeated processing of the same event.

## Autosend configuration

Configure these secrets and settings in the **Convex deployment**, not the
browser environment:

- `AUTOSEND_API_KEY`: Autosend transactional API credential.
- `AUTOSEND_FROM_EMAIL`: a sender address on a verified Autosend domain.
- `AUTOSEND_FROM_NAME`: optional sender display name.
- `AUTOSEND_WEBHOOK_SECRET`: the signing secret for the Autosend webhook.
- `APP_URL`: the exact HTTPS marketplace origin in hosted environments.
- `CONVEX_SITE_URL`: Convex HTTP origin, supplied by Convex.

Configure Autosend delivery webhooks to POST to
`https://<deployment>.convex.site/autosend-webhook`. The handler verifies the
raw request body's hexadecimal HMAC in `X-Webhook-Signature` before recording
provider events. Keep the signing secret and provider API key server-side.
Provider setup is described in Autosend's [send API](https://docs.autosend.com/api-reference/mails/send),
[webhook verification](https://docs.autosend.com/others/webhooks/verify-requests),
and [event types](https://docs.autosend.com/others/webhooks/event-type).

Each email includes an unsubscribe link to the Convex HTTP endpoint
`/notifications/unsubscribe`. GET displays a confirmation page; POST confirms
the recipient-bound token and disables all optional email categories globally.
Tokens expire 90 days after the notification was created and stop working if the
account email changes. Link previews therefore do not silently unsubscribe users. The account page can
re-enable email preferences. Delivery workers recheck preferences before sending
queued mail. A permanent bounce or spam complaint suppresses email independently of these
preferences; changing preferences alone does not clear suppression.

## Delivery tracking and recovery

Notifications and their email outbox entries are created in the same Convex
transaction. Scheduled processing tracks `pending`, `sending`, `accepted`,
`delivered`, `deferred`, `bounced`, `complained`, `failed`, `skipped`, and
`uncertain` outcomes. Provider acceptance is distinct from confirmed delivery.
Admins can inspect paginated records at `/admin/notifications`, including the
attempt count, provider reference, safe error code, and next retry time. This
view excludes recipient email addresses and unsubscribe tokens.

Rate-limit responses (HTTP 429) retry with exponential delay, with at most five
attempts. Network failures, HTTP 5xx responses, and abandoned sending leases have
ambiguous outcomes and become `uncertain`. Autosend does not document a send
idempotency contract, so these outcomes require an operator to reconcile the
provider record before arranging a resend. Do not resend an uncertain record
until acceptance has been ruled out. Missing or invalid provider configuration
leaves entries pending for the scheduled sweep; definite provider rejection is
visible as a failed delivery. Fix the cause before recovery. Authenticated
provider events update the outbox and prevent duplicate webhook handling from
creating duplicate application notifications.

After checking provider logs, an operator can invoke internal
`emailRecords.reconcileUncertain` with `id`, `decision: "accepted"` and
`providerId`, or with `decision: "not_sent"` only when absence of acceptance is
confirmed. Supply an incident/evidence reference such as `INC-123` in `reason`.
Reconciliation appends an admin audit entry. A confirmed unsent record can retry
within the five-attempt limit; this function is not exposed to browser clients.

Terminal delivery metadata and webhook event records are deleted after 90 days
by a daily bounded cleanup. Pending, sending, and uncertain records remain until
resolved, including their recipient email snapshot and unsubscribe token if
claimed; operators must triage this backlog. In-app notifications remain with
the account history without automatic expiry. Address suppression remains until
an explicit operator decision; changing email preferences cannot override it.
These records contain generic notification text, never private message bodies,
VINs, ownership documents, precise locations, payment credentials, or QR codes.

## Rollout and validation

Deploy the schema and backend alongside the web changes. Run the internal
`notifications.backfillLegacy` mutation with `cursor: null`, then continue using
each returned cursor until complete to copy existing listing updates into the
unified inbox. It preserves original timestamps and read state and does not send
historical email. The legacy table remains retained during migration.

Before enabling live delivery, use a staging Autosend sender and verify message,
approval/rejection, favorite-status, payment, refund, event-cancellation, and
check-in notifications. Event registration and receipt behavior are documented
in [Event payments](EVENT_PAYMENTS.md). Confirm
global/category opt-out, unsubscribe confirmation, queued-mail preference checks,
blocked contact, duplicate-event handling, 429 retry, uncertain-send recovery,
and signed webhook delivery/bounce/complaint outcomes. Never send test mail to
production recipients as part of local verification.
