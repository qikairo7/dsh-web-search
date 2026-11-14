/** Stable cache keys derived from resolved settings. */

const CACHE_CONTROL_FIELDS = new Set([
  'searchCacheTtlMs',
  'searchCacheMaxEntries',
  'fetchCacheTtlMs',
  'fetchCacheMaxEntries',
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !CACHE_CONTROL_FIELDS.has(key))
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

/** Fingerprint every resolved setting that can affect a result. */
export function resultFingerprint(settings) {
  return JSON.stringify(stableValue(settings));
}

/** Cache key for a search request: all result-affecting settings plus the request. */
export function searchCacheKey(settings, request) {
  return `search|${resultFingerprint(settings)}|${JSON.stringify(stableValue(request))}`;
}

/** Cache key for a fetch request: all result-affecting settings plus the request. */
export function fetchCacheKey(settings, request) {
  return `fetch|${resultFingerprint(settings)}|${JSON.stringify(stableValue(request))}`;
}
