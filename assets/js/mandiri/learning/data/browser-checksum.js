import { learningContentError } from './content-loader-errors.js';

function asUint8Array(value) {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw learningContentError('checksum_unavailable');
}

export async function createBrowserSha256(bytes, cryptoRef = globalThis.crypto) {
  if (!cryptoRef?.subtle || typeof cryptoRef.subtle.digest !== 'function') {
    throw learningContentError('checksum_unavailable');
  }
  let digest;
  try {
    digest = await cryptoRef.subtle.digest('SHA-256', asUint8Array(bytes));
  } catch (error) {
    throw learningContentError('checksum_unavailable', error);
  }
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

export function getUtf8ByteLength(value, TextEncoderRef = globalThis.TextEncoder) {
  if (typeof value !== 'string' || typeof TextEncoderRef !== 'function') {
    throw learningContentError('content_json_invalid');
  }
  return new TextEncoderRef().encode(value).byteLength;
}
