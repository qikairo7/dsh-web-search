import test from 'node:test';
import assert from 'node:assert/strict';

import { createRequire } from 'node:module';

import {
  AnySearchClient,
  AnySearchClientError,
  ANYSEARCH_DSH_CLIENT_ID,
  ANYSEARCH_HTTP_TIMEOUT_MS,
} from '../lib/providers/anysearchClient.js';
import { AnySearchProvider, anySearchErrorCode } from '../lib/providers/anysearch.js';
import { withFetch } from './helpers/withFetch.js';

const { version } = createRequire(import.meta.url)('../package.json');

test('AnySearchClient sends versioned client headers and bearer auth', async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: String(url), headers: init.headers };
      return new Response(
        JSON.stringify({
          code: 0,
          message: 'ok',
          request_id: 'req-1',
          data: { results: [], metadata: { total_results: 0, search_time_ms: 1 } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const client = new AnySearchClient({
        baseURL: 'https://api.anysearch.com',
        apiKeyReference: 'ANYSEARCH_API_KEY',
        resolveApiKey: async () => 'as_test',
      });
      const result = await client.search({ query: 'q' });
      assert.equal(result.results.length, 0);
      assert.equal(seen.url, 'https://api.anysearch.com/v1/search');
      assert.equal(ANYSEARCH_DSH_CLIENT_ID, `dsh/${version}`);
      assert.equal(seen.headers['x-anysearch-client'], ANYSEARCH_DSH_CLIENT_ID);
      assert.equal(seen.headers['user-agent'], ANYSEARCH_DSH_CLIENT_ID);
      assert.equal(seen.headers.authorization, 'Bearer as_test');
    },
  );
});

test('AnySearchClient extract falls back to the request URL', async () => {
  await withFetch(
    { body: { code: 0, data: { content: 'clean body' } } },
    async () => {
      const client = new AnySearchClient({
        baseURL: 'https://api.anysearch.com',
        resolveApiKey: async () => undefined,
      });
      const result = await client.extract({ url: 'https://example.com/' });
      assert.equal(result.url, 'https://example.com/');
      assert.equal(result.content, 'clean body');
    },
  );
});

test('AnySearch business error codes map to seam codes', () => {
  const cases = new Map([
    ['invalid_extract_url', 'WEB_INVALID_URL'],
    ['extract_target_blocked', 'WEB_BLOCKED_URL'],
    ['extract_content_too_large', 'WEB_FETCH_TOO_LARGE'],
    ['extract_unsupported_content', 'WEB_UNSUPPORTED_CONTENT_TYPE'],
    ['extract_timeout', 'WEB_FETCH_TIMEOUT'],
    ['extract_canceled', 'WEB_ABORTED'],
    ['unknown_code', 'WEB_PROVIDER_ERROR'],
  ]);
  for (const [errorCode, expected] of cases) {
    const error = new AnySearchClientError('failed', { operation: 'fetch', errorCode });
    assert.equal(anySearchErrorCode(error), expected, errorCode);
  }
  const aborted = new AnySearchClientError('aborted', { kind: 'aborted', operation: 'fetch' });
  assert.equal(anySearchErrorCode(aborted), 'WEB_ABORTED');
  const rateLimited = new AnySearchClientError('limited', { operation: 'search', httpStatus: 429 });
  assert.equal(anySearchErrorCode(rateLimited), 'WEB_RATE_LIMITED');
  const fetchTimeout = new AnySearchClientError('timeout', { kind: 'timeout', operation: 'fetch' });
  assert.equal(anySearchErrorCode(fetchTimeout), 'WEB_FETCH_TIMEOUT');
  const extractTimeout = new AnySearchClientError('timeout', { kind: 'timeout', operation: 'extract' });
  assert.equal(anySearchErrorCode(extractTimeout), 'WEB_FETCH_TIMEOUT');
});

test('AnySearchProvider keeps the official 55s HTTP deadline floor', () => {
  const provider = new AnySearchProvider({
    settings: () => ({
      anysearch: { enabled: true, apiKeyEnv: 'ANYSEARCH_API_KEY', baseURL: 'https://api.anysearch.com' },
      requestTimeoutMs: 30_000,
    }),
    resolveKey: async () => undefined,
  });
  assert.equal(provider.client(provider.settings()).timeoutMs, ANYSEARCH_HTTP_TIMEOUT_MS);
  assert.equal(ANYSEARCH_HTTP_TIMEOUT_MS, 55_000);

  const longer = new AnySearchProvider({
    settings: () => ({
      anysearch: { enabled: true, apiKeyEnv: 'ANYSEARCH_API_KEY', baseURL: 'https://api.anysearch.com' },
      requestTimeoutMs: 60_000,
    }),
    resolveKey: async () => undefined,
  });
  assert.equal(longer.client(longer.settings()).timeoutMs, 60_000);
});

test('AnySearchClient keeps valid results when a malformed result lacks a title', async () => {
  await withFetch(
    {
      body: {
        code: 0,
        message: 'ok',
        data: {
          results: [
            { title: 'Valid one', url: 'https://one.example/', snippet: 'first' },
            { url: 'https://missing-title.example/', snippet: 'malformed' },
            { title: 'Valid two', url: 'https://two.example/' },
          ],
          metadata: { total_results: 3, search_time_ms: 2 },
        },
      },
    },
    async () => {
      const client = new AnySearchClient({
        baseURL: 'https://api.anysearch.com',
        resolveApiKey: async () => undefined,
      });
      const result = await client.search({ query: 'q' });
      const byUrl = new Map(result.results.map((item) => [item.url, item]));
      const validOne = byUrl.get('https://one.example/');
      const validTwo = byUrl.get('https://two.example/');
      assert.ok(validOne !== undefined);
      assert.ok(validTwo !== undefined);
      assert.equal(validOne.title, 'Valid one');
      assert.equal(validOne.snippet, 'first');
      assert.equal(validTwo.title, 'Valid two');
    },
  );
});
