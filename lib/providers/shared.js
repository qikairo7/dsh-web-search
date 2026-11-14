/** Shared helpers for provider adapters. */

import { toWebError, webError } from '../errors.js';
import { isHTTPURL, requestJSON, requestText } from '../http.js';

/** User agent sent by every adapter request; the single source for all providers. */
export const USER_AGENT = 'dsh-web-search-router/0.1.0';

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

/** True when a provider's `{ enabled, baseURL }` config makes it available. */
export function isProviderAvailable(config) {
  return config.enabled === true && isHTTPURL(config.baseURL);
}

/** True when the credential referenced by the config resolves to a key. */
export async function hasCredential(resolveKey, config) {
  return (await resolveKey(config.apiKeyEnv)) !== undefined;
}

/**
 * Run one provider operation through the shared request wiring and error
 * boundary. Adapters declare only their endpoint, request, and mapping; this
 * helper owns the requestJSON plumbing every operation repeats.
 *
 * @param {object} operation - one provider operation.
 * @param {object} operation.settings - settings resolved for this call.
 * @param {string} operation.provider - provider display name.
 * @param {string} operation.operation - operation name for seam errors.
 * @param {string} operation.url - final request URL.
 * @param {object} [operation.request={}] - requestJSON options for this call
 *   (method, headers, body, signal, redirect).
 * @param {boolean} [operation.isFetch=false] - fetch semantics; timeouts map
 *   to `WEB_FETCH_TIMEOUT` instead of `WEB_PROVIDER_ERROR`.
 * @param {string} [operation.label=operation.operation] - operation label for
 *   requestJSON diagnostics when it differs from the seam operation.
 * @param {boolean} [operation.text=false] - request a text body instead of JSON.
 * @param {(data: any) => unknown} [operation.map] - maps the parsed response;
 *   runs inside the guarded boundary so mapping failures become seam errors.
 * @returns {Promise<unknown>} The mapped result.
 */
export async function providerOperation({
  settings,
  provider,
  operation,
  url,
  request = {},
  isFetch = false,
  label = operation,
  text = false,
  map = (data) => data,
}) {
  const options = {
    timeoutMs: settings.requestTimeoutMs,
    ...(isFetch === true ? { timeoutCode: 'WEB_FETCH_TIMEOUT' } : {}),
    provider,
    operation: label,
    ...request,
  };
  try {
    const { data } = await (text === true ? requestText(url, options) : requestJSON(url, options));
    return map(data);
  } catch (error) {
    throw toWebError(error, provider, operation, { fetch: isFetch === true });
  }
}
