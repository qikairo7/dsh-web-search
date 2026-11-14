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

/** Human-readable message for any thrown value. */
export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Convert adapter failures into the seam's error vocabulary.
 *
 * @param {unknown} error - the thrown value.
 * @param {string} provider - provider display name.
 * @param {string} operation - `search` or `fetch`.
 * @param {{ fetch?: boolean }} [options] - fetch mode maps timeouts to
 * `WEB_FETCH_TIMEOUT`.
 */
export function toWebError(error, provider, operation, options = {}) {
  if (isSeamError(error)) return error;
  if (isAbortLike(error)) {
    return webError(`${provider} ${operation} aborted`, 'WEB_ABORTED', { cause: error });
  }
  if (error !== null && typeof error === 'object' && error.code === 'WEB_RATE_LIMITED') {
    return webError(
      `${provider} ${operation} rate limited: ${errorMessage(error)}`,
      'WEB_RATE_LIMITED',
      { cause: error },
    );
  }
  if (
    options.fetch === true &&
    error !== null &&
    typeof error === 'object' &&
    (error.code === 'WEB_FETCH_TIMEOUT' || error.name === 'TimeoutError')
  ) {
    return webError(`${provider} ${operation} timed out: ${errorMessage(error)}`, 'WEB_FETCH_TIMEOUT', {
      cause: error,
    });
  }
  return webError(`${provider} ${operation} failed: ${errorMessage(error)}`, 'WEB_PROVIDER_ERROR', {
    cause: error,
  });
}
