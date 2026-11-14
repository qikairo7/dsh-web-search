/** Shared helpers for provider adapters. */

import { webError } from '../errors.js';

const USER_AGENT = 'dsh-web-search-router/0.1.0';

/** Clamp a requested result count to a provider's supported range. */
export function clampCount(value, fallback, max) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
}

/**
 * Build the JSON request headers shared by provider adapters.
 *
 * @param {string | undefined} apiKey - optional bearer token.
 * @param {Record<string, string>} [extra] - provider-specific headers.
 * @returns {Record<string, string>}
 */
export function jsonHeaders(apiKey, extra = {}) {
  return {
    ...(apiKey === undefined ? {} : { authorization: `Bearer ${apiKey}` }),
    'content-type': 'application/json',
    'user-agent': USER_AGENT,
    ...extra,
  };
}

/**
 * Build a text fetch result for the web seam and truncate it once at maxChars.
 *
 * @param {string} url
 * @param {string} content
 * @param {number} maxChars
 * @param {number} [statusCode]
 */
export function textResult(url, content, maxChars, statusCode = 200) {
  const truncated = content.length > maxChars;
  return {
    url,
    statusCode,
    body: { kind: 'text', content: truncated ? content.slice(0, maxChars) : content },
    truncated,
  };
}

/** Require a provider credential or throw the seam's credential-missing error. */
export function requireKey(apiKey, label) {
  if (apiKey === undefined) {
    throw webError(`${label} is not configured`, 'WEB_PROVIDER_CREDENTIAL_MISSING');
  }
  return apiKey;
}
