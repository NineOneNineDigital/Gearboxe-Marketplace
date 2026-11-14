// Isolated synthetic configuration for tests that exercise enabled event flows.
Object.assign(process.env, {
  NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED: "true",
  MARKETPLACE_ENV: "staging",
  APP_URL: "https://gearboxe.test",
  CLERK_JWT_ISSUER_DOMAIN: "https://clerk.example.test",
  CLERK_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  EVENT_REGISTRATION_PRICE_CENTS: "4900",
});
