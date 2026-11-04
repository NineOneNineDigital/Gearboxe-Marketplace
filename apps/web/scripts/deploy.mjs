import { spawnSync } from "node:child_process";
import { validateDeploymentTarget } from "./deployment-target.mjs";

const { mode, targetArgs } = validateDeploymentTarget(process.env);
const result = spawnSync("pnpm", ["exec", "convex", "deploy", "--yes", "--typecheck", "enable",
  "--cmd-url-env-var-name", "NEXT_PUBLIC_CONVEX_URL", "--cmd", "node --experimental-strip-types scripts/hosted-build.mjs"],
  { stdio: "inherit" });
if (result.error) throw new Error("Unable to start deployment");
if (result.status !== 0) process.exit(result.status ?? 1);
const readiness = spawnSync("pnpm", ["exec", "convex", "run", ...targetArgs,
  "admin:validateDeployment", JSON.stringify({ expectedEnvironment: mode })], { stdio: "inherit" });
if (readiness.error) throw new Error("Unable to run backend readiness check");
process.exit(readiness.status ?? 1);
