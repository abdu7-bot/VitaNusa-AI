export const UPSTREAM_URL = "https://api.x.ai/v1/chat/completions";
export const UPSTREAM_TIMEOUT_MS = 20_000;

export function isRetryableStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

export type UpstreamResult =
  | { ok: true; response: Response }
  | { ok: false; reason: "timeout" | "network" | "http"; status?: number };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

function isTimeout(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError";
}

/**
 * One POST to the chat completions API, with a single retry on 502/503/504.
 * A timeout or network error is not retried. The API key is sent only as a
 * header and is not logged.
 */
export async function postChatCompletion(options: {
  apiKey: string;
  body: unknown;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<UpstreamResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const once = () =>
    fetchImpl(UPSTREAM_URL, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(options.body),
    });

  try {
    let response = await once();
    if (isRetryableStatus(response.status)) response = await once();
    if (!response.ok) return { ok: false, reason: "http", status: response.status };
    return { ok: true, response };
  } catch (error) {
    return { ok: false, reason: isTimeout(error) ? "timeout" : "network" };
  }
}
