import assert from "node:assert/strict";
import test from "node:test";
import { isRetryableStatus, postChatCompletion, UPSTREAM_TIMEOUT_MS, UPSTREAM_URL } from "./upstream.ts";

function response(status: number, body = "{}") {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

function namedError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

test("gateway statuses retry once; other HTTP failures do not", () => {
  assert.equal(isRetryableStatus(502), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(504), true);
  assert.equal(isRetryableStatus(500), false);
  assert.equal(isRetryableStatus(429), false);
  assert.equal(UPSTREAM_TIMEOUT_MS, 20_000);
});

test("a timeout or abort is a timeout, and it is not retried", async () => {
  let calls = 0;
  const result = await postChatCompletion({
    apiKey: "test-key",
    body: { messages: [] },
    timeoutMs: 20_000,
    fetchImpl: async () => {
      calls += 1;
      throw namedError("TimeoutError");
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: false, reason: "timeout" });

  const aborted = await postChatCompletion({
    apiKey: "test-key",
    body: { messages: [] },
    fetchImpl: async () => {
      throw namedError("AbortError");
    },
  });
  assert.equal(aborted.ok, false);
  if (!aborted.ok) assert.equal(aborted.reason, "timeout");
});

test("a non-timeout fetch failure is a network failure and is not retried", async () => {
  let calls = 0;
  const result = await postChatCompletion({
    apiKey: "test-key",
    body: { messages: [] },
    fetchImpl: async () => {
      calls += 1;
      throw new Error("ECONNRESET");
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: false, reason: "network" });
});

test("502, 503, and 504 are retried once and a later success is kept", async () => {
  const calls: RequestInit[] = [];
  const result = await postChatCompletion({
    apiKey: "test-key",
    body: { model: "grok-4.5", messages: [{ role: "user", content: "tidur" }] },
    fetchImpl: async (url, init) => {
      calls.push(init);
      assert.equal(url, UPSTREAM_URL);
      return calls.length === 1 ? response(503) : response(200, "{\"choices\":[]}");
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(result.ok, true);
  const headers = new Headers(calls[0].headers);
  assert.equal(headers.get("authorization"), "Bearer test-key");
  assert.equal(JSON.parse(String(calls[0].body)).model, "grok-4.5");
  assert.ok(calls[0].signal instanceof AbortSignal);
});

test("a second gateway failure stays an HTTP failure", async () => {
  let calls = 0;
  const result = await postChatCompletion({
    apiKey: "test-key",
    body: {},
    fetchImpl: async () => {
      calls += 1;
      return response(calls === 1 ? 502 : 504);
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, { ok: false, reason: "http", status: 504 });
});

test("a non-retryable HTTP status is returned without a second call", async () => {
  let calls = 0;
  const result = await postChatCompletion({
    apiKey: "test-key",
    body: {},
    fetchImpl: async () => {
      calls += 1;
      return response(500);
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: false, reason: "http", status: 500 });
});
