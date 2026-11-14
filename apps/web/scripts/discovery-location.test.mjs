import assert from "node:assert/strict";
import test from "node:test";
import { readRememberedZip, REMEMBERED_ZIP_KEY, withoutGeography } from "../lib/discovery-location.ts";
import { lookupZip } from "../lib/zip-location.ts";

test("nationwide retains vehicle filters while removing all geography", () => {
  assert.deepEqual(withoutGeography({ make: "Toyota", minPrice: 1000, minYear: 2020, state: "NC", zip: "27601", latitude: 35, longitude: -78, radiusMiles: 50 }), { make: "Toyota", minPrice: 1000, minYear: 2020 });
});
test("only a valid browser-local ZIP is restored", () => {
  assert.equal(readRememberedZip({ getItem: key => key === REMEMBERED_ZIP_KEY ? "02108" : null }), "02108");
  assert.equal(readRememberedZip({ getItem: () => "bad" }), null);
  assert.equal(readRememberedZip({ getItem: () => null }), null);
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
