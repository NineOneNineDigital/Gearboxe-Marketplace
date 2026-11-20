import assert from "node:assert/strict";
import { test } from "node:test";

const { mileageAsMiles, wantedResponseDifferences } = await import("../lib/wanted-response.ts");

test("listing mileage is converted to miles before using it in a wanted response", () => {
  assert.equal(mileageAsMiles(160934, "km"), 100000);
  assert.equal(mileageAsMiles(100000, "mi"), 100000);
});

test("response review cues cover price, mileage, and general location", () => {
  const request = { maxBudget: 15000, maxMileage: 100000, area: "Raleigh, NC", radiusMiles: 50 };
  const form = { year: "2018", make: "Honda", model: "Civic", askingPrice: "16000", mileage: "110000", city: "Durham", state: "NC" };
  assert.deepEqual(wantedResponseDifferences(request, form), ["price", "mileage", "location (check the requested radius)"]);
  assert.deepEqual(wantedResponseDifferences({ ...request, radiusMiles: undefined }, form), ["price", "mileage"]);
});
