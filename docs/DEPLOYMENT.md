# Environment, release, and rollback runbook

## Current status

Repository support is implemented; cloud resources are **not yet provisioned**.
The checkout is linked to `NineOneNineDigital/Gearboxe-Marketplace` on GitHub;
administrator repository access is verified. Changes are not yet pushed, and
there is no linked Vercel project or confirmed hosting/provider connection.
Never treat a green build as proof that auth, payments, or deployment wiring works.

## Environment isolation

| Environment | Vercel | Convex | Clerk | Stripe |
| --- | --- | --- | --- | --- |
| Development | Local app | Developer deployment in non-production project | Development app/test instance | Development sandbox/test keys |
| Preview | PR/branch preview of staging project | Isolated branch preview in non-production project | Dedicated preview app/test instance | Preview sandbox/test keys |
| Staging | Separate staging project, Production environment | Dedicated staging project's production-type deployment | Separate staging Clerk app | Staging sandbox/test keys |
| Production | Separate production project, Production environment | Production project's production deployment | Production app/live instance | Live account/keys |

Convex's deployment **type** `prod` is distinct from the marketplace environment:
the dedicated staging project's `prod` deployment still has `MARKETPLACE_ENV=staging`.
Do not copy production users, listings, payment records, or secrets into non-production.
Use synthetic test accounts/data. Never use the sample-data seeder in staging or production.

Clerk recommends a separate application for staging, not shared production data:
[Clerk environments](https://clerk.com/docs/guides/development/managing-environments).
A staging production instance with its own custom domain is supported (live Clerk keys,
**test Stripe keys**); development and previews require test Clerk keys.
Prefer isolated [Stripe sandboxes](https://docs.stripe.com/sandboxes) for non-production.

## Provisioning checklist — owner actions still required

1. Review, commit, and push changes to the linked GitHub repository. Protect `main`:
   require PR review and the `Lint, types, tests, and builds` CI check, restrict
   direct pushes and bypasses. CI must run successfully on an actual PR.
2. Create distinct Convex development, staging, and production resources as above.
   Record project/deployment IDs, region, owner, and URLs in the private operations inventory.
   Enable appropriate backups and confirm export access. Do not run `convex deploy`
   relying on a developer's default target: it defaults to that project's production deployment.
3. Create the Clerk applications/instances and Stripe sandboxes/live configuration.
   Configure a Clerk JWT template named `convex`, matching each backend's issuer.
   Configure custom domains for production Clerk and the marketplace.
4. Create Vercel staging and production projects rooted at `apps/web`. Use Node 22,
   include workspace files outside the root directory, and retain the committed
   `vercel.json` build/install commands. Deploy the unified administration portal
   as a separate project rooted at `apps/admin`, using the same environment's
   Clerk and Convex configuration from `apps/admin/.env.example`. Set
   `NEXT_PUBLIC_APP_URL` to that environment's public web origin and set
   `NEXT_PUBLIC_ADMIN_PORTAL_URL` on the web project to the portal origin. Portal
   Market routes require an active admin role; Events routes require that role or
   an individual event assignment. The admin project does not deploy the
   marketplace backend.
5. Keep production deployment manual until the staging release gate passes.
   Disable automatic production Git deployment in Vercel project settings.
   Enable staging/PR deployments only for trusted contributors; require approval
   for fork/external PRs. Build-only GitHub CI deliberately has no deploy secrets.
6. Configure environment-scoped values below. Production secrets belong only to the
   production project's Production scope, never Preview or Development. Staging
   Production values are test/sandbox values. Preview uses only the preview key.
7. Configure Clerk user-created/updated/deleted webhooks directly to each backend's
   `https://DEPLOYMENT.convex.site/clerk-users-webhook`. Use its signing secret.
   Each fresh branch preview needs its own Clerk endpoint before user sync works;
   removing the preview also requires removing that endpoint. No automatic webhook
   provisioning is implemented. Test sign-up and synchronization before approval.
8. Configure Stripe `checkout.session.completed` webhooks to each frontend's
   `/api/webhooks/stripe`, with the endpoint's matching signing secret and mode.
   Dynamic previews need separate test endpoints, or payments cannot be smoke-tested.
   Stripe local testing can forward to the local route using the Stripe CLI.
9. Provision the first super-admin using the controlled procedure below. Verify a
   second approved super-admin for recovery, account MFA, and operator access.
10. Deploy staging, perform the smoke checklist, record the exact tested commit,
    then manually build that **same commit** with production configuration.
    Do not promote a staging artifact to production: its public URLs/keys are baked in.

## Configuration contract

Start from `apps/web/.env.example`; it contains placeholders, not working credentials.
Set `MARKETPLACE_ENV` explicitly on every hosted frontend/backend. Local `next dev`
defaults to development; local `next start` requires an explicit mode and runtime secrets.

Web build: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_APP_URL`.
Web runtime also requires `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `EVENT_REGISTRATION_PRICE_CENTS`.
Convex requires `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SECRET`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EVENT_REGISTRATION_PRICE_CENTS`,
`APP_URL`, and `MARKETPLACE_ENV`.
No client Stripe publishable key is currently consumed: Checkout redirects are server-created.
The event price must be the approved positive integer USD-cent amount and match
between web and backend. Key prefixes do not prove a key is valid or belongs to
the intended account; verify account IDs and modes during provisioning and smoke tests.

Vercel deploy credentials: `CONVEX_DEPLOY_KEY` and, for staging/production,
`EXPECTED_CONVEX_DEPLOYMENT` (exact deployment name). Scope the key to the minimum
permissions needed for deploy and internal readiness execution. Preview scope
uses a `preview:` key from the non-production project. Staging/production use
`prod:DEPLOYMENT|...` keys belonging to their respective projects. Legacy unscoped
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
  matching fee; signup/login/logout and user webhook sync; public approved listings
  and VIN; pending/private listing authorization; seller creation; buyer messaging;
  favorites; admin moderation; event test Checkout, successful/retried webhook,
  registration/QR and check-in. Verify anonymous/non-admin denial.
- Production: record approver, SHA, prior Vercel deployment ID, prior Convex code
  SHA, backup reference, configuration revision, and rollback compatibility before
  deployment. Validate backend readiness; repeat auth/listing/admin smoke checks.
  A real charge requires explicit owner approval; do not use test cards in live mode.
- Record deployment URLs/IDs, results, release timestamp, and operator in the
  private release log. This repository contains no completed release evidence yet.

## Secret ownership and rotation

| Credential | Accountable owner role | Storage / consumers |
| --- | --- | --- |
| Convex deploy keys | Platform/release owner | Vercel environment secrets; approved operator vault |
| Clerk secret/API and webhook keys | Identity/security owner | Vercel secret key; Convex webhook signing secret |
| Stripe API and webhook keys | Payments owner | Matching Vercel/Convex API keys; Vercel endpoint signing secret |
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
   flows, and last healthy frontend/backend pair. Restrict writes/payments if data
   integrity is at risk; do not blindly replay charges or run data restoration.
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
5. Verify login, webhook sync, public listings, authorization, messaging, registrations,
   and check-in. Monitor failures and reconcile queued/retried webhook events.
6. Record incident timeline/results, restore release controls, and rehearse this
   procedure in staging **before** the first production launch. A documented procedure
   is not a tested recovery plan until that rehearsal is recorded.

Event checkout, inventory initialization, webhook subscriptions, automatic refunds,
and payment recovery follow [Event payments](EVENT_PAYMENTS.md).
Event staff assignments, historical roster/attendance migrations and on-site
connectivity checks follow [Popup operations](POPUP_OPERATIONS.md).
