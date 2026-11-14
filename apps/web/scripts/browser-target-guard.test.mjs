import assert from "node:assert/strict";
import test from "node:test";
import { browserTarget } from "../e2e/target-guard.mjs";

const staging = {
  E2E_TARGET_KIND: "staging",
  MARKETPLACE_ENV: "staging",
  E2E_BASE_URL: "https://preview.example.test",
  E2E_ALLOWED_FRONTEND_ORIGIN: "https://preview.example.test",
  E2E_CONVEX_URL: "https://example.convex.cloud",
  E2E_ALLOWED_CONVEX_URL: "https://example.convex.cloud",
  E2E_CLERK_ISSUER: "https://clerk.example.test",
  E2E_ALLOWED_CLERK_ISSUER: "https://clerk.example.test",
};

test("browser target requires explicit loopback or exact staging targets", () => {
  assert.deepEqual(browserTarget({ E2E_TARGET_KIND: "local", E2E_BASE_URL: "http://127.0.0.1:3105" }),
    { kind: "local", baseURL: "http://127.0.0.1:3105" });
  assert.deepEqual(browserTarget(staging), { kind: "staging", baseURL: "https://preview.example.test" });
  assert.throws(() => browserTarget({ E2E_TARGET_KIND: "local", E2E_BASE_URL: "http://example.test" }), /loopback/);
  assert.throws(() => browserTarget({ ...staging, MARKETPLACE_ENV: "production" }), /MARKETPLACE_ENV/);
  assert.throws(() => browserTarget({ ...staging, E2E_BASE_URL: "https://gearboxemarket.com", E2E_ALLOWED_FRONTEND_ORIGIN: "https://gearboxemarket.com" }), /public product domain/);
  assert.throws(() => browserTarget({ ...staging, E2E_CONVEX_URL: "https://other.convex.cloud" }), /allowlist/);
  assert.throws(() => browserTarget({ ...staging, E2E_CLERK_ISSUER: "https://other-clerk.example.test" }), /allowlist/);
  assert.throws(() => browserTarget({ E2E_TARGET_KIND: "staging", MARKETPLACE_ENV: "staging" }), /required/);
});
