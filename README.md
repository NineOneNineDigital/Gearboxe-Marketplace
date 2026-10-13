# Gearboxe Market

Gearboxe is a pnpm monorepo containing the public marketplace and a separate internal operations dashboard.

## Workspace

```text
apps/
├── web/          # Public marketplace, account flows, APIs, and Convex backend
└── dashboard/    # Internal operations dashboard
```

The existing marketplace application and its Convex functions live together in `apps/web` so its generated imports and deployment workflow remain unchanged.

## Requirements

- Node.js 22 (see `.nvmrc`; use `nvm use` if installed)
- pnpm 10.18.0 (the version is pinned in `package.json`)
- Convex, Clerk, and Stripe accounts for the marketplace app

## Install

```bash
pnpm install
```

The marketplace environment file belongs at `apps/web/.env.local`. Configure:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, and `CONVEX_DEPLOYMENT`
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- `EVENT_REGISTRATION_PRICE_CENTS` for legacy web configuration validation; configure the canonical default fee in Convex
- `NEXT_PUBLIC_APP_URL`
- `MARKETPLACE_ENV` (`development`, `preview`, `staging`, or `production`)

Local development can run without Stripe credentials; payment endpoints stay
unavailable until configured. Hosted environments and Convex still require the
payment configuration.

The Convex deployment also requires `CLERK_JWT_ISSUER_DOMAIN`,
`CLERK_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, and
`EVENT_REGISTRATION_PRICE_CENTS`. Checkout uses the Convex server fee snapshot; the browser and Next.js never
choose the charged amount. Configure `APP_URL` and `STRIPE_WEBHOOK_SECRET` in
Convex as well as the web deployment. Registration, capacity holds, refunds and
recovery are documented in [Event payments](docs/EVENT_PAYMENTS.md).

Event rules, deadlines, waitlists, assigned staff, QR admission, attendance,
incidents and roster exports are documented in
[Popup operations](docs/POPUP_OPERATIONS.md).

Vehicle listing fields, lifecycle rules, VIN provider selection, and permanent
media storage are documented in [Vehicle listings](docs/VEHICLE_LISTINGS.md).
Set `VIN_DECODER_PROVIDER` to `auto_dev` or `vpic` in Convex; Auto.dev also needs
`AUTO_DEV_API_KEY`. Media uploads need `APP_URL` set to the exact web origin there.
Seller drafts autosave; submission requires complete specifications and processed
Convex photos. My Listings provides moderation feedback, status controls,
activity counts and in-app confirmations. Closing a listing preserves existing
conversations and event registrations.
Buyer discovery uses bounded cursor pages with indexed keyword, location and
sort lookups, URL filters, saved searches and recently viewed listings. Existing
inventory must be backfilled into the discovery catalog before browser rollout;
the linked listing documentation includes the deployment sequence and SEO setup.

Trust, reporting, seller verification, private documents, moderation, appeals,
and sensitive-data visibility and retention are documented in
[Trust and safety](docs/TRUST_SAFETY.md).

Messaging, the notification inbox, email preferences, Autosend setup, delivery
tracking and recovery are documented in [Notifications](docs/NOTIFICATIONS.md).
Transactional email runs in Convex and requires `AUTOSEND_API_KEY`,
`AUTOSEND_FROM_EMAIL`, `AUTOSEND_WEBHOOK_SECRET`, and the exact web origin in
`APP_URL`. Configure a verified sender and the delivery webhook before rollout.

## Development

Run both apps:

```bash
pnpm dev
```

- Marketplace: http://localhost:3000
- Internal dashboard: http://localhost:3001

Run one app at a time:

```bash
pnpm dev:web
pnpm dev:dashboard
```

Run Convex alongside the apps in a separate terminal:

```bash
pnpm convex:dev
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the full release baseline with `pnpm check`. Lint rejects warnings as well
as errors. Type checking covers both applications and the shared design tokens.
Automated tests cover configuration, admin provisioning, marketplace backend
policies, payments, notifications, event operations and design tokens. Live
provider integration and browser end-to-end coverage still require staging.

GitHub Actions runs these same checks for pull requests and pushes to `main`,
with a frozen lockfile and the Node/pnpm versions pinned in the repository.
The workflow uses nonfunctional public build fixtures and does not require
Stripe/Clerk secrets, contact production authentication/payment backends, or
deploy either application. Builds fetch the existing Google Fonts over the network.
Runtime smoke tests need a separately configured staging environment.

Public Clerk and Convex configuration is required for Next.js builds. Stripe
credentials are only required at runtime when handling payment requests.
Build verification does not establish that live authentication or payments are
configured correctly.

## Deployment

Deploy each Next.js app as its own project and set its project root to `apps/web` or `apps/dashboard`. Marketplace environment variables are configured on the `apps/web` deployment. Convex runtime variables must also be configured in the Convex deployment. Backend releases must use an explicit environment-scoped deploy key; do not rely on a developer's default deployment selection.

Use the [deployment runbook](docs/DEPLOYMENT.md) for environment isolation,
Vercel preview/staging setup, secret ownership/rotation, first-super-admin
provisioning, release gates, and rollback. Cloud resources still need provisioning.
The marketplace's Vercel build command deploys the explicitly targeted Convex
backend and builds the frontend against its URL; production releases require review.
