import test from 'node:test';
import assert from 'node:assert/strict';

import { AutoFetchProvider, AutoSearchProvider } from '../lib/providers/router.js';

/** Capture debug-level trails passed as (message, fields). */
function recordingSink() {
  const trails = [];
  const debug = (message, fields) => trails.push({ message, fields });
  return { trails, debug };
}

function provider(name, calls, { fail = false } = {}) {
  return {
    id: name,
    available: () => true,
    ready: async () => true,
    async search() {
      calls.push(name);
      if (fail) throw new Error(`${name} failed`);
      return { sources: [{ url: `https://${name}.example/` }], truncated: false };
    },
    async fetch() {
      calls.push(name);
      if (fail) throw new Error(`${name} failed`);
      return { url: `https://${name}.example/`, statusCode: 200, body: { kind: 'text', content: name }, truncated: false };
    },
  };
}

test('a fast search records the provider trail (tried + answerer) at debug level', async () => {
  const calls = [];
  const { trails, debug } = recordingSink();
  const providers = {
    bad: provider('bad', calls, { fail: true }),
    good: provider('good', calls),
  };
  const router = new AutoSearchProvider({
    settings: () => ({
      searchMode: 'fast',
      intentRouting: false,
      chineseSearchOrder: ['bad', 'good'],
      defaultSearchOrder: ['bad', 'good'],
      searchCacheTtlMs: 1_000,
      searchCacheMaxEntries: 0,
      breakerFailureThreshold: 3,
      breakerCooldownMs: 60_000,
      bad: { enabled: true },
      good: { enabled: true },
    }),
    providers,
    debug,
  });

  await router.search({ query: 'english query' });

  assert.equal(trails.length, 1);
  assert.deepEqual(trails[0].fields, { capability: 'search', tried: ['bad', 'good'], answered: ['good'] });
});

test('a fetch records the provider trail (tried + answerer) at debug level', async () => {
  const calls = [];
  const { trails, debug } = recordingSink();
  const providers = {
    http: provider('http', calls, { fail: true }),
    tavily: provider('tavily', calls),
  };
  const router = new AutoFetchProvider({
    settings: () => ({
      fetchMode: 'fast',
      fetchOrder: ['http', 'tavily'],
      http: { enabled: true },
      tavily: { enabled: true },
      fetchCacheTtlMs: 1_000,
      fetchCacheMaxEntries: 0,
      breakerFailureThreshold: 3,
      breakerCooldownMs: 60_000,
    }),
    providers,
    debug,
  });

  await router.fetch({ url: 'https://example.com/' });

  assert.equal(trails.length, 1);
  assert.deepEqual(trails[0].fields, { capability: 'fetch', tried: ['http', 'tavily'], answered: ['tavily'] });
});

test('a quality search records the provider trail (tried + answerers) at debug level', async () => {
  const calls = [];
  const { trails, debug } = recordingSink();
  const providers = {
    anysearch: provider('anysearch', calls),
    zhihu: provider('zhihu', calls),
  };
  const router = new AutoSearchProvider({
    settings: () => ({
      searchMode: 'quality',
      intentRouting: false,
      officialDocsEnabled: false,
      enrichEnabled: false,
      chineseSearchOrder: ['anysearch', 'zhihu'],
      defaultSearchOrder: ['anysearch', 'zhihu'],
      anysearch: { enabled: true },
      zhihu: { enabled: true },
      searchCacheTtlMs: 10_000,
      searchCacheMaxEntries: 10,
      breakerFailureThreshold: 3,
      breakerCooldownMs: 1_000,
    }),
    providers,
    debug,
  });

  await router.search({ query: '插件开发' });

  const trail = trails.find((entry) => entry.fields?.capability === 'search');
  assert.ok(trail, 'expected a search trail');
  assert.deepEqual([...trail.fields.tried].sort(), ['anysearch', 'zhihu']);
  assert.deepEqual([...trail.fields.answered].sort(), ['anysearch', 'zhihu']);
});

test('no debug sink means no trail is emitted and the result is unchanged', async () => {
  const calls = [];
  const providers = { good: provider('good', calls) };
  const router = new AutoSearchProvider({
    settings: () => ({
      searchMode: 'fast',
      intentRouting: false,
      chineseSearchOrder: ['good'],
      defaultSearchOrder: ['good'],
      searchCacheTtlMs: 1_000,
      searchCacheMaxEntries: 0,
      breakerFailureThreshold: 3,
      breakerCooldownMs: 60_000,
      good: { enabled: true },
    }),
    providers,
  });
  const result = await router.search({ query: 'english query' });
  assert.equal(result.sources[0].url, 'https://good.example/');
});
