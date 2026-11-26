import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    for (const suffix of [".ts", ".js"]) {
      const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
} });

const { allowedHttpOrigin } = await import("../convex/lib/httpOrigin.ts");
const { upload } = await import("../convex/mediaUpload.ts");
const { documentUpload } = await import("../convex/trustDocuments.ts");
const { upload: wantedUpload } = await import("../convex/wantedMediaHttp.ts");
const { upload: photoRequestUpload } = await import("../convex/photoRequestMediaHttp.ts");
const preview = "https://dev-gearboxe-marketplace.vercel.app";
const local = "http://localhost:3000";
const development = { APP_URL: local, MARKETPLACE_ENV: "development", DEV_PREVIEW_APP_URL: preview };

test("shared development upload origins require an explicit exact Preview configuration", () => {
  assert.equal(allowedHttpOrigin(local, development), local);
  assert.equal(allowedHttpOrigin(preview, development), preview);
  assert.equal(allowedHttpOrigin(preview, { APP_URL: local, MARKETPLACE_ENV: "development" }), null);
  assert.equal(allowedHttpOrigin(preview, { ...development, MARKETPLACE_ENV: "production" }), null);
  assert.equal(allowedHttpOrigin(preview, { ...development, APP_URL: "https://gearboxemarket.com" }), null);
  assert.equal(allowedHttpOrigin(preview, { ...development, DEV_PREVIEW_APP_URL: "https://*.vercel.app" }), null);
  assert.equal(allowedHttpOrigin(preview, { ...development, DEV_PREVIEW_APP_URL: "https://gearboxemarket.com" }), null);
  assert.equal(allowedHttpOrigin(preview, { ...development, DEV_PREVIEW_APP_URL: `${preview}/other` }), null);
  assert.equal(allowedHttpOrigin(`${preview}.attacker.example`, development), null);
  assert.equal(allowedHttpOrigin("https://gearboxemarket.com", development), null);
});

test("missing origins remain allowed only for authenticated document requests", () => {
  assert.equal(allowedHttpOrigin(null, development), null);
  assert.equal(allowedHttpOrigin(null, development, true), local);
  assert.equal(allowedHttpOrigin(null, { ...development, APP_URL: undefined }, true), null);
  assert.equal(allowedHttpOrigin(local, { ...development, DEV_PREVIEW_APP_URL: "bad" }), null);
});

test("upload preflights reflect only an explicitly allowed Preview origin", async () => {
  const previous = Object.fromEntries(["APP_URL", "DEV_PREVIEW_APP_URL", "MARKETPLACE_ENV"].map(key => [key, process.env[key]]));
  Object.assign(process.env, development);
  try {
    const request = (url, origin) => new Request(url, { method: "OPTIONS", headers: { Origin: origin } });
    const vehicle = await upload._handler({}, request("https://backend.convex.site/vehicle-media/upload", preview));
    assert.equal(vehicle.status, 204);
    assert.equal(vehicle.headers.get("Access-Control-Allow-Origin"), preview);
    const document = await documentUpload._handler({}, request("https://backend.convex.site/trust/document", preview));
    assert.equal(document.status, 204);
    assert.equal(document.headers.get("Access-Control-Allow-Origin"), preview);
    for (const [handler, path] of [[wantedUpload, "wanted-media/upload"], [photoRequestUpload, "photo-request-media/upload"]]) {
      const accepted = await handler._handler({}, request(`https://backend.convex.site/${path}`, preview));
      assert.equal(accepted.status, 204);
      assert.equal(accepted.headers.get("Access-Control-Allow-Origin"), preview);
      const denied = await handler._handler({}, request(`https://backend.convex.site/${path}`, "https://other.vercel.app"));
      assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
    }
    const foreignVehicle = await upload._handler({}, request("https://backend.convex.site/vehicle-media/upload", "https://other.vercel.app"));
    assert.equal(foreignVehicle.status, 403);
    assert.equal(foreignVehicle.headers.get("Access-Control-Allow-Origin"), null);
    const foreignDocument = await documentUpload._handler({}, request("https://backend.convex.site/trust/document", "https://other.vercel.app"));
    assert.equal(foreignDocument.status, 400);
    assert.equal(foreignDocument.headers.get("Access-Control-Allow-Origin"), null);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
