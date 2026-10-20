import assert from "node:assert/strict";
import test from "node:test";
import { reserveModelSlot, resetSlots, takeSlot } from "./limit.ts";

test("model slot closes after the window limit", () => {
  resetSlots();
  for (let i = 0; i < 3; i += 1) assert.equal(takeSlot("nusa", 3, 60_000, 1_000), true);
  assert.equal(takeSlot("nusa", 3, 60_000, 1_000), false);
  assert.equal(takeSlot("nusa", 3, 60_000, 61_001), true);
});

test("nusa and navigator buckets are separate process memory", () => {
  resetSlots();
  assert.equal(takeSlot("nusa", 1, 60_000, 5_000), true);
  assert.equal(takeSlot("nusa", 1, 60_000, 5_000), false);
  assert.equal(takeSlot("navigator", 1, 60_000, 5_000), true);
  resetSlots();
  assert.equal(takeSlot("nusa", 1, 60_000, 5_000), true);
});

test("a missing API key does not consume the navigator slot", () => {
  resetSlots();
  assert.equal(reserveModelSlot(undefined, "navigator", 1, 60_000, 10), false);
  assert.equal(reserveModelSlot("", "navigator", 1, 60_000, 10), false);
  assert.equal(reserveModelSlot("present", "navigator", 1, 60_000, 10), true);
  assert.equal(reserveModelSlot("present", "navigator", 1, 60_000, 10), false);
});
