import { spawnSync } from "node:child_process";
import { validateDeploymentTarget } from "./deployment-target.mjs";

const { mode, targetArgs, frontendOnly } = validateDeploymentTarget(process.env);
if (frontendOnly) {
  const build = spawnSync("node", ["--experimental-strip-types", "scripts/hosted-build.mjs"],
    { stdio: "inherit" });
  if (build.error) throw new Error("Unable to start shared development backend build");
  process.exit(build.status ?? 1);
}
const result = spawnSync("pnpm", ["exec", "convex", "deploy", "--yes", "--typecheck", "enable",
  "--cmd-url-env-var-name", "NEXT_PUBLIC_CONVEX_URL", "--cmd", "node --experimental-strip-types scripts/hosted-build.mjs"],
  { stdio: "inherit" });
if (result.error) throw new Error("Unable to start deployment");
if (result.status !== 0) process.exit(result.status ?? 1);
const readiness = spawnSync("pnpm", ["exec", "convex", "run", ...targetArgs,
  "admin:validateDeployment", JSON.stringify({
    expectedEnvironment: mode,
    expectedPopupPaymentsEnabled: process.env.NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED === "true",
    webPaymentRecoveryConfigured: !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET,
  })], { stdio: "inherit" });
if (readiness.error) throw new Error("Unable to run backend readiness check");
process.exit(readiness.status ?? 1);
