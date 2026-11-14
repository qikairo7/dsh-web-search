import test from 'node:test';
import assert from 'node:assert/strict';

import { AnySearchClient, AnySearchClientError } from '../lib/providers/anysearchClient.js';
import { anySearchErrorCode } from '../lib/providers/anysearch.js';
import { withFetch } from './helpers/withFetch.js';

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
      assert.equal(seen.headers['x-anysearch-client'], 'dsh/0.7.2');
      assert.equal(seen.headers['user-agent'], 'dsh/0.7.2');
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
