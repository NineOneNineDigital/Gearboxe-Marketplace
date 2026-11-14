import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Exercise the route with a signed-out Clerk session and no external services.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@clerk/nextjs/server") {
    return { url: "data:text/javascript,export async function auth() { return { userId: null }; }", shortCircuit: true };
  }
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  if (specifier.startsWith("@/")) {
    for (const extension of [".ts", ".js"]) {
      const url = new URL(`../${specifier.slice(2)}${extension}`, import.meta.url);
      if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context);
    }
  }
  return nextResolve(specifier, context);
} });

const { POST } = await import("../src/app/api/create-checkout-session/route.ts");
const { default: sitemap } = await import("../src/app/sitemap.ts");
process.env.NEXT_PUBLIC_APP_URL = "https://market.example.test";

test("marketplace-only web routes omit events from the sitemap and return 404 for checkout", async () => {
  delete process.env.NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED;
  const result = await POST(new Request("https://market.example.test/api/create-checkout-session", { method: "POST" }));
  assert.equal(result.status, 404);
  assert.ok(sitemap().every(({ url }) => new URL(url).pathname !== "/events"));
});

test("explicitly enabled web routes list events and still require authentication for checkout", async () => {
  process.env.NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED = "true";
  const result = await POST(new Request("https://market.example.test/api/create-checkout-session", { method: "POST" }));
  assert.equal(result.status, 401);
  assert.ok(sitemap().some(({ url }) => new URL(url).pathname === "/events"));
});
