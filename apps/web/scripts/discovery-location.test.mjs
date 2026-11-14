import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) for (const suffix of [".ts", ".js"]) {
    const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });
const { readRememberedZip, REMEMBERED_ZIP_KEY, resolvedZipUrl, withoutGeography } = await import("../lib/discovery-location.ts");
const { lookupZip } = await import("../lib/zip-location.ts");

test("nationwide retains vehicle filters while removing all geography", () => {
  assert.deepEqual(withoutGeography({ make: "Toyota", minPrice: 1000, minYear: 2020, state: "NC", zip: "27601", latitude: 35, longitude: -78, radiusMiles: 50 }), { make: "Toyota", minPrice: 1000, minYear: 2020 });
});
test("only a valid browser-local ZIP is restored", () => {
  assert.equal(readRememberedZip({ getItem: key => key === REMEMBERED_ZIP_KEY ? "02108" : null }), "02108");
  assert.equal(readRememberedZip({ getItem: () => "bad" }), null);
  assert.equal(readRememberedZip({ getItem: () => null }), null);
});
test("a shared ZIP resolves fresh coordinates while preserving non-geographic filters", () => {
  const url = resolvedZipUrl({ make: "Honda", state: "NC", zip: "27601", latitude: 1, longitude: 2, radiusMiles: 100 },
    "price-low", "02108", { latitude: 42.36, longitude: -71.05 }, 100);
  const params = new URL(url, "https://gearboxe.test").searchParams;
  assert.equal(params.get("make"), "Honda");
  assert.equal(params.get("sort"), "price-low");
  assert.equal(params.get("zip"), "02108");
  assert.equal(params.get("latitude"), "42.36");
  assert.equal(params.get("longitude"), "-71.05");
  assert.equal(params.get("radiusMiles"), "100");
  assert.equal(params.has("state"), false);
});
test("ZIP lookup resolves coordinates and rejects invalid or missing ZIPs", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ places: [{ latitude: "35.78", longitude: "-78.64" }] }), { status: 200 });
    assert.deepEqual(await lookupZip("27601"), { latitude: 35.78, longitude: -78.64 });
    await assert.rejects(lookupZip("bad"), /five-digit/);
    globalThis.fetch = async () => new Response(null, { status: 404 });
    await assert.rejects(lookupZip("00000"), /not found/);
  } finally { globalThis.fetch = original; }
});
