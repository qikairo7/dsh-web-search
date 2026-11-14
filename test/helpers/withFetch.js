/** Shared test helper: swap `globalThis.fetch` for a mock and always restore it. */

/**
 * Normalize an impl into a fetch-like function. The `{ status, headers, body }`
 * shorthand becomes a `Response`; non-string bodies are JSON-encoded so error
 * shapes can be written as plain objects.
 */
function toFetchImpl(impl) {
  if (typeof impl === 'function') return impl;
  const { status = 200, headers = {}, body = '' } = impl ?? {};
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return async () => new Response(text, { status, headers });
}

/**
 * Run `fn` with `globalThis.fetch` replaced by `impl`, restoring the original
 * fetch when `fn` settles, success or failure. Zero dependencies, no network.
 *
 * @param {Function | { status?: number, headers?: Record<string, string>, body?: unknown }} impl
 *   A fetch-like async `(url, init) => Response`, or a `{ status, headers, body }`
 *   shorthand; a non-string `body` is JSON-encoded.
 * @param {() => Promise<unknown>} fn - test body running under the mock.
 * @returns {Promise<unknown>} Whatever `fn` resolves to.
 */
export function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = toFetchImpl(impl);
  return Promise.resolve(fn()).finally(() => {
    globalThis.fetch = original;
  });
}
