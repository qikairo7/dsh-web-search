import test from 'node:test';
import assert from 'node:assert/strict';

import { TavilyProvider } from '../lib/providers/tavily.js';
import { withFetch } from './helpers/withFetch.js';

function settings(overrides = {}) {
  return {
    requestTimeoutMs: 5_000,
    maxSnippetChars: 20,
    maxFetchChars: 20,
    ...overrides,
    tavily: {
      enabled: true,
      apiKeyEnv: 'TAVILY_API_KEY',
      baseURL: 'https://api.tavily.com',
      includeAnswer: true,
      ...(overrides.tavily ?? {}),
    },
  };
}

function provider(overrides = {}) {
  return new TavilyProvider({
    settings: () => settings(overrides),
    resolveKey: async () => 'tvly_test',
  });
}

test('TavilyProvider.searchAdvanced posts filters to /search and maps results', async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: String(url), init };
      return new Response(
        JSON.stringify({
          answer: 'generated answer',
          results: [
            {
              title: 'One',
              url: 'https://one.example/',
              content: 'x'.repeat(60),
              published_date: '2026-11-01',
            },
            { title: 'Two', url: 'https://two.example/', raw_content: 'raw body' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const tavily = provider();
      const result = await tavily.searchAdvanced({
        query: 'DeepSeek news',
        searchDepth: 'advanced',
        maxResults: 5,
        topic: 'news',
        includeAnswer: true,
        timeRange: 'week',
        includeDomains: ['example.com'],
        excludeDomains: ['bad.example'],
        country: 'US',
        chunksPerSource: 2,
        filterByPublishedDate: true,
      });
      assert.equal(seen.url, 'https://api.tavily.com/search');
      assert.equal(seen.init.method, 'POST');
      assert.equal(seen.init.headers.authorization, 'Bearer tvly_test');
      const body = JSON.parse(seen.init.body);
      assert.equal(body.query, 'DeepSeek news');
      assert.equal(body.search_depth, 'advanced');
      assert.equal(body.max_results, 5);
      assert.equal(body.topic, 'news');
      assert.equal(body.include_answer, true);
      assert.equal(body.include_raw_content, true);
      assert.equal(body.include_published_date, true);
      assert.equal(body.time_range, 'week');
      assert.deepEqual(body.include_domains, ['example.com']);
      assert.deepEqual(body.exclude_domains, ['bad.example']);
      assert.equal(body.country, 'US');
      assert.equal(body.chunks_per_source, 2);
      assert.equal(body.filter_by_published_date, true);
      assert.equal(result.content, 'generated answer');
      assert.equal(result.sources.length, 2);
      assert.equal(result.sources[0].snippet.length, 20);
      assert.equal(result.sources[0].publishedAt, '2026-11-01');
    },
  );
});

test('TavilyProvider.extractMany posts multiple URLs to /extract and separates failed results', async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: String(url), init };
      return new Response(
        JSON.stringify({
          results: [
            {
              url: 'https://a.example/',
              title: 'A',
              raw_content: 'a'.repeat(50),
              published_date: '2026-11-01',
            },
            { url: 'https://b.example/', title: 'B', raw_content: 'short' },
          ],
          failed_results: [{ url: 'https://c.example/', error: 'timeout' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const tavily = provider();
      const result = await tavily.extractMany(
        ['https://a.example/', 'https://b.example/', 'https://c.example/'],
        {
          extractDepth: 'advanced',
          format: 'text',
          includeImages: true,
          includePublishedDate: true,
          query: 'intent',
          chunksPerSource: 2,
        },
      );
      assert.equal(seen.url, 'https://api.tavily.com/extract');
      assert.equal(seen.init.method, 'POST');
      assert.equal(seen.init.headers.authorization, 'Bearer tvly_test');
      const body = JSON.parse(seen.init.body);
      assert.deepEqual(body.urls, ['https://a.example/', 'https://b.example/', 'https://c.example/']);
      assert.equal(body.extract_depth, 'advanced');
      assert.equal(body.format, 'text');
      assert.equal(body.include_images, true);
      assert.equal(body.include_published_date, true);
      assert.equal(body.query, 'intent');
      assert.equal(body.chunks_per_source, 2);
      assert.equal(result.results.length, 2);
      assert.equal(result.results[0].content.length, 20);
      assert.equal(result.results[0].truncated, true);
      assert.equal(result.results[0].publishedDate, '2026-11-01');
      assert.equal(result.results[1].content, 'short');
      assert.equal(result.results[1].truncated, false);
      assert.deepEqual(result.failed, [{ url: 'https://c.example/', error: 'timeout' }]);
    },
  );
});
