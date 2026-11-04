import assert from "node:assert/strict";
import test from "node:test";
import { readRequestBody } from "../lib/request-body.ts";
test("payment request body reader preserves provider text without parsing or reformatting", async () => {
  const text = '{ "name": "José", "amount": 4900 }\n';
  assert.equal(await readRequestBody(new Request("https://example.test", { method: "POST", body: text }), 100), text);
});
test("payment body limit measures actual UTF8 bytes without trusting declared size", async () => {
  const request = new Request("https://example.test", { method: "POST", headers: { "Content-Length": "1" }, body: "ééé" });
  assert.equal(await readRequestBody(request, 5), null);
  assert.equal(await readRequestBody(new Request("https://example.test", { method: "POST", headers: { "Content-Length": "100" }, body: "x" }), 10), null);
});
test("oversized streamed webhooks are canceled before reading the remaining body", async () => {
  let canceled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4)); controller.enqueue(new Uint8Array(4)); }, cancel() { canceled = true; } });
  const request = new Request("https://example.test", { method: "POST", body, duplex: "half" });
  assert.equal(await readRequestBody(request, 5), null); assert.equal(canceled, true);
});
