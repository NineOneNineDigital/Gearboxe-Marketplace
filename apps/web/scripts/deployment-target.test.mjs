import assert from "node:assert/strict";
import test from "node:test";
import { hostedAppUrl, validateDeploymentTarget } from "./deployment-target.mjs";

const release = { VERCEL: "1", VERCEL_ENV: "production", MARKETPLACE_ENV: "staging",
  CONVEX_DEPLOY_KEY: "prod:staging-backend|synthetic", EXPECTED_CONVEX_DEPLOYMENT: "staging-backend" };
test("release requires explicitly matching backend target", () => {
  assert.deepEqual(validateDeploymentTarget(release).targetArgs, ["--deployment-name", "staging-backend"]);
  for (const override of [{ EXPECTED_CONVEX_DEPLOYMENT: "production-backend" },
    { EXPECTED_CONVEX_DEPLOYMENT: undefined }, { VERCEL: undefined }, { MARKETPLACE_ENV: "ci" },
    { VERCEL_ENV: "preview" }, { CONVEX_DEPLOY_KEY: "legacy-key" }]) {
    assert.throws(() => validateDeploymentTarget({ ...release, ...override }));
  }
});
test("preview cannot use a production deploy key", () => {
  const preview = { ...release, MARKETPLACE_ENV: "preview", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature/test" };
  assert.throws(() => validateDeploymentTarget(preview));
  assert.deepEqual(validateDeploymentTarget({ ...preview, CONVEX_DEPLOY_KEY: "preview:team:project|synthetic" }).targetArgs,
    ["--preview-name", "feature/test"]);
  assert.throws(() => validateDeploymentTarget({ ...preview, CONVEX_DEPLOY_KEY: "preview:team:project|synthetic", VERCEL_GIT_COMMIT_REF: undefined }));
});

test("dev Preview with shared development backend only builds the frontend", () => {
  const shared = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev",
    VERCEL_URL: "gearboxe-marketplace-git-dev.vercel.app",
    MARKETPLACE_ENV: "preview", STAGING_SHARED_DEV_BACKEND: "true",
    CONVEX_DEPLOYMENT: "dev:test-backend", NEXT_PUBLIC_CONVEX_URL: "https://test-backend.convex.cloud",
    NEXT_PUBLIC_APP_URL: "https://gearboxe-marketplace-git-dev.vercel.app",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic", CLERK_SECRET_KEY: "sk_test_synthetic" };
  assert.deepEqual(validateDeploymentTarget(shared), { mode: "preview", frontendOnly: true, targetArgs: [] });
  for (const override of [
    { VERCEL: undefined }, { VERCEL_ENV: "production" }, { VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL_URL: undefined }, { VERCEL_URL: "gearboxemarket.com" },
    { MARKETPLACE_ENV: "production" }, { CONVEX_DEPLOY_KEY: "prod:backend|synthetic" },
    { EXPECTED_CONVEX_DEPLOYMENT: "backend" }, { CONVEX_DEPLOYMENT: "prod:test-backend" },
    { NEXT_PUBLIC_CONVEX_URL: "https://production-backend.convex.cloud" },
    { NEXT_PUBLIC_APP_URL: "https://gearboxemarket.com" },
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_synthetic" },
    { CLERK_SECRET_KEY: "sk_live_synthetic" },
  ]) {
    assert.throws(() => validateDeploymentTarget({ ...shared, ...override }));
  }
});

test("shared dev Preview keeps its stable origin for share links while other Previews use deployment URLs", () => {
  const env = { MARKETPLACE_ENV: "preview", VERCEL_URL: "one-off-preview.vercel.app",
    NEXT_PUBLIC_APP_URL: "https://dev-gearboxe-marketplace.vercel.app" };
  assert.equal(hostedAppUrl({ ...env, STAGING_SHARED_DEV_BACKEND: "true" }), env.NEXT_PUBLIC_APP_URL);
  assert.equal(hostedAppUrl(env), "https://one-off-preview.vercel.app");
  assert.throws(() => hostedAppUrl({ ...env, STAGING_SHARED_DEV_BACKEND: "true", NEXT_PUBLIC_APP_URL: "https://gearboxemarket.com" }), /separate Preview web origin/);
  assert.throws(() => hostedAppUrl({ ...env, VERCEL_URL: undefined }), /Preview deployment URL/);
});
