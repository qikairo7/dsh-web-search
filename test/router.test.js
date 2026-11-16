import test from 'node:test';
import assert from 'node:assert/strict';

import { AutoFetchProvider, AutoSearchProvider } from '../lib/providers/router.js';
import { enrichSources } from '../lib/enrich.js';
import { webError } from '../lib/errors.js';

function searchProvider(name, calls, { fail = false, result } = {}) {
  return {
    id: name,
    available: () => true,
    ready: async () => true,
    async search() {
      calls.push(name);
      if (fail) throw new Error(`${name} failed`);
      return result ?? { sources: [{ url: `https://${name}.example/` }], truncated: false };
    },
  };
}

function fetchProvider(name, calls, { fail = false } = {}) {
  return {
    id: name,
    available: () => true,
    ready: async () => true,
    async fetch() {
      calls.push(name);
      if (fail) throw new Error(`${name} failed`);
      return {
        url: `https://${name}.example/`,
        statusCode: 200,
        body: { kind: 'text', content: name },
        truncated: false,
      };
    },
  };
}

function settings(overrides = {}) {
  return {
    chineseSearchOrder: ['zhihu', 'anysearch'],
    defaultSearchOrder: ['anysearch', 'zhihu'],
    fetchOrder: ['http', 'tavily'],
    zhihu: { enabled: true },
    anysearch: { enabled: true },
    http: { enabled: true },
    tavily: { enabled: true },
    ...overrides,
  };
}

test('AutoSearchProvider uses the Chinese order and falls back on failure', async () => {
  const calls = [];
  const providers = {
    zhihu: searchProvider('zhihu', calls, { fail: true }),
    anysearch: searchProvider('anysearch', calls),
  };
  const router = new AutoSearchProvider({ settings: () => settings(), providers });
  const result = await router.search({ query: 'DeepSeek 插件开发' });
  assert.deepEqual(calls, ['zhihu', 'anysearch']);
  assert.equal(result.sources[0].url, 'https://anysearch.example/');
});

test('AutoSearchProvider uses the default order for non-Chinese queries', async () => {
  const calls = [];
  const providers = {
    zhihu: searchProvider('zhihu', calls),
    anysearch: searchProvider('anysearch', calls),
  };
  const router = new AutoSearchProvider({ settings: () => settings(), providers });
  await router.search({ query: 'Node.js fetch timeout' });
  assert.deepEqual(calls, ['anysearch']);
});

test('search cache key changes when official docs and language routing change', async () => {
  let calls = 0;
  const current = settings({
    searchMode: 'fast',
    defaultSearchOrder: ['anysearch'],
    officialDocsEnabled: true,
    languageRouting: true,
  });
  const provider = {
    id: 'anysearch',
    available: () => true,
    ready: async () => true,
    async search() {
      calls += 1;
      return { sources: [{ url: 'https://anysearch.example/' }], truncated: false };
    },
  };
  const router = new AutoSearchProvider({ settings: () => current, providers: { anysearch: provider } });
  await router.search({ query: 'cache test' });
  current.officialDocsEnabled = false;
  await router.search({ query: 'cache test' });
  assert.equal(calls, 2);
});

test('AutoSearchProvider reports the last recoverable failure', async () => {
  const providers = {
    zhihu: searchProvider('zhihu', [], { fail: true }),
    anysearch: searchProvider('anysearch', [], { fail: true }),
  };
  const router = new AutoSearchProvider({ settings: () => settings(), providers });
  await assert.rejects(
    () => router.search({ query: 'DeepSeek 插件' }),
    (error) => error.code === 'WEB_PROVIDER_ERROR' && /zhihu failed/.test(error.message),
  );
});

test('AutoFetchProvider falls back from HTTP to Tavily', async () => {
  const calls = [];
  const providers = {
    http: fetchProvider('http', calls, { fail: true }),
    tavily: fetchProvider('tavily', calls),
  };
  const router = new AutoFetchProvider({ settings: () => settings(), providers });
  const result = await router.fetch({ url: 'https://example.com/' });
  assert.deepEqual(calls, ['http', 'tavily']);
  assert.equal(result.body.content, 'tavily');
});

test('AutoSearchProvider quality mode merges two providers, reranks, and caches', async () => {
  const calls = [];
  const providers = {
    anysearch: {
      id: 'anysearch',
      available: () => true,
      ready: async () => true,
      async search() {
        calls.push('anysearch');
        return {
          sources: [
            { url: 'https://a.example/', title: 'A' },
            { url: 'https://shared.example/', title: 'shared' },
          ],
          truncated: false,
        };
      },
    },
    zhihu: {
      id: 'zhihu',
      available: () => true,
      ready: async () => true,
      async search() {
        calls.push('zhihu');
        return {
          sources: [
            { url: 'https://b.example/', title: 'B' },
            { url: 'https://shared.example/', title: 'shared duplicate' },
          ],
          truncated: false,
        };
      },
    },
    tavily: searchProvider('tavily', calls),
    firecrawl: searchProvider('firecrawl', calls),
    'zhihu-site': searchProvider('zhihu-site', calls),
  };
  const qualitySettings = {
    searchMode: 'quality',
    intentRouting: true,
    chineseSearchOrder: ['zhihu', 'anysearch', 'tavily', 'firecrawl'],
    defaultSearchOrder: ['anysearch', 'tavily', 'zhihu', 'firecrawl'],
    fetchOrder: ['http', 'tavily', 'firecrawl', 'anysearch'],
    cleanFetchOrder: ['tavily', 'firecrawl', 'http', 'anysearch'],
    zhihu: { enabled: true },
    anysearch: { enabled: true },
    tavily: { enabled: true },
    firecrawl: { enabled: true },
    http: { enabled: true },
    searchCacheTtlMs: 10_000,
    searchCacheMaxEntries: 10,
    fetchCacheTtlMs: 10_000,
    fetchCacheMaxEntries: 10,
    breakerFailureThreshold: 3,
    breakerCooldownMs: 1_000,
  };
  const reranker = {
    async rerankScored(_query, sources) {
      return sources.map((source, index) => ({ source, score: 1, rank: sources.length - 1 - index, index }));
    },
  };
  const router = new AutoSearchProvider({
    settings: () => qualitySettings,
    providers,
    reranker,
  });
  const first = await router.search({ query: 'DeepSeek 插件开发', maxResults: 2 });
  assert.deepEqual(first.sources.map((source) => source.url), [
    'https://shared.example/',
    'https://a.example/',
  ]);
  assert.equal(first.truncated, true);
  assert.deepEqual(calls, ['zhihu', 'anysearch']);

  const second = await router.search({ query: 'DeepSeek 插件开发', maxResults: 2 });
  assert.equal(second.sources.length, 2);
  assert.deepEqual(calls, ['zhihu', 'anysearch']);
});

test('enrichSources replaces the summary from fetched content', async () => {
  const sources = await enrichSources({
    sources: [
      { url: 'https://nodejs.org/api/http.html', title: 'HTTP API', summary: 'old' },
      { url: 'https://example.com', title: 'Example', summary: 'old' },
    ],
    query: 'Node.js AbortSignal timeout',
    settings: settings({
      enrichEnabled: true,
      enrichTopN: 1,
      enrichSummaryMinChars: 100,
      enrichSummaryMaxChars: 300,
    }),
    fetcher: {
      fetch: async () => ({
        body: {
          content: `<html><head><script>bad()</script></head><body><h1>HTTP API</h1><p>${'Use AbortSignal.timeout(5000) to stop a fetch call. '.repeat(20)}</p></body></html>`,
        },
      }),
    },
    signal: undefined,
  });
  assert.ok(sources[0].summary.length > 100);
  assert.doesNotMatch(sources[0].summary, /<html|<script|<link/iu);
  assert.equal(sources[1].summary, 'old');
});

test('enrichSources keeps a longer summary when fetched content is too short', async () => {
  const body = `<article><p>${'Short fetched paragraph about fetch timeouts. '.repeat(40)}</p></article>`;
  const longSummary = 'Existing detailed summary sentence. '.repeat(80);
  const enrichmentSettings = settings({
    enrichEnabled: true,
    enrichTopN: 2,
    enrichSummaryMinChars: 800,
    enrichSummaryMaxChars: 1_500,
  });
  const sources = await enrichSources({
    sources: [
      { url: 'https://example.com/kept', title: 'Example one', summary: longSummary },
      { url: 'https://example.com/replaced', title: 'Example two', summary: 'old' },
    ],
    query: 'fetch timeout',
    settings: enrichmentSettings,
    fetcher: {
      fetch: async () => ({ body: { kind: 'html', content: body } }),
    },
    signal: undefined,
  });
  assert.equal(sources[0].summary, longSummary);
  assert.ok(sources[1].summary.length > 'old'.length);
  assert.match(sources[1].summary, /Short fetched paragraph/u);
});

test('enrichSources converts HTML fragments when the body kind is html', async () => {
  const body = `<article><p>${'Fragment paragraph about AbortSignal timeouts. '.repeat(10)}</p></article>`;
  const enrichmentSettings = settings({
    enrichEnabled: true,
    enrichTopN: 1,
    enrichSummaryMinChars: 100,
    enrichSummaryMaxChars: 300,
  });
  const sources = await enrichSources({
    sources: [{ url: 'https://example.com/fragment', title: 'Fragment test', summary: 'old' }],
    query: 'AbortSignal timeout',
    settings: enrichmentSettings,
    fetcher: {
      fetch: async () => ({ body: { kind: 'html', content: body } }),
    },
    signal: undefined,
  });
  assert.ok(sources[0].summary.length >= 100);
  assert.doesNotMatch(sources[0].summary, /<article|<p>/iu);
  assert.match(sources[0].summary, /Fragment paragraph/u);
});

test('AutoSearchProvider skips a provider after repeated failures', async () => {
  const calls = [];
  const bad = {
    id: 'bad',
    available: () => true,
    ready: async () => true,
    async search() {
      calls.push('bad');
      throw new Error('bad failed');
    },
  };
  const good = searchProvider('good', calls);
  const breakerSettings = {
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
  };
  const router = new AutoSearchProvider({
    settings: () => breakerSettings,
    providers: { bad, good },
  });
  for (let index = 0; index < 4; index += 1) {
    await router.search({ query: 'english query' });
  }
  assert.deepEqual(calls, ['bad', 'good', 'bad', 'good', 'bad', 'good', 'good']);
});

test('AutoFetchProvider clean mode prefers Tavily over HTTP', async () => {
  const calls = [];
  const providers = {
    http: fetchProvider('http', calls),
    tavily: fetchProvider('tavily', calls),
  };
  const cleanSettings = {
    fetchMode: 'clean',
    fetchOrder: ['http', 'tavily'],
    cleanFetchOrder: ['tavily', 'http'],
    http: { enabled: true },
    tavily: { enabled: true },
    fetchCacheTtlMs: 1_000,
    fetchCacheMaxEntries: 0,
    breakerFailureThreshold: 3,
    breakerCooldownMs: 60_000,
  };
  const router = new AutoFetchProvider({ settings: () => cleanSettings, providers });
  const result = await router.fetch({ url: 'https://example.com/' });
  assert.deepEqual(calls, ['tavily']);
  assert.equal(result.body.content, 'tavily');
});

test('AutoFetchProvider does not fall back for an invalid URL', async () => {
  const calls = [];
  const providers = {
    http: {
      id: 'http',
      available: () => true,
      ready: async () => true,
      async fetch() {
        calls.push('http');
        const error = new Error('url must be an absolute HTTP(S) URL');
        error.name = 'WebError';
        error.code = 'WEB_INVALID_URL';
        throw error;
      },
    },
    tavily: fetchProvider('tavily', calls),
  };
  const router = new AutoFetchProvider({ settings: () => settings(), providers });
  await assert.rejects(
    () => router.fetch({ url: 'not-a-url' }),
    (error) => error.code === 'WEB_INVALID_URL',
  );
  assert.deepEqual(calls, ['http']);
});

test('AutoSearchProvider continues with the fast order when quality returns empty sources', async () => {
  const calls = [];
  const empty = (name) => ({
    id: name,
    available: () => true,
    ready: async () => true,
    async search() {
      calls.push(name);
      return { sources: [], truncated: false };
    },
  });
  const providers = {
    zhihu: empty('zhihu'),
    keenable: empty('keenable'),
    anysearch: empty('anysearch'),
    tavily: searchProvider('tavily', calls),
  };
  const qualitySettings = {
    searchMode: 'quality',
    intentRouting: false,
    chineseSearchOrder: ['tavily'],
    defaultSearchOrder: ['tavily'],
    officialDocsEnabled: false,
    enrichEnabled: false,
    tavily: { enabled: true },
    searchCacheTtlMs: 10_000,
    searchCacheMaxEntries: 10,
    breakerFailureThreshold: 3,
    breakerCooldownMs: 1_000,
  };
  const router = new AutoSearchProvider({ settings: () => qualitySettings, providers });
  const result = await router.search({ query: '插件开发' });
  assert.deepEqual(calls, ['zhihu', 'keenable', 'anysearch', 'tavily']);
  assert.equal(result.sources[0].url, 'https://tavily.example/');
});

test('AutoSearchProvider annotates the request with routing facts once', async () => {
  const seen = [];
  const providers = {
    anysearch: {
      id: 'anysearch',
      available: () => true,
      ready: async () => true,
      async search(request) {
        seen.push(request);
        return { sources: [{ url: 'https://anysearch.example/' }], truncated: false };
      },
    },
  };
  const router = new AutoSearchProvider({
    settings: () => settings({ searchMode: 'fast', defaultSearchOrder: ['anysearch'] }),
    providers,
  });
  await router.search({ query: '2026年11月 AI 最新新闻' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].routing.intent, 'news');
  assert.equal(seen[0].routing.language, 'zh');
  assert.equal(typeof seen[0].routing.syntax, 'object');
});

test('AutoSearchProvider aborts when the overall search budget expires', async () => {
  const providers = {
    anysearch: {
      id: 'anysearch',
      available: () => true,
      ready: async () => true,
      async search() {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { sources: [{ url: 'https://anysearch.example/' }], truncated: false };
      },
    },
  };
  const router = new AutoSearchProvider({
    settings: () => settings({ searchMode: 'quality', requestTimeoutMs: 1, defaultSearchOrder: ['anysearch'] }),
    providers,
  });
  await assert.rejects(
    () => router.search({ query: 'slow query test' }),
    (error) => error.code === 'WEB_ABORTED',
  );
});

test('AutoFetchProvider honors an explicit order and keys the cache by it', async () => {
  const calls = [];
  const providers = {
    http: fetchProvider('http', calls),
    tavily: fetchProvider('tavily', calls),
  };
  const cleanSettings = {
    fetchMode: 'clean',
    fetchOrder: ['http', 'tavily'],
    cleanFetchOrder: ['tavily', 'http'],
    http: { enabled: true },
    tavily: { enabled: true },
    fetchCacheTtlMs: 1_000,
    fetchCacheMaxEntries: 10,
    breakerFailureThreshold: 3,
    breakerCooldownMs: 60_000,
  };
  const router = new AutoFetchProvider({ settings: () => cleanSettings, providers });
  const forced = await router.fetch({ url: 'https://example.com/' }, undefined, { order: ['http', 'tavily'] });
  assert.deepEqual(calls, ['http']);
  assert.equal(forced.body.content, 'http');
  // The same forced order hits the cache; the mode-derived order is a different key.
  await router.fetch({ url: 'https://example.com/' }, undefined, { order: ['http', 'tavily'] });
  assert.deepEqual(calls, ['http']);
  const viaMode = await router.fetch({ url: 'https://example.com/' });
  assert.deepEqual(calls, ['http', 'tavily']);
  assert.equal(viaMode.body.content, 'tavily');
});

test('AutoFetchProvider rethrows a disallowed failure class without calling the next provider', async () => {
  const calls = [];
  const failure = webError('HTTP fetch returned no extractable content', 'WEB_INVALID_RESPONSE');
  const providers = {
    http: {
      id: 'http',
      available: () => true,
      ready: async () => true,
      async fetch() {
        calls.push('http');
        throw failure;
      },
    },
    tavily: fetchProvider('tavily', calls),
  };
  const router = new AutoFetchProvider({
    settings: () =>
      settings({ fallbackFailureClasses: ['quota', 'auth', 'bot-wall', 'transient', 'unknown'] }),
    providers,
  });
  await assert.rejects(() => router.fetch({ url: 'https://example.com/' }), (error) => error === failure);
  assert.deepEqual(calls, ['http']);
});

test('AutoFetchProvider stops at the first failure when the allowed class set is empty', async () => {
  const calls = [];
  const failure = webError('HTTP fetch failed (HTTP 429)', 'WEB_RATE_LIMITED');
  const providers = {
    http: {
      id: 'http',
      available: () => true,
      ready: async () => true,
      async fetch() {
        calls.push('http');
        throw failure;
      },
    },
    tavily: fetchProvider('tavily', calls),
  };
  const router = new AutoFetchProvider({
    settings: () => settings({ fallbackFailureClasses: [] }),
    providers,
  });
  await assert.rejects(() => router.fetch({ url: 'https://example.com/' }), (error) => error === failure);
  assert.deepEqual(calls, ['http']);
});

test('AutoFetchProvider never falls back for an aborted request, whatever the classes', async () => {
  const calls = [];
  const providers = {
    http: {
      id: 'http',
      available: () => true,
      ready: async () => true,
      async fetch() {
        calls.push('http');
        throw webError('HTTP fetch aborted', 'WEB_ABORTED');
      },
    },
    tavily: fetchProvider('tavily', calls),
  };
  const router = new AutoFetchProvider({
    settings: () =>
      settings({
        fallbackFailureClasses: ['quota', 'auth', 'bot-wall', 'transient', 'invalid-response', 'unknown'],
      }),
    providers,
  });
  await assert.rejects(
    () => router.fetch({ url: 'https://example.com/' }),
    (error) => error.code === 'WEB_ABORTED',
  );
  assert.deepEqual(calls, ['http']);
});

test('disallowed failure classes do not feed the circuit breaker', async () => {
  const calls = [];
  const failure = webError('bad fetch returned no content', 'WEB_INVALID_RESPONSE');
  const bad = {
    id: 'bad',
    available: () => true,
    ready: async () => true,
    async search() {
      calls.push('bad');
      throw failure;
    },
  };
  const good = searchProvider('good', calls);
  const breakerSettings = {
    searchMode: 'fast',
    intentRouting: false,
    chineseSearchOrder: ['bad', 'good'],
    defaultSearchOrder: ['bad', 'good'],
    searchCacheTtlMs: 1_000,
    searchCacheMaxEntries: 0,
    breakerFailureThreshold: 2,
    breakerCooldownMs: 60_000,
    fallbackFailureClasses: ['quota', 'auth', 'bot-wall', 'transient', 'unknown'],
    bad: { enabled: true },
    good: { enabled: true },
  };
  const router = new AutoSearchProvider({ settings: () => breakerSettings, providers: { bad, good } });
  for (let index = 0; index < 3; index += 1) {
    await assert.rejects(() => router.search({ query: 'english query' }), (error) => error === failure);
  }
  assert.deepEqual(calls, ['bad', 'bad', 'bad']);
});
