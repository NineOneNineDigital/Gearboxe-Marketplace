import assert from "node:assert/strict";
import test from "node:test";
import { validateDeploymentTarget } from "./deployment-target.mjs";

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

test("shared development backend staging only builds the frontend", () => {
  const shared = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "dev",
    MARKETPLACE_ENV: "staging", STAGING_SHARED_DEV_BACKEND: "true",
    CONVEX_DEPLOYMENT: "dev:test-backend", NEXT_PUBLIC_CONVEX_URL: "https://test-backend.convex.cloud",
    NEXT_PUBLIC_APP_URL: "https://gearboxe-staging.vercel.app",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic", CLERK_SECRET_KEY: "sk_test_synthetic" };
  assert.deepEqual(validateDeploymentTarget(shared), { mode: "staging", frontendOnly: true, targetArgs: [] });
  for (const override of [
    { VERCEL: undefined }, { VERCEL_ENV: "preview" }, { VERCEL_GIT_COMMIT_REF: "main" },
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
