type Environment = Record<string, string | undefined>;
type Profile = "web-build" | "web-runtime" | "convex";

// Keep this module platform-independent: Next.js, Convex, and tests share it.
export function validateEnvironment(env: Environment, profile: Profile) {
  const errors: string[] = [];
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) errors.push(`${name} is required`);
    return value || "";
  };
  const mode = env.MARKETPLACE_ENV ||
    (env.NODE_ENV === "development" || profile === "web-build" ? "development" : "");
  if (!["development", "preview", "staging", "production", "ci"].includes(mode)) {
    errors.push("MARKETPLACE_ENV must identify the deployment environment");
  }
  if (mode === "ci" && (profile !== "web-build" || env.CI !== "true" || env.VERCEL === "1")) {
    errors.push("CI fixtures are allowed only in non-hosted CI builds");
  }
  const origin = (name: string, local = false) => {
    const value = required(name);
    if (!value) return;
    try {
      const url = new URL(value);
      const localHttp = local && ["development", "ci"].includes(mode) &&
        ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:";
      if ((!localHttp && url.protocol !== "https:") || url.username || url.password ||
          url.pathname !== "/" || url.search || url.hash) {
        errors.push(`${name} must be an HTTPS origin (local HTTP only in development)`);
      }
    } catch {
      errors.push(`${name} must be a valid URL`);
    }
  };
  const key = (name: string, prefixes: string[]) => {
    const value = required(name);
    if (value && !prefixes.some((prefix) => value.startsWith(prefix) && value.length > prefix.length)) {
      errors.push(`${name} has the wrong key type for ${mode || "this environment"}`);
    }
  };
  const stripeMode = mode === "production" ? "live" : "test";
  if (profile !== "convex") {
    const clerkModes = mode === "production" ? ["live"] : mode === "staging" ? ["test", "live"] : ["test"];
    key("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", clerkModes.map((m) => `pk_${m}_`));
    origin("NEXT_PUBLIC_CONVEX_URL");
    origin("NEXT_PUBLIC_CONVEX_SITE_URL");
    origin("NEXT_PUBLIC_APP_URL", true);
    try {
      const cloud = new URL(env.NEXT_PUBLIC_CONVEX_URL || "");
      const site = new URL(env.NEXT_PUBLIC_CONVEX_SITE_URL || "");
      if (cloud.hostname.endsWith(".convex.cloud") &&
          site.hostname !== cloud.hostname.replace(/\.convex\.cloud$/, ".convex.site")) {
        errors.push("NEXT_PUBLIC_CONVEX_SITE_URL must match NEXT_PUBLIC_CONVEX_URL");
      }
    } catch {
      // Invalid/missing URLs are already reported by the origin checks above.
    }
    if (profile === "web-runtime") {
      const clerkMode = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_") ? "live" : "test";
      key("CLERK_SECRET_KEY", [`sk_${clerkMode}_`]);
      if (mode !== "development" || env.STRIPE_WEBHOOK_SECRET) key("STRIPE_WEBHOOK_SECRET", ["whsec_"]);
    }
  } else {
    origin("CLERK_JWT_ISSUER_DOMAIN");
    key("CLERK_WEBHOOK_SECRET", ["whsec_"]);
    key("STRIPE_WEBHOOK_SECRET", ["whsec_"]);
    origin("APP_URL", true);
  }
  if (profile !== "web-build") {
    const optionalLocalPayments = mode === "development" && profile === "web-runtime";
    if (!optionalLocalPayments || env.STRIPE_SECRET_KEY) key("STRIPE_SECRET_KEY", [`sk_${stripeMode}_`, `rk_${stripeMode}_`]);
    const price = optionalLocalPayments ? env.EVENT_REGISTRATION_PRICE_CENTS?.trim() : required("EVENT_REGISTRATION_PRICE_CENTS");
    if (price && (!/^\d+$/.test(price) || !Number.isSafeInteger(Number(price)) || Number(price) <= 0)) {
      errors.push("EVENT_REGISTRATION_PRICE_CENTS must be a positive integer");
    }
  }
  if (errors.length) {
    // Report names and rules, never supplied values or credentials.
    throw new Error(`Invalid marketplace configuration:\n${errors.join("\n")}`);
  }
  return { mode };
}
