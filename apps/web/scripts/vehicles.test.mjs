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
const { validateVehicle, assertStatusTransition } = await import("../convex/lib/vehicleValidation.ts");
const { parseDecodeResponse, fetchDecode } = await import("../convex/lib/autoDev.ts");
const { normalizeVin } = await import("../convex/lib/vinDecoder.ts");
const { US_STATE_CODES } = await import("../lib/us-states.ts");
const { publicVehicle } = await import("../convex/lib/vehicleVisibility.ts");

const vin = "3GCUDHEL3NG668790";
const vehicle = {
  title: "2022 Chevrolet Silverado", make: "Chevrolet", model: "Silverado 1500", year: 2022,
  vin, mileage: 12000, price: 40000, trim: "ZR2", bodyStyle: "Truck", engine: "V8",
  transmission: "Automatic", drivetrain: "4WD", fuelType: "Gasoline", exteriorColor: "Blue", interiorColor: "Black",
  mileageUnit: "mi", odometerStatus: "actual", titleStatus: "clean", sellerState: "NC", condition: "good",
  lienStatus: "none", vehicleCategory: "truck", mechanicalIssues: "None known", accidentDisclosure: "Unknown", damageDisclosure: "None known",
  serviceRecords: "partial", modifications: "None", sellerType: "private", location: { city: "Raleigh", state: "NC", postalCode: "27601", latitude: 35.78, longitude: -78.64 },
  features: [], negotiable: true, description: "Well maintained vehicle with service records.", contactInfo: "Private contact",
};
test("submission requires disclosures while incomplete drafts remain private", () => {
  validateVehicle(vehicle, true);
  validateVehicle({ title: "", year: 2022, price: 0, mileage: 0 }, false);
  assert.throws(() => validateVehicle({ ...vehicle, location: { city: "Raleigh", state: "NC" } }, true), /approximate vehicle location/);
  validateVehicle({ ...vehicle, location: { city: "Raleigh", state: "NC" } }, false);
  for (const field of ["vin", "mileageUnit", "sellerType", "location", "negotiable"]) {
    assert.throws(() => validateVehicle({ ...vehicle, [field]: undefined }, true), /required|declared/);
  }
  assert.throws(() => validateVehicle({ ...vehicle, sellerType: "dealer" }, true), /private/);
});
test("disclosure details may be blank or whitespace while supplied text remains bounded", () => {
  for (const field of ["mechanicalIssues", "accidentDisclosure", "damageDisclosure"]) {
    for (const value of [undefined, "", "  \n ", "Known issue requiring repair"]) validateVehicle({ ...vehicle, [field]: value }, true);
    assert.throws(() => validateVehicle({ ...vehicle, [field]: "x".repeat(10001) }, true), /too long/);
  }
  validateVehicle({ ...vehicle, mechanicalIssues: "", accidentDisclosure: " ", damageDisclosure: "" }, true);
});

test("lien status and an outstanding payoff plan are required at submission", () => {
  for (const lienStatus of ["none", "uncertain"]) validateVehicle({ ...vehicle, lienStatus }, true);
  validateVehicle({ ...vehicle, lienStatus: "outstanding", lienPayoffPlan: "Pay lender at closing before title transfer" }, true);
  for (const lienStatus of [undefined, "", "unknown"] ) assert.throws(() => validateVehicle({ ...vehicle, lienStatus }, true), /lien status/i);
  for (const lienPayoffPlan of [undefined, "", "   "]) assert.throws(() => validateVehicle({ ...vehicle, lienStatus: "outstanding", lienPayoffPlan }, true), /payoff/i);
  assert.throws(() => validateVehicle({ ...vehicle, lienStatus: "outstanding", lienPayoffPlan: "a".repeat(1001) }, true), /1,000/);
});

test("public listing responses omit private lien plans and availability audit data", () => {
  const result = publicVehicle({ ...vehicle, status: "active", lienStatus: "outstanding", lienPayoffPlan: "Private lender account 123", availabilityHistory: [{ kind: "confirmed", at: 1, actorId: "private-user" }], availabilityDueAt: 999 });
  assert.equal(result.lienStatus, "outstanding");
  assert.equal(result.lienPayoffPlan, undefined);
  assert.equal(result.availabilityHistory, undefined);
  assert.equal(result.availabilityDueAt, 999);
});

test("only launch vehicle categories can be submitted", () => {
  for (const vehicleCategory of ["car", "truck", "suv", "specialty"]) validateVehicle({ ...vehicle, vehicleCategory }, true);
  for (const vehicleCategory of [undefined, "", "motorcycle", "rv", "parts", "dealer"]) assert.throws(() => validateVehicle({ ...vehicle, vehicleCategory }, true), /category/i);
  validateVehicle({ ...vehicle, vehicleCategory: undefined }, false);
});

test("vehicle boundary validation and pre-1981 serials", () => {
  for (const override of [{ price: NaN }, { mileage: -1 }, { year: 3000 }, { vin: "INVALID" }, { numberOfOwners: 1.5 }, { sellerState: "North Carolina" }, { sellerState: "ZZ" }, { location: { city: "Raleigh", state: "ZZ" } }]) assert.throws(() => validateVehicle({ ...vehicle, ...override }, true));
  assert.equal(US_STATE_CODES.size, 51);
  for (const state of US_STATE_CODES) validateVehicle({ ...vehicle, sellerState: state, location: { city: "Example", state, latitude: 35.78, longitude: -78.64 } }, true);
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
const { displayDisclosure } = await import("../lib/disclosure.ts");
test("blank seller disclosures use neutral wording and text is retained", () => {
  for (const value of [undefined, "", " \n\t"]) assert.equal(displayDisclosure(value), "No issue disclosed by seller");
  assert.equal(displayDisclosure("  Engine leaks oil  "), "Engine leaks oil");
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
  await assert.rejects(fetchDecode(vin, "secret", async () => new Response(JSON.stringify({ vin, vinValid: true, reason: "class_not_covered" }), { status: 207 })), /partial vehicle details/);
  await assert.rejects(fetchDecode(vin, "secret", async () => new Response("", { status: 403 })), /credentials were rejected/);
  await assert.rejects(fetchDecode(vin, "secret", async () => { throw new Error("private-secret"); }), /temporarily unavailable/);
  await assert.rejects(fetchDecode(vin, "secret", async () => new Response("not JSON")), /invalid response/);
});
