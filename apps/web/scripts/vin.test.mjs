import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVin, selectVinDecoder } from "../convex/lib/vinDecoder.ts";
import { parseVpicResponse, fetchVpicDecode } from "../convex/lib/vpic.ts";

const vin = "3GCUDHEL3NG668790";
const row = { VIN: vin, ErrorCode: "0", SuggestedVIN: "", ModelYear: "2022", Make: "CHEVROLET", Model: "Silverado",
  Trim: "ZR2", BodyClass: "Pickup", DriveType: "4WD", FuelTypePrimary: "Gasoline", DisplacementL: "6.2", EngineCylinders: "8" };
const payload = { Results: [row] };

test("provider selection preserves Auto.dev default and supports credential-free vPIC", async () => {
  const decoded = { vin, year: 2022, make: "CHEVROLET", model: "Silverado" };
  const providers = {
    auto_dev: key => { assert.equal(key, "server-key"); return { decode: async value => { assert.equal(value, vin); return decoded; } }; },
    vpic: () => ({ decode: async () => decoded }),
  };
  assert.deepEqual(await selectVinDecoder({ AUTO_DEV_API_KEY: "server-key" }, providers).decode(normalizeVin(vin.toLowerCase())), decoded);
  assert.deepEqual(await selectVinDecoder({ VIN_DECODER_PROVIDER: "vpic" }, providers).decode(vin), decoded);
  assert.throws(() => selectVinDecoder({}, providers), /not configured/);
  assert.throws(() => selectVinDecoder({ VIN_DECODER_PROVIDER: "unknown" }, providers), /not configured correctly/);
});

test("vPIC adapter normalizes identity and optional fields without inventing missing specifications", () => {
  const result = parseVpicResponse(payload, vin);
  assert.equal(result.year, 2022);
  assert.equal(result.bodyStyle, "Pickup");
  assert.equal(result.engine, "6.2 L · 8 cylinders");
  assert.equal(result.transmission, undefined);
  assert.equal("ErrorCode" in result, false);
  assert.equal("SuggestedVIN" in result, false);
  for (const override of [{ ErrorCode: "1" }, { ErrorCode: "0,14" }, { ErrorCode: undefined }, { SuggestedVIN: "OTHER" }, { VIN: "OTHER" }, { ModelYear: "unknown" }, { Make: "" }]) {
    assert.throws(() => parseVpicResponse({ Results: [{ ...row, ...override }] }, vin));
  }
  for (const bad of [null, {}, { Results: [] }, { Results: [row, row] }, { Results: [null] }]) assert.throws(() => parseVpicResponse(bad, vin));
});

test("vPIC requests are bounded and expose recoverable sanitized failures", async () => {
  await fetchVpicDecode(vin, async (url, options) => {
    assert.equal(url, `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`);
    assert.equal(options.headers.Authorization, undefined);
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify(payload));
  });
  for (const status of [400, 404, 429, 500]) {
    await assert.rejects(fetchVpicDecode(vin, async () => new Response("private provider response", { status })), error => !error.message.includes("private provider response"));
  }
  await assert.rejects(fetchVpicDecode(vin, async () => { throw new Error("private upstream data"); }), /temporarily unavailable/);
  await assert.rejects(fetchVpicDecode(vin, async () => new Response("not json")), /invalid response/);
});
