# Environment, release, and rollback runbook

## Current status

The checkout is linked to `NineOneNineDigital/Gearboxe-Marketplace` on GitHub.
The feature application was merged through `dev` into `main` at `42548b01`, and
a Vercel project is linked. The last observed Production deployment attempt
failed during the deployment-target check because `MARKETPLACE_ENV` was missing;
this runbook does **not** establish a healthy public production service. Current
Vercel/Convex/Clerk/Autosend configuration and domain routing still need
environment-by-environment verification under [GBXMRKT-1](https://linear.app/mxndev/issue/GBXMRKT-1/configure-marketplace-hosted-environments-and-recover-failed-main).
The observed `main` merge triggered that Production attempt; recheck the project's
current production-branch mapping before any future merge or release.
The marketplace's intended canonical origin is `https://gearboxemarket.com`;
DNS and successful domain assignment have not been verified here. The follow-on
work was merged into `dev` through [PR #9](https://github.com/NineOneNineDigital/Gearboxe-Marketplace/pull/9)
at `0599e55c` on November 25, 2026. GitHub CI passed on head `ea5d600b`;
the PR branch Preview failed the intentional `dev`-only build guard. The existing
Vercel project's `dev` Preview deployed successfully at `0599e55c` and serves
inventory and the Wanted board against shared development Convex `dev:intent-setter-978`.
Signed-in buyer favorite and synthetic-seller message writes passed on the earlier
`faf33d94` Preview; full new-feature, upload, seller, and moderator journeys remain
unverified. Vercel Authentication required login on November 25; a cookie-free request
redirected to Vercel sign-in. The separate staging Vercel project
should not auto-deploy `dev`.
For the shared-dev Preview, set `NEXT_PUBLIC_APP_URL` to its stable protected
origin; hosted builds preserve that origin for share links and metadata even
when Vercel assigns a one-off deployment hostname.
Never treat a green build as proof that auth, notifications, or deployment wiring works.

## Environment isolation

| Environment | Vercel | Convex | Clerk | Popup payments |
| --- | --- | --- | --- | --- |
| Development | Local app | Developer deployment in non-production project | Development app/test instance | Disabled for marketplace; sandbox keys only for later event work |
| `dev` Preview (shared dev backend) | Existing Vercel project, Preview environment | Existing non-production `dev:` deployment, shared with local development | Existing development Clerk app/test accounts | Disabled; test keys only when later enabled |
| Other branch Preview | Existing Vercel project, Preview environment | Isolated branch preview in non-production project, if provisioned | Dedicated preview app/test instance, if provisioned | Disabled; test keys only when later enabled |
| Production | Linked production project, Production environment | Production project's production deployment | Production app/live instance | Disabled; live keys only for a separately approved event rollout |

The founder chose to share the existing non-production Convex development deployment
and Clerk development app with the `dev` Preview. This keeps production data
and accounts out of Preview, but Preview and local development will see the same
test accounts and backend data. `dev` is also the source-code branch; distinguish
that branch name from the Convex `dev:` deployment type.
Do not copy production users, listings, payment records, or secrets into non-production.
Use synthetic test accounts/data. Never use the sample-data seeder in staging or production.

## `dev` Preview source and first build

Use the existing `gearboxe-marketplace` Vercel project. Keep `main` as its
Production branch; `dev` must be a Preview deployment with `VERCEL_ENV=preview`
and `MARKETPLACE_ENV=preview`. Scope shared-development variables to the `dev`
Preview branch only. Vercel supports [branch-specific Preview variables](https://vercel.com/docs/environment-variables#preview-environment-variables).
Disable the separate staging project's `dev` auto-deployment before relying on
this path. PR #9 was merged into `dev` at `0599e55c`.

1. Inventory the existing development Convex deployment and Clerk application
   identities without copying or printing their keys. Confirm that both contain
   only synthetic non-production accounts/data. Verify Vercel Preview deployment
   protection in the existing project before exposing the shared development backend;
   allow only approved testers. A public Preview URL would permit outsiders to sign up and mutate
   development data even though some uploads are blocked by `APP_URL`.
2. Treat the shared backend as a deliberate coupling: local development and the
   `dev` Preview web app use the same functions, data, Clerk users and webhooks. A
   backend push from either workflow can affect the other. Record the exact
   backend version and coordinate updates before each browser run.
3. The committed `vercel.json` calls `build:deploy`. Set
   `STAGING_SHARED_DEV_BACKEND=true` only for the `dev` Preview branch to
   select its guarded **frontend-only** path. The guard requires the `dev` Git
   branch, `MARKETPLACE_ENV=preview`, `VERCEL_ENV=preview`, a `dev:`
   `CONVEX_DEPLOYMENT` matching `NEXT_PUBLIC_CONVEX_URL`, test Clerk keys, and a
   Vercel Preview URL plus a non-production `NEXT_PUBLIC_APP_URL`. Do not set `CONVEX_DEPLOY_KEY` or
   `EXPECTED_CONVEX_DEPLOYMENT` in the `dev` Preview scope. This path builds the web app but
   does not deploy or validate the backend. Do not bypass the production/preview
   target guard by changing its environment values.
4. Configure the existing Vercel web project's `dev`-specific Preview scope with the shared
   dev Convex URL/site URL, development Clerk keys, a stable `dev` Preview origin
   as `NEXT_PUBLIC_APP_URL`,
   disabled popup/offer switches as appropriate, and no production secrets.
   The earlier staging project's Production-scoped variables do not transfer
   automatically; verify their names and the new branch scope before deployment.
   Set Node 22, root directory `apps/web`, and workspace file access. The
   backend's `APP_URL` currently names one allowed web origin for several upload
   flows. The founder selected a build and browsing preview first; do not claim
   full auth/upload journey coverage from this Preview.
5. Before merging into `dev`, review backend compatibility with the currently
   serving development frontends and update the shared backend from the reviewed
   candidate with `pnpm --filter @gearboxe/web exec convex dev --once` only after
   verifying the CLI targets the intended `dev:` deployment. This affects local
   development immediately. Record the backend code reference and verify its
   required functions. Then merge the candidate into `dev` after its technical
   checks pass so the auto-tracking Vercel frontend builds against that
   backend version. Capture the `dev` Preview URL, frontend commit SHA and
   shared Convex deployment identity. A passing GitHub CI build alone is
   insufficient.
6. Verify the existing development Clerk webhook targets that same Convex site
   URL. Use synthetic test accounts and run only browser checks supported by the
   shared-origin configuration in [the browser test plan](BROWSER_TEST_PLAN.md).
   Confirm access protection is active before sharing the staging URL.
   Keep destructive cleanup scoped to tagged fixtures so ordinary dev work is
   preserved. Record both frontend and backend versions and test results.

The shared development backend now has `APP_URL=http://localhost:3000` and
`DEV_PREVIEW_APP_URL=https://dev-gearboxe-marketplace.vercel.app` after the
reviewed PR #9 backend update. The vehicle upload preflight returned 204 for
the exact Preview origin and 403 for an unrelated origin. This adds one HTTPS
origin for vehicle media, private ownership documents, wanted-reply photos,
and photo-request replies without
changing email-link origins or creating another backend. Malformed, wildcard,
foreign, and production-domain values fail closed. Vercel Authentication is
required; use disposable development accounts for upload tests.

Other PR Previews are a separate lane: they require `MARKETPLACE_ENV=preview`, a
Preview-scoped `preview:` Convex deploy key from a non-production project, and a
dedicated preview Clerk app/webhook if authenticated flows are to work there.
Do not put a production deploy key in Preview scope just to clear a failed PR
check. Keep `STAGING_SHARED_DEV_BACKEND=true` branch-specific to `dev`; otherwise
other PR Previews will enter the guarded path and fail.

Clerk recommends a separate application for staging; the chosen shared development
application accepts coupling with local development while excluding production data:
[Clerk environments](https://clerk.com/docs/guides/development/managing-environments).
A staging production instance with its own custom domain is supported (live Clerk keys,
**test Stripe keys**); development and previews require test Clerk keys.
Prefer isolated [Stripe sandboxes](https://docs.stripe.com/sandboxes) when the later popup release is tested.

## Provisioning checklist — owner actions still required

1. Review, commit, and push changes to the linked GitHub repository. Protect `main`:
   require PR review and the `Lint, types, tests, and builds` CI check, restrict
   direct pushes and bypasses. CI must run successfully on an actual PR.
2. Verify the shared development Convex resource and the distinct production resource.
   Record project/deployment IDs, region, owner, and URLs in the private operations inventory.
   Enable appropriate backups and confirm export access. Do not run `convex deploy`
   relying on a developer's default target: it defaults to that project's production deployment.
3. Verify the shared development Clerk application and the distinct production instance.
   Configure a Clerk JWT template named `convex`, matching each backend's issuer.
   Configure custom domains for production Clerk and the marketplace.
4. Verify the linked Vercel project rooted at `apps/web` with `main` as Production
   and `dev` as Preview. Use Node 22,
   include workspace files outside the root directory, and retain the committed
   `vercel.json` build/install commands with the guarded shared-dev mode above.
   Deploy the unified administration portal
   as a separate project rooted at `apps/admin`, using the same backend's
   Clerk and Convex configuration from `apps/admin/.env.example`. Set
   `NEXT_PUBLIC_APP_URL` to that environment's public web origin and set
   `NEXT_PUBLIC_ADMIN_PORTAL_URL` on the web project to the portal origin. Portal
   Market routes require an active admin role; Events routes require that role or
   an individual event assignment. The admin project does not deploy the
   marketplace backend.
5. Review the existing production Git deployment behavior and keep future production
   deployment manual until the staging release gate passes. Disable automatic
   production Git deployment in Vercel project settings if it is still enabled.
   Enable `dev`/PR deployments only for trusted contributors; require approval
   for fork/external PRs. Build-only GitHub CI deliberately has no deploy secrets.
6. Configure environment-scoped values below. Production secrets belong only to the
   project's Production scope, never Preview or Development. The `dev` branch's
   Preview variables are test values and require no deploy key in frontend-only
   mode. Other branch Previews require a preview key when deploying Convex.
7. Configure Clerk user-created/updated/deleted webhooks directly to each backend's
   `https://DEPLOYMENT.convex.site/clerk-users-webhook`. Use its signing secret.
   Each fresh branch preview needs its own Clerk endpoint before user sync works;
   removing the preview also requires removing that endpoint. No automatic webhook
   provisioning is implemented. Test sign-up and synchronization before approval.
8. For the later popup release only, configure Stripe `checkout.session.completed`
   webhooks to each frontend's `/api/webhooks/stripe`, with the endpoint's matching
   signing secret and mode. Dynamic previews need separate test endpoints before
   paid flows can be tested. Preserve credentials and reconciliation for any
   historical event payments when disabling new registrations, including completed
   registrations that may still be eligible for cancellation and refund.
9. Provision the first super-admin using the controlled procedure below. Verify a
   second approved super-admin for recovery, account MFA, and operator access.
10. Deploy `dev` Preview, perform the smoke checklist, record the exact tested commit,
    then manually build that **same commit** with production configuration.
    Do not promote a staging artifact to production: its public URLs/keys are baked in.

## Configuration contract

Start from `apps/web/.env.example`; it contains placeholders, not working credentials.
Offers default to disabled. Set `NEXT_PUBLIC_OFFERS_ENABLED=true` on the web build and `OFFERS_ENABLED=true` on its matching Convex deployment only after the approved Terms and Privacy Policy and six-month offer-history deletion have been verified. Leave both disabled until those launch gates are met. Configure `OFFER_REVIEWER_USER_IDS` in Convex as a comma-separated list of active administrator Convex user IDs for founder/backup day-seven escalation. Without a roster, the durable admin queue remains available but no direct reviewer notice is sent.

Set `MARKETPLACE_ENV` explicitly on every hosted frontend/backend. The shared
development Convex backend remains `MARKETPLACE_ENV=development` while the
`dev` Vercel Preview uses `MARKETPLACE_ENV=preview`; the frontend-only build
does not run a matched backend readiness check. Local `next dev`
defaults to development; local `next start` requires an explicit mode and runtime secrets.
Set `NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED=false` on both the web and matching Convex
deployment for the marketplace release. Omitted or literal `false` disables new
public popup flows; literal `true` is reserved for an approved, separately tested
event release. Invalid values fail validation. A mismatch between web and Convex
must fail readiness rather than expose a web-only gate.

Web build: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_APP_URL`.
Web runtime also requires `CLERK_SECRET_KEY`. When popup payments are enabled,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`EVENT_REGISTRATION_PRICE_CENTS` are required; supplied values are validated
even while disabled.
Convex requires `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SECRET`, `APP_URL`, and
`MARKETPLACE_ENV`; the same popup-payment values are required there only when
the popup switch is enabled. Marketplace email delivery uses
`AUTOSEND_API_KEY`, `AUTOSEND_FROM_EMAIL`, and `AUTOSEND_WEBHOOK_SECRET` in the
Convex deployment, a verified sender, the correct `APP_URL` and
`CONVEX_SITE_URL`, and a delivery webhook. Validate delivery and suppression in
isolated staging before claiming notifications work. See [Notifications](NOTIFICATIONS.md).
When popup payments are disabled, existing held reservations, paid or unsettled
payment records, completed or refund-pending registrations, and unfinished
webhook records still require matching Stripe API and webhook credentials in
**both** web and Convex. The release readiness action checks for this work using
indexed reads and rejects missing credentials. Keep the webhook endpoint active
until reconciliation and possible refunds are complete. Removing keys or disabling
the provider endpoint before deploying bypasses that check temporarily; verify
the current payment queue and preserve credentials before changing either
environment. The readiness check runs **after** the backend deploy, so a failed
check is a stop signal requiring immediate configuration repair, not a guarantee
that no temporary recovery gap occurred. No new checkout is opened while the
popup switch is off.
No client Stripe publishable key is currently consumed: Checkout redirects are server-created.
When events are later enabled, the event price must be the approved positive
integer USD-cent amount and match between web and backend. Key prefixes do not
prove a key is valid or belongs to
the intended account; verify account IDs and modes during provisioning and smoke tests.

Vercel deploy credentials for backend-deploying projects: `CONVEX_DEPLOY_KEY` and, for dedicated staging/production,
`EXPECTED_CONVEX_DEPLOYMENT` (exact deployment name). Scope the key to the minimum
permissions needed for deploy and internal readiness execution. Other branch Preview scope
uses a `preview:` key from the non-production project. Dedicated staging/production use
`prod:DEPLOYMENT|...` keys belonging to their respective projects. The selected
shared-dev `dev` Preview uses no Convex deploy key and cannot update the backend.
Legacy unscoped
keys are intentionally rejected by the wrapper. Never put deploy keys in browser variables.
The old global `@secret` references in `vercel.json` have been replaced with
environment-scoped Vercel settings; re-enter the appropriate per-environment values
when configuring the projects. The Stripe webhook's existing 30-second limit is retained.

The build wrapper follows [Convex's Vercel deployment flow](https://docs.convex.dev/production/hosting/vercel):
Convex injects the backend URL into the frontend build; the wrapper derives the
matching site URL and the preview's app URL. Next.js validates hosted configuration
before compilation and runtime configuration when each Node server starts. Secret-free
CI (`MARKETPLACE_ENV=ci`) is allowed only during non-hosted builds, never server startup.
The deployment wrapper invokes the internal backend readiness check after deploying;
failure blocks publishing the new frontend but **does not undo the backend deployment**.
Keep backend changes backward-compatible with the currently serving frontend.

## First production super-admin

Only a trusted Convex operator can run this **internal** mutation; it is not
exposed to the browser. Do not seed fake accounts or manually create a user row.

1. Have the approved owner create a real account in the correct Clerk instance.
   Require MFA and verify identity/email in Clerk. Confirm its webhook-synchronized
   Convex user row and exact Clerk ID. The current application does not enforce
   admin MFA itself; enforce the account policy in Clerk before launch.
2. On the explicitly selected backend, temporarily set
   `BOOTSTRAP_SUPER_ADMIN_CLERK_ID` to that exact Clerk ID via the Convex dashboard.
3. From `apps/web`, with the approved operator credentials, run (replace placeholders):

   ```bash
   pnpm exec convex run --deployment-name EXACT_DEPLOYMENT users:bootstrapSuperAdmin '{"clerkUserId":"user_APPROVED","expectedEmail":"approved-owner@example.com","reason":"Approved initial provisioning: change ticket ID"}'
   ```

4. The transaction requires the allowlist, synchronized matching email, audit reason,
   and **no existing super-admin**. It promotes only that user and writes `adminAuditLog`.
   Record the executing operator/change ticket externally; the audit source is
   `deployment-operator`, not a falsely inferred human identity. Remove the temporary
   allowlist immediately, even if provisioning fails, and verify `/admin` access.
5. Additional super-admins must be promoted by the existing super-admin through
   authorized role-management flows. Bootstrap is not an ongoing recovery backdoor.
   If all administrators are lost, use a separately approved, audited recovery incident;
   do not weaken the bootstrap checks or erase audit evidence.

## Release gates

- CI: lint with zero warnings, workspace types, configuration/provisioning tests,
  shared-token tests, and builds on every PR.
- Staging: verify deployed commit SHA, backend/frontend environment and account IDs,
  matching disabled popup switch; signup/login/logout, policy version consent and
  user webhook sync; public Active/Reserved listings, ZIP discovery and VIN;
  pending/private listing authorization; seller creation with five required photos;
  buyer messaging, offers and single-accept reservation; favorites; admin moderation,
  support and notifications. Verify anonymous/non-admin denial and that direct
  popup routes/mutations cannot start a new registration or checkout.
- Production: record founder go/no-go, approver, SHA, prior Vercel deployment ID, prior Convex code
  SHA, backup reference, configuration revision, and rollback compatibility before
  deployment. Validate backend readiness; repeat auth/listing/admin smoke checks.
  Marketplace launch does not require a live event charge. Test any later live
  popup charge only under a separately approved event release plan.
- Record deployment URLs/IDs, results, release timestamp, and operator in the
  private release log. This repository contains no completed release evidence yet.

## Secret ownership and rotation

| Credential | Accountable owner role | Storage / consumers |
| --- | --- | --- |
| Convex deploy keys | Platform/release owner | Vercel environment secrets; approved operator vault |
| Clerk secret/API and webhook keys | Identity/security owner | Vercel secret key; Convex webhook signing secret |
| Stripe API and webhook keys, if popup events are enabled | Payments owner | Matching Vercel/Convex API keys; Vercel endpoint signing secret |
| Autosend API, sender, and webhook keys | Notifications owner | Convex environment and verified sender configuration |
| GitHub/Vercel access and DNS | Platform owner | Provider access controls and team password manager |
| Bootstrap allowlist | Security owner | Temporary Convex environment variable; remove after use |

The project owner must assign named primary/backup people before go-live. No shared
personal logins; use least privilege and MFA. Never commit keys, echo values in logs,
paste credentials into issues, or upload `.env.local` as CI artifacts. Public keys/URLs
are identifiers, not substitutes for authorization. Keep production credentials out
of local developer environments.

Rotate on suspected exposure, operator departure, and the owner's documented review
schedule (recommended review every 90 days). Create the replacement in the correct
account, update **all consumers** (Stripe API key in both web and Convex), redeploy
frontends, run readiness and smoke tests, then revoke the old key. For webhook
secrets, use provider-supported overlap/rollover where available and retain retries
during the change; otherwise schedule a controlled switch, monitor failures, and
replay failed events after validation. Record key IDs and dates, never values.
Rollback must use current unrevoked secrets, not restore leaked credentials.

## Rollback procedure

1. Incident owner freezes new releases and records failing SHA, errors, affected
   flows, and last healthy frontend/backend pair. Restrict writes if data
   integrity is at risk; do not blindly replay historical charges or run data restoration.
2. For a frontend-only regression, use Vercel's dashboard rollback to the recorded
   healthy deployment **from the same environment**, or `vercel rollback URL_OR_ID`
   with a linked, approved operator CLI. Confirm the backend remains compatible.
   [Vercel rollback](https://vercel.com/docs/deployments/rollback-production-deployment)
   changes frontend routing; it does not roll back Convex data/functions or secrets.
3. For a backend regression, prefer a reviewed forward fix. If necessary, deploy
   the previously recorded compatible Convex commit from an isolated checkout using
   the exact environment-scoped deploy key and `pnpm exec convex deploy --yes` from
   `apps/web`; retain current schema if old code would reject newer data. Review
   schema/index changes first. Never force schema deletion or import an old database
   merely to make old code deploy. Coordinate both frontend and backend rollback.
4. A data recovery requires a separate approved restore plan with backup verification,
   rehearsal in isolated staging, and reconciliation of Stripe payments, Clerk users,
   messages, and writes after the backup. Blind snapshot restoration risks lost sales
   and duplicate registrations. No automatic destructive restore is provided.
5. Verify login, Clerk webhook sync, public listings, ZIP search, authorization,
   messaging, offers, and moderation. Confirm new popup registration and checkout
   remain disabled. Continue monitoring and reconciling any historical event
   payment/webhook work without making it a marketplace launch gate.
6. Record incident timeline/results, restore release controls, and rehearse this
   procedure in staging **before** the first production launch. A documented procedure
   is not a tested recovery plan until that rehearsal is recorded.

For the later popup release, event checkout, inventory initialization, webhook subscriptions, automatic refunds,
and payment recovery follow [Event payments](EVENT_PAYMENTS.md).
Event staff assignments, historical roster/attendance migrations and on-site
connectivity checks follow [Popup operations](POPUP_OPERATIONS.md).
