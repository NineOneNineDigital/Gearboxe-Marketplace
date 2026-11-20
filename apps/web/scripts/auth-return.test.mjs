import assert from "node:assert/strict";
import test from "node:test";
import { listingReturnPath, policyConsentPath } from "../lib/auth-return.ts";

test("sign-in return path accepts public listings and exact seller editor destinations", () => {
  assert.equal(listingReturnPath("?next=%2Fvehicles%2Fabc123"), "/vehicles/abc123");
  assert.equal(listingReturnPath("?next=%2Fvehicles%2Fabc123%3Foffer%3D1"), "/vehicles/abc123?offer=1");
  for (const path of ["/myAccount/new-listing", "/myAccount/new-listing?edit=ab123"]) {
    assert.equal(listingReturnPath(`?next=${encodeURIComponent(path)}`), path);
  }
  const conversation = "/myAccount/messages/vehicle123/seller456";
  assert.equal(listingReturnPath(`?next=${encodeURIComponent(conversation)}`), conversation);
  for (const next of ["//outside.example", "https://outside.example", "/myAccount", "/vehicles/id?admin=1", "/vehicles/id?offer=1&next=https://outside.example", "/vehicles/id?offer=%2Foutside.example", "/vehicles/id/extra", "/vehicles/%2foutside.example", "/myAccount/new-listing?edit=abc&next=https://example.test", "/myAccount/new-listing?edit=%2Foutside.example", "/myAccount/messages/vehicle/seller?next=https://example.test", "/myAccount/messages/vehicle/%2Foutside.example"]) {
    assert.equal(listingReturnPath(`?next=${encodeURIComponent(next)}`), "/myAccount");
  }
});

test("policy consent handoff preserves only validated local return paths", () => {
  const listing = "/vehicles/abc123?offer=1";
  const handoff = policyConsentPath(`?next=${encodeURIComponent(listing)}`);
  assert.equal(handoff, `/accept-policies?next=${encodeURIComponent(listing)}`);
  assert.equal(listingReturnPath(new URL(handoff, "https://gearboxe.test").search), listing);
  assert.equal(policyConsentPath("?next=https%3A%2F%2Foutside.example"), "/accept-policies?next=%2FmyAccount");
});


test("offer notification return path remains local and preserves only an opaque offer ID", () => {
  const path = "/myAccount/messages?offer=abc123";
  assert.equal(listingReturnPath(`?next=${encodeURIComponent(path)}`), path);
  for (const next of ["/myAccount/messages?offer=abc&next=https://outside.example", "/myAccount/messages?offer=%2Foutside.example", "//outside.example/myAccount/messages?offer=abc"]) {
    assert.equal(listingReturnPath(`?next=${encodeURIComponent(next)}`), "/myAccount");
  }
});
