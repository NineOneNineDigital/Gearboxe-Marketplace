export function validateDeploymentTarget(env) {
  const mode = env.MARKETPLACE_ENV;
  if (env.VERCEL !== "1" || !["preview", "staging", "production"].includes(mode)) {
    throw new Error("Deployment requires Vercel and an explicit marketplace environment");
  }
  const key = env.CONVEX_DEPLOY_KEY;
  if (!key) throw new Error("CONVEX_DEPLOY_KEY is required");
  if (mode === "preview") {
    if (env.VERCEL_ENV !== "preview" || !key.startsWith("preview:") || !env.VERCEL_GIT_COMMIT_REF) {
      throw new Error("Previews require a preview-only Convex deploy key and explicit branch");
    }
    return { mode, targetArgs: ["--preview-name", env.VERCEL_GIT_COMMIT_REF] };
  }
  const target = env.EXPECTED_CONVEX_DEPLOYMENT;
  if (!target || !key.startsWith(`prod:${target}|`) || env.VERCEL_ENV !== "production") {
    throw new Error("Release deploy key must match the explicitly expected Convex deployment");
  }
  return { mode, targetArgs: ["--deployment-name", target] };
}
