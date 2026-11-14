import "./popup-test-environment.mjs";
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

const { hasOutstandingEventPayments, validateDeployment } = await import("../convex/admin.ts");

function fixture(table, row) {
  const tables = table ? { [table]: [row] } : {};
  return {
    db: { query(name) {
      const filters = [];
      const builder = { eq(field, value) { filters.push(item => item[field] === value); return builder; } };
      return { withIndex(_index, callback) { callback(builder); return { first: async () => (tables[name] ?? []).find(item => filters.every(filter => filter(item))) ?? null }; } };
    } },
  };
}

test("release guard recognizes event charges, holds, refunds, and webhook recovery work", async () => {
  assert.equal(await hasOutstandingEventPayments._handler(fixture(), {}), false);
  for (const [table, row] of [
    ["eventReservations", { status: "held" }],
    ["eventReservations", { status: "refund_pending" }],
    ["eventPayments", { status: "paid" }],
    ["eventPayments", { status: "refund_pending" }],
    ["eventPayments", { status: "refund_failed" }],
    ["registrations", { paymentStatus: "completed" }],
    ["registrations", { paymentStatus: "refund_pending" }],
    ["stripeWebhookEvents", { status: "pending" }],
    ["stripeWebhookEvents", { status: "failed" }],
  ]) assert.equal(await hasOutstandingEventPayments._handler(fixture(table, row), {}), true, `${table}: ${row.status ?? row.paymentStatus}`);
  assert.equal(await hasOutstandingEventPayments._handler(fixture("eventPayments", { status: "refunded" }), {}), false);
});

test("disabled popup deployment keeps both web and backend credentials while payment recovery is outstanding", async () => {
  const previousFlag = process.env.NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED;
  const previousKey = process.env.STRIPE_SECRET_KEY;
  const previousWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  const context = (outstanding) => ({ runQuery: async () => outstanding });
  try {
    process.env.NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED = "false";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const args = { expectedEnvironment: "staging", expectedPopupPaymentsEnabled: false, webPaymentRecoveryConfigured: false };
    await assert.rejects(validateDeployment._handler(context(true), args), /Keep web and backend Stripe/);
    assert.equal((await validateDeployment._handler(context(false), args)).ready, true);
    process.env.STRIPE_SECRET_KEY = "sk_test_recovery_fixture";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_recovery_fixture";
    await assert.rejects(validateDeployment._handler(context(true), args), /Keep web and backend Stripe/);
    assert.equal((await validateDeployment._handler(context(true), { ...args, webPaymentRecoveryConfigured: true })).ready, true);
  } finally {
    if (previousFlag === undefined) delete process.env.NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED;
    else process.env.NEXT_PUBLIC_POPUP_PAYMENTS_ENABLED = previousFlag;
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
    if (previousWebhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previousWebhook;
  }
});
