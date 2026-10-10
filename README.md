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

- Node.js 20 or newer
- pnpm 10.18.0 (the version is pinned in `package.json`)
- Convex, Clerk, and Stripe accounts for the marketplace app

## Install

```bash
pnpm install
```

The marketplace environment file belongs at `apps/web/.env.local`. Configure:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, and `CONVEX_DEPLOYMENT`
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET`
- `EVENT_REGISTRATION_PRICE_CENTS` as the canonical registration price in USD cents
- `NEXT_PUBLIC_APP_URL`

The Convex deployment also requires `CLERK_JWT_ISSUER_DOMAIN`,
`CLERK_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, and
`EVENT_REGISTRATION_PRICE_CENTS`. The registration price must match in the web
and Convex environments: the web server creates Checkout sessions and Convex
independently verifies the paid amount before completing a registration.

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
pnpm build
```

## Deployment

Deploy each Next.js app as its own project and set its project root to `apps/web` or `apps/dashboard`. Marketplace environment variables are configured on the `apps/web` deployment. Convex runtime variables must also be configured in the Convex deployment. Deploy the backend from the repository root with `pnpm convex:deploy`.
