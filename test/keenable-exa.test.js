import test from 'node:test';
import assert from 'node:assert/strict';

import { KeenableProvider, mapKeenableSearch } from '../lib/providers/keenable.js';
import { ExaProvider, mapExaSearch } from '../lib/providers/exa.js';
import { withFetch } from './helpers/withFetch.js';

test('Keenable maps results and preserves publication dates', () => {
  const result = mapKeenableSearch({
    results: [
      { title: 'K', url: 'https://k.example/', snippet: 'line\nline', published_at: '2026-11-01T00:00:00Z' },
      { title: 'bad', url: 'ftp://bad.example/' },
    ],
  }, 20);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].title, 'K');
  assert.equal(result.sources[0].snippet, 'line line');
  assert.equal(result.sources[0].publishedAt, '2026-11-01T00:00:00Z');
});

test('Exa maps highlights and publishedDate', () => {
  const result = mapExaSearch({
    results: [
      { title: 'E', url: 'https://e.example/', highlights: ['one', 'two'], publishedDate: '2026-11-02T00:00:00Z' },
    ],
  }, 100);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].snippet, 'one');
  assert.equal(result.sources[0].publishedAt, '2026-11-02T00:00:00Z');
});

test('Keenable fetch truncates and uses the authenticated endpoint', async () => {
  let seenUrl = '';
  let seenKey = '';
  await withFetch(
    async (url, init) => {
      seenUrl = String(url);
      seenKey = init.headers['x-api-key'];
      return new Response(JSON.stringify({ title: 'T', content: 'x'.repeat(50) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    async () => {
      const provider = new KeenableProvider({
        settings: () => ({
          requestTimeoutMs: 5_000,
          maxSnippetChars: 500,
          maxFetchChars: 10,
          keenable: { enabled: true, apiKeyEnv: 'KEENABLE_API_KEY', baseURL: 'https://api.keenable.ai' },
        }),
        resolveKey: async () => 'keen_test',
      });
      const result = await provider.fetch({ url: 'https://example.com/' });
      assert.match(seenUrl, /\/v1\/fetch/);
      assert.equal(seenKey, 'keen_test');
      assert.equal(result.truncated, true);
      assert.equal(result.body.content.length, 10);
    },
  );
});

test('Keenable fetch reports WEB_FETCH_TIMEOUT when the request times out', async () => {
  const hanging = (url, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    });
  await withFetch(hanging, async () => {
    const provider = new KeenableProvider({
      settings: () => ({
        requestTimeoutMs: 20,
        maxSnippetChars: 500,
        maxFetchChars: 100,
        keenable: { enabled: true, apiKeyEnv: 'KEENABLE_API_KEY', baseURL: 'https://api.keenable.ai' },
      }),
      resolveKey: async () => 'keen_test',
    });
    await assert.rejects(
      provider.fetch({ url: 'https://example.com/' }),
      (error) => error.code === 'WEB_FETCH_TIMEOUT' && /timed out/.test(error.message),
    );
  });
});

test('Exa fetch uses contents and truncates', async () => {
  let seenPath = '';
  await withFetch(
    async (url) => {
      seenPath = String(url);
      return new Response(JSON.stringify({ results: [{ url: 'https://example.com/', text: 'y'.repeat(50) }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    async () => {
      const provider = new ExaProvider({
        settings: () => ({
          requestTimeoutMs: 5_000,
          maxSnippetChars: 500,
          maxFetchChars: 10,
          exa: { enabled: true, apiKeyEnv: 'EXA_API_KEY', baseURL: 'https://api.exa.ai' },
        }),
        resolveKey: async () => 'exa_test',
      });
      const result = await provider.fetch({ url: 'https://example.com/' });
      assert.match(seenPath, /\/contents/);
      assert.equal(result.truncated, true);
      assert.equal(result.body.content.length, 10);
    },
  );
});

test('Keenable search sends query options and maps results', async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: String(url), init };
      return new Response(
        JSON.stringify({
          results: [
            { title: 'K', url: 'https://k.example/', snippet: 'line\nline', published_at: '2026-11-01T00:00:00Z' },
            { title: 'bad', url: 'ftp://bad.example/' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const provider = new KeenableProvider({
        settings: () => ({
          requestTimeoutMs: 5_000,
          maxSnippetChars: 20,
          maxFetchChars: 100,
          keenable: { enabled: true, apiKeyEnv: 'KEENABLE_API_KEY', baseURL: 'https://api.keenable.ai' },
        }),
        resolveKey: async () => 'keen_test',
      });
      const result = await provider.search({ query: 'DeepSeek', maxResults: 5 });
      assert.equal(seen.url, 'https://api.keenable.ai/v1/search');
      assert.equal(seen.init.method, 'POST');
      assert.equal(seen.init.headers['x-api-key'], 'keen_test');
      assert.deepEqual(JSON.parse(seen.init.body), {
        query: 'DeepSeek',
        snippet_max_length: 180,
        max_results: 5,
      });
      assert.equal(result.sources.length, 1);
      assert.equal(result.sources[0].url, 'https://k.example/');
      assert.equal(result.sources[0].snippet, 'line line');
      assert.equal(result.sources[0].publishedAt, '2026-11-01T00:00:00Z');
    },
  );
});

test('Exa search sends query options and maps highlights', async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: String(url), init };
      return new Response(
        JSON.stringify({
          results: [
            {
              title: 'E',
              url: 'https://e.example/',
              highlights: ['one', 'two'],
              text: 'body text',
              publishedDate: '2026-11-02T00:00:00Z',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const provider = new ExaProvider({
        settings: () => ({
          requestTimeoutMs: 5_000,
          maxSnippetChars: 100,
          maxFetchChars: 100,
          exa: { enabled: true, apiKeyEnv: 'EXA_API_KEY', baseURL: 'https://api.exa.ai' },
        }),
        resolveKey: async () => 'exa_test',
      });
      const result = await provider.search({ query: 'DeepSeek', maxResults: 3 });
      assert.equal(seen.url, 'https://api.exa.ai/search');
      assert.equal(seen.init.method, 'POST');
      assert.equal(seen.init.headers.authorization, 'Bearer exa_test');
      assert.deepEqual(JSON.parse(seen.init.body), {
        query: 'DeepSeek',
        type: 'auto',
        numResults: 3,
        contents: { highlights: { highlightsPerUrl: 1 }, text: { maxCharacters: 2000 } },
      });
      assert.equal(result.sources.length, 1);
      assert.equal(result.sources[0].url, 'https://e.example/');
      assert.equal(result.sources[0].snippet, 'one');
      assert.equal(result.sources[0].summary, 'one two');
      assert.equal(result.sources[0].publishedAt, '2026-11-02T00:00:00Z');
    },
  );
});
