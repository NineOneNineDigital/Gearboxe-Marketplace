import assert from "node:assert/strict";
import test from "node:test";
import { validateEnvironment } from "../convex/lib/environment.ts";

const valid = {
  MARKETPLACE_ENV: "staging",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
  CLERK_SECRET_KEY: "sk_test_example",
  NEXT_PUBLIC_CONVEX_URL: "https://staging-example.convex.cloud",
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://staging-example.convex.site",
  NEXT_PUBLIC_APP_URL: "https://staging.example.com",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  EVENT_REGISTRATION_PRICE_CENTS: "1000",
  CLERK_JWT_ISSUER_DOMAIN: "https://example.clerk.accounts.dev",
  CLERK_WEBHOOK_SECRET: "whsec_example",
};

test("staging runtime and backend accept isolated test configuration", () => {
  assert.equal(validateEnvironment(valid, "web-runtime").mode, "staging");
  assert.equal(validateEnvironment(valid, "convex").mode, "staging");
});
test("startup rejects missing required secrets without exposing supplied values", () => {
  assert.throws(() => validateEnvironment({ ...valid, CLERK_SECRET_KEY: undefined }, "web-runtime"), /CLERK_SECRET_KEY is required/);
  try {
    validateEnvironment({ ...valid, STRIPE_SECRET_KEY: "private-do-not-print" }, "web-runtime");
    assert.fail("Expected configuration failure");
  } catch (error) {
    assert.doesNotMatch(error.message, /private-do-not-print/);
  }
});
test("production requires live keys; staging forbids live Stripe keys", () => {
  assert.throws(() => validateEnvironment({ ...valid, MARKETPLACE_ENV: "production" }, "web-runtime"), /wrong key type/);
  assert.throws(() => validateEnvironment({ ...valid, STRIPE_SECRET_KEY: "sk_live_example" }, "convex"), /wrong key type/);
  validateEnvironment({ ...valid, MARKETPLACE_ENV: "production", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example", CLERK_SECRET_KEY: "sk_live_example", STRIPE_SECRET_KEY: "sk_live_example" }, "web-runtime");
});
test("CI fixture mode cannot start a server or hosted build", () => {
  const env = { ...valid, MARKETPLACE_ENV: "ci", CI: "true" };
  validateEnvironment(env, "web-build");
  assert.throws(() => validateEnvironment(env, "web-runtime"), /CI fixtures/);
  assert.throws(() => validateEnvironment({ ...env, VERCEL: "1" }, "web-build"), /CI fixtures/);
});
test("invalid origins, mismatched Convex targets, and noninteger fees fail", () => {
  for (const override of [
    { NEXT_PUBLIC_APP_URL: "http://staging.example.com" },
    { NEXT_PUBLIC_APP_URL: "https://user:password@example.com/path" },
    { NEXT_PUBLIC_CONVEX_SITE_URL: "https://production.convex.site" },
    { NEXT_PUBLIC_CONVEX_URL: "https://other.convex.cloud/" },
    { EVENT_REGISTRATION_PRICE_CENTS: "1.5" },
    { EVENT_REGISTRATION_PRICE_CENTS: "0" },
    { MARKETPLACE_ENV: undefined },
  ]) assert.throws(() => validateEnvironment({ ...valid, ...override }, "web-runtime"));
});

test("local marketplace can run without payments while supplied credentials remain validated", () => {
  const local = { ...valid, MARKETPLACE_ENV: "development", STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined, EVENT_REGISTRATION_PRICE_CENTS: undefined };
  validateEnvironment(local, "web-runtime");
  assert.throws(() => validateEnvironment({ ...local, STRIPE_SECRET_KEY: "sk_live_example" }, "web-runtime"), /wrong key type/);
  assert.throws(() => validateEnvironment(local, "convex"), /STRIPE_SECRET_KEY is required/);
});
