const PRODUCT_HOSTS = new Set([
  "gearboxemarket.com",
  "www.gearboxemarket.com",
  "gearboxe.com",
  "www.gearboxe.com",
]);

function origin(name, value, protocol) {
  if (!value) throw new Error(`${name} is required for browser tests`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a URL origin`); }
  if (url.origin !== value.replace(/\/$/, "") || url.protocol !== protocol ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error(`${name} must be a ${protocol === "https:" ? "HTTPS" : "HTTP"} origin`);
  }
  if (PRODUCT_HOSTS.has(url.hostname) || url.hostname.endsWith(".gearboxemarket.com") ||
      url.hostname.endsWith(".gearboxe.com")) {
    throw new Error(`${name} cannot target a public product domain`);
  }
  return url;
}

export function browserTarget(env) {
  const kind = env.E2E_TARGET_KIND;
  if (kind === "local") {
    const url = origin("E2E_BASE_URL", env.E2E_BASE_URL, "http:");
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
      throw new Error("Local browser tests must target loopback");
    }
    return { kind, baseURL: url.origin };
  }
  if (kind === "staging") {
    if (env.MARKETPLACE_ENV !== "staging") throw new Error("Staging browser tests require MARKETPLACE_ENV=staging");
    const base = origin("E2E_BASE_URL", env.E2E_BASE_URL, "https:");
    const allowed = origin("E2E_ALLOWED_FRONTEND_ORIGIN", env.E2E_ALLOWED_FRONTEND_ORIGIN, "https:");
    const convex = origin("E2E_CONVEX_URL", env.E2E_CONVEX_URL, "https:");
    const allowedConvex = origin("E2E_ALLOWED_CONVEX_URL", env.E2E_ALLOWED_CONVEX_URL, "https:");
    const clerk = origin("E2E_CLERK_ISSUER", env.E2E_CLERK_ISSUER, "https:");
    const allowedClerk = origin("E2E_ALLOWED_CLERK_ISSUER", env.E2E_ALLOWED_CLERK_ISSUER, "https:");
    if (base.origin !== allowed.origin || convex.origin !== allowedConvex.origin || clerk.origin !== allowedClerk.origin) {
      throw new Error("Browser targets do not match the explicit staging allowlist");
    }
    if (!convex.hostname.endsWith(".convex.cloud")) throw new Error("Staging Convex target must be a Convex cloud origin");
    if (new Set([base.hostname, convex.hostname, clerk.hostname]).size !== 3) {
      throw new Error("Staging frontend, Convex and Clerk origins must be distinct");
    }
    return { kind, baseURL: base.origin };
  }
  throw new Error("E2E_TARGET_KIND must be local or staging");
}
