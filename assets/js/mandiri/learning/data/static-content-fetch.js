import { learningContentError, mapLearningContentError } from './content-loader-errors.js';

function parseContentLength(response) {
  const raw = response?.headers?.get?.('content-length');
  if (raw === null || raw === undefined || raw === '') return null;
  if (!/^\d+$/u.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function fetchStaticContentBytes({
  fetchImpl,
  url,
  maxBytes,
  loadErrorCode,
  tooLargeCode,
}) {
  if (typeof fetchImpl !== 'function') throw learningContentError(loadErrorCode);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      credentials: 'same-origin',
      redirect: 'error',
    });
  } catch (error) {
    throw learningContentError(loadErrorCode, error);
  }
  if (!response?.ok || typeof response.arrayBuffer !== 'function') {
    throw learningContentError(loadErrorCode);
  }
  const declaredLength = parseContentLength(response);
  if (declaredLength !== null && declaredLength > maxBytes) {
    throw learningContentError(tooLargeCode);
  }
  let buffer;
  try {
    buffer = await response.arrayBuffer();
  } catch (error) {
    throw learningContentError(loadErrorCode, error);
  }
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength > maxBytes) throw learningContentError(tooLargeCode);
  return bytes;
}

export function parseStaticJson(bytes, invalidCode) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return JSON.parse(text);
  } catch (error) {
    throw mapLearningContentError(error, invalidCode);
  }
}
