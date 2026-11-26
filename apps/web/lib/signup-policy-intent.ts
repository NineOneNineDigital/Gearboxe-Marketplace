const STORAGE_KEY = "gearboxe.signup-policy-intent";
const MAX_AGE_MS = 15 * 60 * 1000;

export type SignupPolicyPair = { termsVersion: string; privacyVersion: string };
type Intent = SignupPolicyPair & { token: string; createdAt: number };
type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// This is a same-tab handoff of the signup button action, not policy evidence.
// The server still chooses the current pair and creates the acceptance record.
export function saveSignupPolicyIntent(store: SessionStore, pair: SignupPolicyPair, token: string, now = Date.now()) {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ ...pair, token, createdAt: now } satisfies Intent));
    return true;
  } catch {
    return false;
  }
}

export function matchingSignupPolicyIntent(store: SessionStore, pair: SignupPolicyPair, token: string, now = Date.now()) {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return false;
    const intent: Intent = JSON.parse(raw);
    const matches = intent.token === token && token.length > 0 &&
      intent.termsVersion === pair.termsVersion && intent.privacyVersion === pair.privacyVersion &&
      Number.isFinite(intent.createdAt) && intent.createdAt <= now && now - intent.createdAt <= MAX_AGE_MS;
    if (!matches) store.removeItem(STORAGE_KEY);
    return matches;
  } catch {
    try { store.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    return false;
  }
}

export function clearSignupPolicyIntent(store: SessionStore) {
  try { store.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
}
