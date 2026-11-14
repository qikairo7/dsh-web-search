import test from 'node:test';
import assert from 'node:assert/strict';

import { toWebError, webError } from '../lib/errors.js';

test('toWebError returns an existing seam error unchanged', () => {
  const seam = webError('Tavily search already failed', 'WEB_RATE_LIMITED');
  assert.equal(toWebError(seam, 'Tavily', 'search'), seam);
});

test('toWebError maps abort-like failures to WEB_ABORTED', () => {
  const error = toWebError(new DOMException('Aborted', 'AbortError'), 'Tavily', 'search');
  assert.equal(error.code, 'WEB_ABORTED');
  assert.equal(error.message, 'Tavily search aborted');
});

test('toWebError preserves WEB_RATE_LIMITED with the rate-limited wording', () => {
  const cause = new Error('upstream throttled');
  cause.code = 'WEB_RATE_LIMITED';
  const error = toWebError(cause, 'Zhihu', 'search');
  assert.equal(error.code, 'WEB_RATE_LIMITED');
  assert.equal(error.message, 'Zhihu search rate limited: upstream throttled');
  assert.equal(error.cause, cause);
});

test('toWebError preserves any WEB_* code from non-seam errors', () => {
  const cause = new Error('target blocked');
  cause.code = 'WEB_BLOCKED_URL';
  const error = toWebError(cause, 'AnySearch', 'fetch', { fetch: true });
  assert.equal(error.code, 'WEB_BLOCKED_URL');
  assert.equal(error.message, 'AnySearch fetch failed: target blocked');
  assert.equal(error.cause, cause);
});

test('toWebError keeps a WEB_FETCH_TIMEOUT code even without the fetch flag', () => {
  const cause = new Error('Keenable Keenable fetch timed out after 20 ms');
  cause.code = 'WEB_FETCH_TIMEOUT';
  const error = toWebError(cause, 'Keenable', 'fetch');
  assert.equal(error.code, 'WEB_FETCH_TIMEOUT');
  assert.match(error.message, /timed out/);
});

test('toWebError maps a raw timeout error to WEB_FETCH_TIMEOUT in fetch mode', () => {
  const error = toWebError(new DOMException('signal timed out', 'TimeoutError'), 'Exa', 'fetch', {
    fetch: true,
  });
  assert.equal(error.code, 'WEB_FETCH_TIMEOUT');
  assert.equal(error.message, 'Exa fetch timed out: signal timed out');
});

test('toWebError wraps uncoded failures as WEB_PROVIDER_ERROR', () => {
  const cause = new Error('boom');
  const error = toWebError(cause, 'Exa', 'search');
  assert.equal(error.code, 'WEB_PROVIDER_ERROR');
  assert.equal(error.message, 'Exa search failed: boom');
  assert.equal(error.cause, cause);
});
