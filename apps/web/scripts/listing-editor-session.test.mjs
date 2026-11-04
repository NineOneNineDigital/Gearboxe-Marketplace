import test from "node:test";
import assert from "node:assert/strict";
import { transitionListingEditorSession as transition } from "../lib/listing-editor-session.ts";

test("first self-issued draft URL keeps its editor and uploads", () => {
  const previous = { routeId: null, generation: 0, createdId: "draft-a" };
  assert.deepEqual(transition(previous, "draft-a"), { ...previous, routeId: "draft-a" });
});
test("opening another listing or a fresh listing resets the editor session", () => {
  const previous = { routeId: "draft-a", generation: 3, createdId: "draft-a" };
  assert.deepEqual(transition(previous, null), { routeId: null, generation: 4, createdId: null });
  assert.deepEqual(transition(previous, "draft-b"), { routeId: "draft-b", generation: 4, createdId: null });
});
test("stale creation does not make an unrelated route part of the current editor", () => {
  const previous = { routeId: "draft-b", generation: 2, createdId: "draft-a" };
  assert.equal(transition(previous, "draft-a").generation, 3);
  assert.equal(transition(previous, "draft-b"), previous);
});
