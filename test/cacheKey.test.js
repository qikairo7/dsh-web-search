import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchCacheKey, resultFingerprint, searchCacheKey } from '../lib/cacheKey.js';

function settings(overrides = {}) {
  return {
    searchMode: 'quality',
    fetchMode: 'fast',
    anysearch: { enabled: true, baseURL: 'https://api.anysearch.com' },
    tavily: { enabled: true, includeAnswer: true },
    maxFetchChars: 200_000,
    searchCacheTtlMs: 300_000,
    searchCacheMaxEntries: 200,
    fetchCacheTtlMs: 600_000,
    fetchCacheMaxEntries: 100,
    ...overrides,
  };
}

test('search cache key changes when a result-affecting setting changes', () => {
  const base = settings();
  assert.notEqual(searchCacheKey(base, { query: 'q' }), searchCacheKey(settings({ anysearch: { enabled: false } }), { query: 'q' }));
  assert.notEqual(searchCacheKey(base, { query: 'q' }), searchCacheKey(settings({ tavily: { includeAnswer: false } }), { query: 'q' }));
});

test('cache control fields do not change the fingerprint', () => {
  assert.equal(resultFingerprint(settings()), resultFingerprint(settings({ searchCacheTtlMs: 1, fetchCacheMaxEntries: 1 })));
});

test('fetch cache key changes with fetch settings and request', () => {
  const base = settings();
  assert.notEqual(fetchCacheKey(base, { url: 'https://a.example' }), fetchCacheKey(settings({ maxFetchChars: 1 }), { url: 'https://a.example' }));
  assert.notEqual(fetchCacheKey(base, { url: 'https://a.example' }), fetchCacheKey(base, { url: 'https://b.example' }));
});

test('fetch cache key changes with the effective provider order', () => {
  const base = settings();
  assert.notEqual(
    fetchCacheKey(base, { url: 'https://a.example' }, ['http', 'tavily']),
    fetchCacheKey(base, { url: 'https://a.example' }, ['tavily', 'http']),
  );
  assert.equal(
    fetchCacheKey(base, { url: 'https://a.example' }, ['http', 'tavily']),
    fetchCacheKey(base, { url: 'https://a.example' }, ['http', 'tavily']),
  );
});
