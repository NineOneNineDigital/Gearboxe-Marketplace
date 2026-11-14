type Environment = Record<string, string | undefined>;
type Profile = "web-build" | "web-runtime" | "convex";

// The public flag is inlined into the web build. Convex reads the same name
// independently from its own deployment environment for each booking.
export function popupPaymentsEnabled() {
  return process.env.NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED === "true";
}

export function requirePopupPayments() {
  if (!popupPaymentsEnabled()) throw new Error("Event registration is unavailable");
  // Convex environment changes take effect independently of deployment checks.
  validateEnvironment(process.env, "convex");
}

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
  const rollout = env.NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED;
  if (rollout !== undefined && rollout !== "false" && rollout !== "true") {
    errors.push("NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED must be true or false");
  }
  const paymentsEnabled = rollout === "true";
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
    }
  } else {
    origin("CLERK_JWT_ISSUER_DOMAIN");
    key("CLERK_WEBHOOK_SECRET", ["whsec_"]);
    origin("APP_URL", true);
  }
  if (profile !== "web-build") {
    if (paymentsEnabled || env.STRIPE_WEBHOOK_SECRET) key("STRIPE_WEBHOOK_SECRET", ["whsec_"]);
    if (paymentsEnabled || env.STRIPE_SECRET_KEY) key("STRIPE_SECRET_KEY", [`sk_${stripeMode}_`, `rk_${stripeMode}_`]);
    const price = paymentsEnabled ? required("EVENT_REGISTRATION_PRICE_CENTS") : env.EVENT_REGISTRATION_PRICE_CENTS?.trim();
    if (price && (!/^\d+$/.test(price) || !Number.isSafeInteger(Number(price)) || Number(price) < 50 || Number(price) > 99_999_999)) {
      errors.push("EVENT_REGISTRATION_PRICE_CENTS must be an integer from 50 to 99999999");
    }
  }
  if (errors.length) {
    // Report names and rules, never supplied values or credentials.
    throw new Error(`Invalid marketplace configuration:\n${errors.join("\n")}`);
  }
  return { mode, paymentsEnabled };
}
