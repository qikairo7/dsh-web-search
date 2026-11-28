import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchCacheKey, resultFingerprint, searchCacheKey } from '../lib/cacheKey.js';
import { SETTINGS_SPEC, resolveSettings } from '../lib/settings.js';

const CACHE_CONTROL_PATHS = new Set([
  'searchCacheTtlMs',
  'searchCacheMaxEntries',
  'fetchCacheTtlMs',
  'fetchCacheMaxEntries',
]);

function valueAt(settings, path) {
  return path.split('.').reduce((value, key) => value[key], settings);
}

function setAt(settings, path, value) {
  const parts = path.split('.');
  const leaf = parts.pop();
  let node = settings;
  for (const part of parts) {
    node[part] ??= {};
    node = node[part];
  }
  node[leaf] = value;
}

function alternateSettingValue(spec, current) {
  switch (spec.kind) {
    case 'enum':
      return spec.values.find((value) => value !== current);
    case 'boolean':
      return !current;
    case 'order': {
      if (!Array.isArray(current) || current.length === 0) return ['http'];
      const other = [
        'anysearch', 'keenable', 'exa', 'bing', 'github', 'tavily',
        'firecrawl', 'zhihu', 'zhihu-site', 'aihot', 'http',
      ].find((name) => !current.includes(name));
      return other === undefined ? [...current].reverse() : [...current, other];
    }
    case 'number': {
      const next = current + 1;
      if (spec.max !== undefined && next > spec.max) return Math.max(spec.min ?? 1, current - 1);
      return next;
    }
    case 'failure-classes':
      return current.length > 0 ? current.slice(0, -1) : ['quota'];
    default:
      return `${current}-changed`;
  }
}

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

test('every result-affecting setting changes the cache fingerprint', () => {
  const base = resolveSettings();
  const baseFingerprint = resultFingerprint(base);
  const missing = [];
  for (const spec of SETTINGS_SPEC) {
    if (CACHE_CONTROL_PATHS.has(spec.path)) continue;
    const changed = structuredClone(base);
    setAt(changed, spec.path, alternateSettingValue(spec, valueAt(base, spec.path)));
    if (resultFingerprint(changed) === baseFingerprint) missing.push(spec.path);
  }
  assert.deepEqual(missing, [], 'these result-affecting settings are missing from the cache key');
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
