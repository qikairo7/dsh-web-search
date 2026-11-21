/** Python-compatible encoding helpers for the X request builder.
 * Ported from catbus src/platforms/x@163424c67471d323ac3b1cb68e2b35a3427398ce (MIT).
 * Trimmed to the read-only search path (quote + compact JSON).
 */

const ALWAYS_SAFE = /[A-Za-z0-9_.\-~]/;

/** urllib.parse.quote(s, safe): percent-encode UTF-8 bytes outside the safe set. */
export function quote(s, safe = '/') {
  let out = '';
  for (const byte of Buffer.from(String(s), 'utf8')) {
    const ch = String.fromCharCode(byte);
    out += byte < 0x80 && (ALWAYS_SAFE.test(ch) || safe.includes(ch))
      ? ch
      : '%' + byte.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

/** json.dumps(v, separators=(',', ':'), ensure_ascii=False): compact, non-ASCII kept. */
export function compactJson(value) {
  return JSON.stringify(value);
}
