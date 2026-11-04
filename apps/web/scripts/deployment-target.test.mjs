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
