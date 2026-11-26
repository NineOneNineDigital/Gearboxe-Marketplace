import { spawnSync } from "node:child_process";
import { validateEnvironment } from "../convex/lib/environment.ts";
import { hostedAppUrl } from "./deployment-target.mjs";

const env = { ...process.env };
if (!env.NEXT_PUBLIC_CONVEX_URL?.endsWith(".convex.cloud")) {
  throw new Error("Hosted builds require the Convex cloud URL injected by convex deploy");
}
env.NEXT_PUBLIC_CONVEX_SITE_URL = env.NEXT_PUBLIC_CONVEX_URL.replace(/\.convex\.cloud$/, ".convex.site");
env.NEXT_PUBLIC_APP_URL = hostedAppUrl(env);
validateEnvironment(env, "web-runtime");
const result = spawnSync("pnpm", ["build"], { env, stdio: "inherit" });
if (result.error) throw new Error("Unable to start hosted build");
process.exit(result.status ?? 1);
