import test from 'node:test';
import assert from 'node:assert/strict';

import { AutoFetchProvider, AutoSearchProvider } from '../lib/providers/router.js';

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
