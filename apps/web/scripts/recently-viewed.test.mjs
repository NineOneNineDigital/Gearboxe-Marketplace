import assert from "node:assert/strict";
import test from "node:test";

async function fixture(testContext, name) {
  const storage = new Map();
  const browser = new EventTarget();
  browser.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.window = browser;
  testContext.after(() => {
    delete globalThis.window;
  });
  return {
    browser,
    storage,
    helper: await import(`../lib/recently-viewed.ts?test=${name}`),
  };
}

test("guest history rejects corrupt storage and untrusted identifiers", async (t) => {
  const { storage, helper } = await fixture(t, "corrupt");
  storage.set("gearboxe-recently-viewed", "not JSON");
  assert.deepEqual(helper.readLocalViews(), []);
  storage.set(
    "gearboxe-recently-viewed",
    JSON.stringify(["vehicle-1", "<script>", null, "vehicle-1", "vehicle-2"]),
  );
  assert.deepEqual(helper.readLocalViews(), ["vehicle-1", "vehicle-2"]);
  storage.set("gearboxe-recently-viewed", "x".repeat(5000));
  assert.deepEqual(helper.readLocalViews(), []);
});
test("guest history persists most recent first with bounded deduplication", async (t) => {
  const { helper } = await fixture(t, "bounded");
  for (let id = 0; id < 15; id++) helper.recordLocalView(`vehicle-${id}`);
  helper.recordLocalView("vehicle-10");
  const history = helper.readLocalViews();
  assert.equal(history.length, 12);
  assert.equal(history[0], "vehicle-10");
  assert.equal(new Set(history).size, 12);
  assert.equal(history.includes("vehicle-0"), false);
  assert.deepEqual(JSON.parse(helper.localViewsSnapshot()), history);
});
test("history updates subscribers and releases listeners", async (t) => {
  const { helper } = await fixture(t, "events");
  let updates = 0;
  const unsubscribe = helper.subscribeLocalViews(() => updates++);
  helper.recordLocalView("vehicle-1");
  assert.equal(updates, 1);
  unsubscribe();
  helper.recordLocalView("vehicle-2");
  assert.equal(updates, 1);
});
test("disabled or full browser storage retains usable session history", async (t) => {
  const { browser, helper } = await fixture(t, "disabled");
  browser.localStorage.setItem = () => {
    throw new Error("Quota exceeded");
  };
  helper.recordLocalView("vehicle-1");
  helper.recordLocalView("vehicle-2");
  assert.deepEqual(helper.readLocalViews(), ["vehicle-2", "vehicle-1"]);
});
