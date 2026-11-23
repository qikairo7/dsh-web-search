import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampCount,
  hasCredential,
  isProviderAvailable,
  jsonHeaders,
  providerOperation,
  requireKey,
  textResult,
  USER_AGENT,
} from '../lib/providers/shared.js';
import { AnySearchProvider } from '../lib/providers/anysearch.js';
import { TavilyProvider } from '../lib/providers/tavily.js';
import { FirecrawlProvider } from '../lib/providers/firecrawl.js';
import { withFetch } from './helpers/withFetch.js';

test('clampCount keeps valid counts, bounds them, and falls back for invalid input', () => {
  assert.equal(clampCount(5, 10, 20), 5);
  assert.equal(clampCount(50, 10, 20), 20);
  assert.equal(clampCount('7', 10, 20), 7);
  assert.equal(clampCount(0, 10, 20), 10);
  assert.equal(clampCount(undefined, 10, 20), 10);
});

test('jsonHeaders adds a bearer token only when a key exists', () => {
  assert.deepEqual(jsonHeaders('secret'), {
    authorization: 'Bearer secret',
    'content-type': 'application/json',
    'user-agent': USER_AGENT,
  });
  assert.deepEqual(jsonHeaders(undefined), {
    'content-type': 'application/json',
    'user-agent': USER_AGENT,
  });
  assert.equal(jsonHeaders('secret', { 'x-request-timestamp': '1' })['x-request-timestamp'], '1');
});

test('textResult truncates content at maxChars and reports it', () => {
  assert.deepEqual(textResult('https://example.com/', 'abcdef', 4), {
    url: 'https://example.com/',
    statusCode: 200,
    body: { kind: 'text', content: 'abcd' },
    truncated: true,
  });
  assert.deepEqual(textResult('https://example.com/', 'abc', 4), {
    url: 'https://example.com/',
    statusCode: 200,
    body: { kind: 'text', content: 'abc' },
    truncated: false,
  });
});

test('requireKey returns the key and throws the credential-missing code', () => {
  assert.equal(requireKey('secret', 'Tavily API key'), 'secret');
  assert.throws(
    () => requireKey(undefined, 'Tavily API key'),
    (error) =>
      error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING' &&
      error.message === 'Tavily API key is not configured',
  );
});

test('isProviderAvailable requires an enabled config with an HTTP(S) base URL', () => {
  assert.equal(isProviderAvailable({ enabled: true, baseURL: 'https://api.example.com' }), true);
  assert.equal(isProviderAvailable({ enabled: false, baseURL: 'https://api.example.com' }), false);
  assert.equal(isProviderAvailable({ enabled: true, baseURL: 'ftp://api.example.com' }), false);
});

test('hasCredential resolves the configured key reference', async () => {
  assert.equal(
    await hasCredential(async (name) => (name === 'TAVILY_API_KEY' ? 'tvly' : undefined), {
      apiKeyEnv: 'TAVILY_API_KEY',
    }),
    true,
  );
  assert.equal(await hasCredential(async () => undefined, { apiKeyEnv: 'TAVILY_API_KEY' }), false);
});

test('providerOperation maps search timeouts to WEB_PROVIDER_ERROR and fetch timeouts to WEB_FETCH_TIMEOUT', async () => {
  const hanging = (url, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    });
  const settings = { requestTimeoutMs: 20 };

  const searchError = await withFetch(hanging, () =>
    providerOperation({
      settings,
      provider: 'Tavily',
      operation: 'search',
      url: 'https://api.example.com/search',
      request: { method: 'POST' },
    }).then(
      () => undefined,
      (error) => error,
    ),
  );
  assert.equal(searchError.code, 'WEB_PROVIDER_ERROR');
  assert.match(searchError.message, /timed out/);

  const fetchError = await withFetch(hanging, () =>
    providerOperation({
      settings,
      provider: 'Tavily',
      operation: 'fetch',
      isFetch: true,
      url: 'https://api.example.com/extract',
    }).then(
      () => undefined,
      (error) => error,
    ),
  );
  assert.equal(fetchError.code, 'WEB_FETCH_TIMEOUT');
  assert.match(fetchError.message, /timed out/);
});

test('providerOperation maps responses inside the guarded boundary', async () => {
  const settings = { requestTimeoutMs: 1_000 };
  const result = await withFetch({ body: { value: 7 } }, () =>
    providerOperation({
      settings,
      provider: 'Exa',
      operation: 'search',
      url: 'https://api.example.com/search',
      map: (data) => ({ doubled: data.value * 2 }),
    }),
  );
  assert.deepEqual(result, { doubled: 14 });

  await withFetch({ body: { value: 7 } }, () =>
    assert.rejects(
      providerOperation({
        settings,
        provider: 'Exa',
        operation: 'search',
        url: 'https://api.example.com/search',
        map: () => {
          throw new Error('mapping exploded');
        },
      }),
      (error) => error.code === 'WEB_PROVIDER_ERROR' && /mapping exploded/.test(error.message),
    ),
  );
});

test('Tavily fetch truncates extracted content at maxFetchChars', async () => {
  await withFetch(
    {
      body: { results: [{ url: 'https://example.com/', raw_content: 'x'.repeat(50) }] },
    },
    async () => {
      const provider = new TavilyProvider({
        settings: () => ({
          requestTimeoutMs: 5_000,
          maxFetchChars: 10,
          maxSnippetChars: 800,
          tavily: {
            enabled: true,
            apiKeyEnv: 'TAVILY_API_KEY',
            baseURL: 'https://api.tavily.com',
            includeAnswer: false,
          },
        }),
        resolveKey: async () => 'key',
      });
      const result = await provider.fetch({ url: 'https://example.com/' });
      assert.equal(result.body.content, 'x'.repeat(10));
      assert.equal(result.truncated, true);
    },
  );
});

test('Tavily fetch maps empty content to WEB_INVALID_RESPONSE', async () => {
  await withFetch(
    {
      body: {
        results: [{ url: 'https://example.com/', raw_content: '' }],
        failed_results: [{ url: 'https://example.com/', error: 'Extraction failed' }],
      },
    },
    async () => {
      const provider = new TavilyProvider({
        settings: () => ({
          requestTimeoutMs: 5_000,
          maxFetchChars: 10_000,
          maxSnippetChars: 800,
          tavily: {
            enabled: true,
            apiKeyEnv: 'TAVILY_API_KEY',
            baseURL: 'https://api.tavily.com',
            includeAnswer: false,
          },
        }),
        resolveKey: async () => 'key',
      });
      await assert.rejects(
        () => provider.fetch({ url: 'https://example.com/' }),
        (error) => error.code === 'WEB_INVALID_RESPONSE' && /Extraction failed/.test(error.message),
      );
    },
  );
});

test('AnySearch fetch maps empty content to WEB_INVALID_RESPONSE', async () => {
  await withFetch(
    {
      body: { code: 0, data: { content: '' } },
    },
    async () => {
      const provider = new AnySearchProvider({
        settings: () => ({
          requestTimeoutMs: 5_000,
          maxFetchChars: 10_000,
          anysearch: {
            enabled: true,
            apiKeyEnv: 'ANYSEARCH_API_KEY',
            baseURL: 'https://api.anysearch.com',
          },
        }),
        resolveKey: async () => undefined,
      });
      await assert.rejects(
        () => provider.fetch({ url: 'https://example.com/' }),
        (error) => error.code === 'WEB_INVALID_RESPONSE',
      );
    },
  );
});

test('AnySearch fetch truncates extracted content at maxFetchChars', async () => {
  await withFetch(
    {
      body: { code: 0, data: { content: 'y'.repeat(50) } },
    },
    async () => {
      const provider = new AnySearchProvider({
        settings: () => ({
          requestTimeoutMs: 5_000,
          maxFetchChars: 10,
          anysearch: {
            enabled: true,
            apiKeyEnv: 'ANYSEARCH_API_KEY',
            baseURL: 'https://api.anysearch.com',
          },
        }),
        resolveKey: async () => undefined,
      });
      const result = await provider.fetch({ url: 'https://example.com/' });
      assert.equal(result.body.content, 'y'.repeat(10));
      assert.equal(result.truncated, true);
    },
  );
});

test('Firecrawl fetch keeps the page status code and truncates content', async () => {
  await withFetch(
    {
      body: {
        success: true,
        data: {
          markdown: 'z'.repeat(50),
          metadata: { url: 'https://example.com/final', statusCode: 404 },
        },
      },
    },
    async () => {
      const provider = new FirecrawlProvider({
        settings: () => ({
          requestTimeoutMs: 5_000,
          maxFetchChars: 10,
          firecrawl: {
            enabled: true,
            apiKeyEnv: 'FIRECRAWL_API_KEY',
            baseURL: 'https://api.firecrawl.dev',
          },
        }),
        resolveKey: async () => 'key',
      });
      const result = await provider.fetch({ url: 'https://example.com/' });
      assert.equal(result.url, 'https://example.com/final');
      assert.equal(result.statusCode, 404);
      assert.equal(result.body.content, 'z'.repeat(10));
      assert.equal(result.truncated, true);
    },
  );
});
