import assert from "node:assert/strict";
import test from "node:test";
import { resetSlots, takeSlot } from "./limit.ts";

test("model slot closes after the window limit", () => {
  resetSlots();
  for (let i = 0; i < 3; i += 1) assert.equal(takeSlot("nusa", 3, 60_000, 1_000), true);
  assert.equal(takeSlot("nusa", 3, 60_000, 1_000), false);
  assert.equal(takeSlot("nusa", 3, 60_000, 61_001), true);
});
