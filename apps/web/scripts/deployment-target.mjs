export function validateDeploymentTarget(env) {
  if (env.STAGING_SHARED_DEV_BACKEND === "true") {
    if (env.VERCEL !== "1" || env.VERCEL_ENV !== "preview" ||
        env.MARKETPLACE_ENV !== "preview" || env.VERCEL_GIT_COMMIT_REF !== "dev" ||
        !env.VERCEL_URL || /^(?:www\.)?gearboxemarket\.com$/i.test(env.VERCEL_URL)) {
      throw new Error("Shared development backend builds require a Vercel Preview on dev");
    }
    if (env.CONVEX_DEPLOY_KEY || env.EXPECTED_CONVEX_DEPLOYMENT) {
      throw new Error("Shared development backend builds must not contain Convex deploy credentials");
    }
    const deployment = env.CONVEX_DEPLOYMENT;
    const cloudUrl = env.NEXT_PUBLIC_CONVEX_URL;
    if (!deployment?.startsWith("dev:") || !cloudUrl ||
        cloudUrl !== `https://${deployment.slice(4)}.convex.cloud`) {
      throw new Error("Shared development backend build requires a matching dev Convex deployment and URL");
    }
    if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") ||
        !env.CLERK_SECRET_KEY?.startsWith("sk_test_")) {
      throw new Error("Shared development backend builds require test Clerk keys");
    }
    const appUrl = env.NEXT_PUBLIC_APP_URL;
    if (!appUrl || /^https:\/\/(?:www\.)?gearboxemarket\.com\/?$/i.test(appUrl)) {
      throw new Error("Shared development backend builds require a separate Preview web origin");
    }
    return { mode: "preview", frontendOnly: true, targetArgs: [] };
  }
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
