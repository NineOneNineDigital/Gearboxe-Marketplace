import assert from "node:assert/strict";
import test from "node:test";
import { validateVehicle, assertStatusTransition } from "../convex/lib/vehicleValidation.ts";
import { parseDecodeResponse, fetchDecode } from "../convex/lib/autoDev.ts";

import { normalizeVin } from "../convex/lib/vinDecoder.ts";

const vin = "3GCUDHEL3NG668790";
const vehicle = {
  title: "2022 Chevrolet Silverado", make: "Chevrolet", model: "Silverado 1500", year: 2022,
  vin, mileage: 12000, price: 40000, trim: "ZR2", bodyStyle: "Truck", engine: "V8",
  transmission: "Automatic", drivetrain: "4WD", fuelType: "Gasoline", exteriorColor: "Blue", interiorColor: "Black",
  mileageUnit: "mi", odometerStatus: "actual", titleStatus: "clean", sellerState: "NC", condition: "good",
  mechanicalIssues: "None known", accidentDisclosure: "Unknown", damageDisclosure: "None known",
  serviceRecords: "partial", modifications: "None", sellerType: "private", location: { city: "Raleigh", state: "NC" },
  features: [], negotiable: true, description: "Well maintained vehicle with service records.", contactInfo: "Private contact",
};
test("submission requires disclosures while incomplete drafts remain private", () => {
  validateVehicle(vehicle, true);
  validateVehicle({ title: "", year: 2022, price: 0, mileage: 0 }, false);
  for (const field of ["vin", "mileageUnit", "accidentDisclosure", "mechanicalIssues", "sellerType", "location", "negotiable"]) {
    assert.throws(() => validateVehicle({ ...vehicle, [field]: undefined }, true), /required|declared/);
  }
  assert.throws(() => validateVehicle({ ...vehicle, sellerType: "dealer" }, true), /private/);
});
test("vehicle boundary validation and pre-1981 serials", () => {
  for (const override of [{ price: NaN }, { mileage: -1 }, { year: 3000 }, { vin: "INVALID" }, { numberOfOwners: 1.5 }, { sellerState: "North Carolina" }]) assert.throws(() => validateVehicle({ ...vehicle, ...override }, true));
  validateVehicle({ ...vehicle, year: 1967, vin: "ABC-12345" }, true);
});
test("owners cannot self approve and every rejection requires a reason", () => {
  assert.throws(() => assertStatusTransition("pending", "active", false), /Administrator/);
  assert.throws(() => assertStatusTransition("pending", "rejected", true), /reason/);
  assertStatusTransition("pending", "active", true);
  assertStatusTransition("active", "reserved", false);
  assertStatusTransition("reserved", "active", false);
  assertStatusTransition("active", "sold", false);
  assert.throws(() => assertStatusTransition("sold", "active", true), /Invalid/);
  assertStatusTransition("rejected", "pending", false);
});
const payload = { vin, vinValid: true, make: "Chevrolet", body: "Truck", drive: "4WD", engine: "V8", transmission: "Automatic", vehicle: { vin, year: 2022, make: "Chevrolet", model: "Silverado 1500" } };
test("documented Auto.dev response maps nested identity and specifications", () => {
  assert.equal(normalizeVin(` ${vin.toLowerCase()} `), vin);
  assert.throws(() => normalizeVin("bad"), /17-character/);
  const result = parseDecodeResponse(payload, vin);
  assert.equal(result.year, 2022); assert.equal(result.bodyStyle, "Truck"); assert.equal(result.drivetrain, "4WD");
  assert.equal(result.fuelType, undefined);
  for (const override of [{ vinValid: false }, { ambiguous: true }, { yearAmbiguous: true }, { vin: "OTHER" }, { vehicle: { ...payload.vehicle, year: null } }]) assert.throws(() => parseDecodeResponse({ ...payload, ...override }, vin));
});
test("Auto.dev requests use server bearer auth and sanitize provider errors", async () => {
  await fetchDecode(vin, "private-secret", async (url, options) => {
    assert.equal(url, `https://api.auto.dev/vin/${vin}`);
    assert.equal(options.headers.Authorization, "Bearer private-secret");
    return new Response(JSON.stringify(payload));
  });
  for (const status of [400, 404, 429, 500, 401]) {
    await assert.rejects(fetchDecode(vin, "private-secret", async () => new Response("private-secret", { status })), error => !error.message.includes("private-secret"));
  }
  await assert.rejects(fetchDecode(vin, "secret", async () => { throw new Error("private-secret"); }), /temporarily unavailable/);
  await assert.rejects(fetchDecode(vin, "secret", async () => new Response("not JSON")), /invalid response/);
});
