import { spawnSync } from "node:child_process";
import { validateEnvironment } from "../convex/lib/environment.ts";

const env = { ...process.env };
if (!env.NEXT_PUBLIC_CONVEX_URL?.endsWith(".convex.cloud")) {
  throw new Error("Hosted builds require the Convex cloud URL injected by convex deploy");
}
env.NEXT_PUBLIC_CONVEX_SITE_URL = env.NEXT_PUBLIC_CONVEX_URL.replace(/\.convex\.cloud$/, ".convex.site");
if (env.MARKETPLACE_ENV === "preview") {
  if (!env.VERCEL_URL) throw new Error("Preview deployment URL is required");
  env.NEXT_PUBLIC_APP_URL = `https://${env.VERCEL_URL}`;
}
validateEnvironment(env, "web-runtime");
const result = spawnSync("pnpm", ["build"], { env, stdio: "inherit" });
if (result.error) throw new Error("Unable to start hosted build");
process.exit(result.status ?? 1);
