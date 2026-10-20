import assert from "node:assert/strict";
import test from "node:test";
import { questions, summarize } from "./check.ts";

function best() {
  return Object.fromEntries(
    questions.map((question) => {
      const safe = question.options.filter((option) => !option.urgent);
      const top = safe.reduce((chosen, option) => (option.score >= chosen.score ? option : chosen));
      return [question.id, top.id];
    }),
  );
}

test("full high answers stay a habit reflection, not a diagnosis", () => {
  const result = summarize(best());
  assert.equal(result.max, 14);
  assert.equal(result.score, 14);
  assert.equal(result.band, "terjaga");
  assert.equal(result.urgent, false);
  assert.equal(result.complete, true);
});

test("urgent flag stops the score from being a health verdict", () => {
  const answers = best();
  answers.flag = "f2";
  const result = summarize(answers);
  assert.equal(result.urgent, true);
  assert.equal(result.score, 0);
});

test("incomplete answers are not scored as a low habit band", () => {
  const result = summarize({ sleep: "s0" });
  assert.equal(result.complete, false);
  assert.equal(result.score, 0);
  assert.equal(result.band, "campuran");
});
