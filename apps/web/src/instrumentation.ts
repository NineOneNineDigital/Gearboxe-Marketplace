export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { validateEnvironment } = await import("@/convex/lib/environment");
    // Explicit public references are inlined by Next.js during compilation.
    // Convex/preview URLs injected only into the build subprocess must also be
    // used for cold-start validation, matching what the browser actually uses.
    validateEnvironment({
      ...process.env,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
      NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    }, "web-runtime");
  }
}
