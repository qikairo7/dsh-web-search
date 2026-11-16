/** Error plumbing shared by every provider adapter. */

/**
 * Structurally equivalent fallback used by unit tests and direct library use.
 * The production entry swaps in the real `WebError` class from
 * `@deepseek-ai/dsh-web` before registering providers.
 */
export class ProviderError extends Error {
  constructor(message, code = 'WEB_PROVIDER_ERROR', options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'WebError';
    this.code = code;
  }
}

let WebErrorClass = ProviderError;

/** Install the seam's `WebError` class for subsequent provider errors. */
export function setWebErrorClass(ctor) {
  WebErrorClass = typeof ctor === 'function' ? ctor : ProviderError;
}

/** Build a seam-compatible error. */
export function webError(message, code = 'WEB_PROVIDER_ERROR', options = {}) {
  return new WebErrorClass(message, code, options);
}

/** True when this value is already a seam error (production or fallback). */
export function isSeamError(error) {
  return (
    error !== null &&
    typeof error === 'object' &&
    error.name === 'WebError' &&
    typeof error.code === 'string'
  );
}

/** True for caller cancellation, including the seam's own code. */
export function isAbortLike(error) {
  return (
    error !== null &&
    typeof error === 'object' &&
    (error.code === 'WEB_ABORTED' || error.name === 'AbortError')
  );
}

/**
 * Codes that end the operation instead of trying the next provider.
 * Cancellation and invalid input must not trigger fallback.
 */
const TERMINAL_CODES = new Set(['WEB_ABORTED', 'WEB_INVALID_URL']);

/** True when the router may try the next provider after this error. */
export function isRecoverable(error) {
  if (isAbortLike(error)) return false;
  return !(
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string' &&
    TERMINAL_CODES.has(error.code)
  );
}

/** The failure classes that gate fallback and key rotation. */
export const FAILURE_CLASSES = Object.freeze([
  'quota',
  'auth',
  'bot-wall',
  'transient',
  'invalid-response',
  'unknown',
]);

const FAILURE_CLASS_BY_CODE = new Map([
  ['WEB_RATE_LIMITED', 'quota'],
  ['WEB_PROVIDER_CREDENTIAL_MISSING', 'auth'],
  ['WEB_BLOCKED_URL', 'bot-wall'],
  ['WEB_FETCH_TIMEOUT', 'transient'],
  ['WEB_INVALID_RESPONSE', 'invalid-response'],
  ['WEB_UNSUPPORTED_CONTENT_TYPE', 'invalid-response'],
]);

/**
 * Classify one thrown failure for fallback and key rotation.
 *
 * Exact `WEB_*` code first, then the HTTP status read the way
 * `keyring.shouldRotateKey` reads it (`error.status ?? error.cause.status`,
 * covering `toWebError` wrapping a `ProviderRequestError` as `cause`);
 * anything unmatched falls to `unknown`.
 */
export function classifyFailure(error) {
  const code = error?.code;
  if (typeof code === 'string') {
    const byCode = FAILURE_CLASS_BY_CODE.get(code);
    if (byCode !== undefined) return byCode;
  }
  const status = error?.status ?? error?.cause?.status;
  if (status === 402 || status === 429) return 'quota';
  if (status === 401 || status === 403) return 'auth';
  if (status === 408 || status >= 500) return 'transient';
  return 'unknown';
}

/** Human-readable message for any thrown value. */
export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Convert adapter failures into the seam's error vocabulary.
 *
 * A non-seam error that already carries a `WEB_*` code (for example a
 * `ProviderRequestError` from `lib/http.js` or a mapper envelope error such
 * as Zhihu's rate limit) keeps that code; only the message is restated as
 * `<provider> <operation> …` with the original error as cause.
 *
 * @param {unknown} error - the thrown value.
 * @param {string} provider - provider display name.
 * @param {string} operation - `search` or `fetch`.
 * @param {{ fetch?: boolean }} [options] - fetch mode also maps raw timeout
 * errors without a code to `WEB_FETCH_TIMEOUT`.
 */
export function toWebError(error, provider, operation, options = {}) {
  if (isSeamError(error)) return error;
  if (isAbortLike(error)) {
    return webError(`${provider} ${operation} aborted`, 'WEB_ABORTED', { cause: error });
  }
  const code =
    error !== null &&
    typeof error === 'object' &&
    typeof error.code === 'string' &&
    /^WEB_/u.test(error.code)
      ? error.code
      : undefined;
  if (code === 'WEB_RATE_LIMITED') {
    return webError(
      `${provider} ${operation} rate limited: ${errorMessage(error)}`,
      'WEB_RATE_LIMITED',
      { cause: error },
    );
  }
  if (code === 'WEB_FETCH_TIMEOUT') {
    return webError(`${provider} ${operation} timed out: ${errorMessage(error)}`, 'WEB_FETCH_TIMEOUT', {
      cause: error,
    });
  }
  if (code !== undefined) {
    return webError(`${provider} ${operation} failed: ${errorMessage(error)}`, code, { cause: error });
  }
  if (options.fetch === true && error !== null && typeof error === 'object' && error.name === 'TimeoutError') {
    return webError(`${provider} ${operation} timed out: ${errorMessage(error)}`, 'WEB_FETCH_TIMEOUT', {
      cause: error,
    });
  }
  return webError(`${provider} ${operation} failed: ${errorMessage(error)}`, 'WEB_PROVIDER_ERROR', {
    cause: error,
  });
}
