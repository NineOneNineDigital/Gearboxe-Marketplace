import assert from "node:assert/strict";
import test from "node:test";
import { saveSignupPolicyIntent, matchingSignupPolicyIntent, clearSignupPolicyIntent } from "../lib/signup-policy-intent.ts";

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

const pair = { termsVersion: "terms-1", privacyVersion: "privacy-1" };

test("signup action is bound to one policy pair, token and short time window", () => {
  const store = storage();
  assert.equal(saveSignupPolicyIntent(store, pair, "nonce", 1000), true);
  assert.equal(matchingSignupPolicyIntent(store, pair, "nonce", 1000 + 14 * 60 * 1000), true);
  assert.equal(matchingSignupPolicyIntent(store, pair, "wrong", 1001), false);
  assert.equal(matchingSignupPolicyIntent(store, pair, "nonce", 1001), false);
  saveSignupPolicyIntent(store, pair, "fresh", 1000);
  assert.equal(matchingSignupPolicyIntent(store, { ...pair, privacyVersion: "privacy-2" }, "fresh", 1001), false);
  saveSignupPolicyIntent(store, pair, "expired", 1000);
  assert.equal(matchingSignupPolicyIntent(store, pair, "expired", 1000 + 15 * 60 * 1000 + 1), false);
});

test("intent is cleared after use and unavailable storage falls back to manual acceptance", () => {
  const store = storage();
  saveSignupPolicyIntent(store, pair, "nonce", 1000);
  clearSignupPolicyIntent(store);
  assert.equal(matchingSignupPolicyIntent(store, pair, "nonce", 1001), false);
  const unavailable = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); }, removeItem() { throw Error("blocked"); } };
  assert.equal(saveSignupPolicyIntent(unavailable, pair, "nonce", 1000), false);
  assert.equal(matchingSignupPolicyIntent(unavailable, pair, "nonce", 1001), false);
  clearSignupPolicyIntent(unavailable);
});
