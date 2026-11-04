import assert from "node:assert/strict";
import test from "node:test";
import { readInventoryReturn, saveInventoryReturn } from "../lib/inventory-return.ts";

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test("inventory return state survives repeated refreshes and stays scoped to its search", () => {
  const store = storage();
  const url = "/vehicles?make=Toyota";
  saveInventoryReturn(store, { url, count: 12, scrollY: 300, layout: "grid" });
  // Loading more replaces the saved position before a refresh can occur.
  saveInventoryReturn(store, { url, count: 36, scrollY: 1800, layout: "list" });
  assert.equal(readInventoryReturn(store, "/vehicles?make=Honda"), null);
  const expected = { url, count: 36, scrollY: 1800, layout: "list", savedAt: Date.now() };
  assert.deepEqual(readInventoryReturn(store, url), expected);
  assert.deepEqual(readInventoryReturn(store, url), expected);
});

test("inventory return state ignores expired and malformed entries", () => {
  const store = storage();
  const url = "/vehicles";
  saveInventoryReturn(store, { url, count: 12, scrollY: 400, layout: "grid" });
  assert.equal(readInventoryReturn(store, url, Date.now() + 16 * 60 * 1000), null);
  store.setItem("vehicles:return", "broken JSON");
  assert.equal(readInventoryReturn(store, url), null);
  assert.equal(store.getItem("vehicles:return"), null);
  saveInventoryReturn(store, { url, count: 1000, scrollY: 400, layout: "grid" });
  assert.equal(readInventoryReturn(store, url)?.count, 240);
});
