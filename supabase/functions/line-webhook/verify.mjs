// ============================================================
// line-webhook · verify.mjs   (PURE — Web Crypto only)
// LINE webhook signature check: HMAC-SHA256(channelSecret, rawBody),
// base64, constant-time compared against the X-Line-Signature header.
// Uses globalThis.crypto.subtle + atob + TextEncoder — available in Deno
// and Node 18+, so node --test exercises the real crypto path.
//
// This is THE security boundary of the webhook (GAS cannot read request
// headers, which is why the webhook lives on a Supabase Edge Function).
// ============================================================

function b64ToBytes(b64) {
  const bin = atob(b64); // throws on invalid base64 → caught by caller
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Constant-time compare (no early-return on equal-length inputs).
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Compute the base64 HMAC-SHA256 the way LINE signs webhook request bodies.
export async function computeSignature(channelSecret, rawBody) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const bodyBytes = typeof rawBody === 'string' ? enc.encode(rawBody) : rawBody;
  const sig = await crypto.subtle.sign('HMAC', key, bodyBytes);
  return new Uint8Array(sig);
}

// True only if `signatureB64` is a valid LINE signature for `rawBody`.
// Returns false (never throws) on empty/garbage input.
export async function verifyLineSignature(channelSecret, rawBody, signatureB64) {
  if (!channelSecret || !signatureB64) return false;
  try {
    const expected = await computeSignature(channelSecret, rawBody);
    return timingSafeEqual(expected, b64ToBytes(signatureB64));
  } catch (_e) {
    return false;
  }
}
