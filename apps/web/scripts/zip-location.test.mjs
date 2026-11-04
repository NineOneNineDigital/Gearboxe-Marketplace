import assert from "node:assert/strict";
import test from "node:test";
import { lookupZip } from "../lib/zip-location.ts";

test("ZIP lookup resolves a valid center and rejects invalid or unavailable results", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let requestedUrl = "";
    globalThis.fetch = async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({
        places: [{ latitude: "35.7796", longitude: "-78.6382" }],
      }), { status: 200 });
    };
    assert.deepEqual(await lookupZip("27601"), {
      latitude: 35.7796,
      longitude: -78.6382,
    });
    assert.equal(requestedUrl, "https://api.zippopotam.us/us/27601");
    await assert.rejects(lookupZip("2760"), /five-digit ZIP/);

    globalThis.fetch = async () => new Response(null, { status: 404 });
    await assert.rejects(lookupZip("99999"), /ZIP code not found/);

    globalThis.fetch = async () => new Response(JSON.stringify({ places: [{ latitude: "999", longitude: "-78" }] }), { status: 200 });
    await assert.rejects(lookupZip("27601"), /ZIP lookup is unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
