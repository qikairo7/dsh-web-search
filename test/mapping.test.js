import test from 'node:test';
import assert from 'node:assert/strict';

import { AnySearchProvider, mapAnySearchSource } from '../lib/providers/anysearch.js';
import { AnySearchClient, AnySearchClientError } from '../lib/providers/anysearchClient.js';
import { mapTavilySearch, toDateBoundary } from '../lib/providers/tavily.js';
import { mapFirecrawlSearch, toMonthDayYear } from '../lib/providers/firecrawl.js';
import { mapZhihuSearch, toEpochBoundary } from '../lib/providers/zhihu.js';
import { withFetch } from './helpers/withFetch.js';

function anysearchProvider() {
  return new AnySearchProvider({
    settings: () => ({
      requestTimeoutMs: 5_000,
      maxSnippetChars: 100,
      anysearch: {
        enabled: true,
        apiKeyEnv: 'ANYSEARCH_API_KEY',
        baseURL: 'https://api.anysearch.com',
      },
    }),
    resolveKey: async () => undefined,
  });
}

test('AnySearch search maps citeable results and drops invalid URLs', async () => {
  const result = await withFetch(
    {
      body: {
        code: 0,
        message: 'ok',
        data: {
          results: [
            { title: 'A', url: 'https://a.example/', snippet: 'short', content: 'long body' },
            { title: 'bad', url: 'ftp://bad.example/' },
          ],
          metadata: { total_results: 1, search_time_ms: 1 },
        },
      },
    },
    () => anysearchProvider().search({ query: 'DeepSeek' }),
  );
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].title, 'A');
  assert.equal(result.sources[0].snippet, 'short');
  assert.equal(result.sources[0].summary, 'long body');
  assert.equal(result.truncated, false);
});

test('AnySearch search returns no sources for an empty response', async () => {
  const result = await withFetch(
    {
      body: {
        code: 0,
        message: 'ok',
        data: { results: [], metadata: { total_results: 0, search_time_ms: 0 } },
      },
    },
    () => anysearchProvider().search({ query: 'DeepSeek' }),
  );
  assert.deepEqual(result.sources, []);
  assert.equal(result.truncated, false);
});

test('AnySearch rejects a non-zero business code', async () => {
  const client = new AnySearchClient({
    baseURL: 'https://api.anysearch.com',
    resolveApiKey: async () => undefined,
  });
  await withFetch({ body: { code: 7, message: 'upstream failed' } }, () =>
    assert.rejects(client.search({ query: 'q' }), (error) => error instanceof AnySearchClientError && /upstream failed/.test(error.message)),
  );
});

test('AnySearch preserves optional date fields', () => {
  const source = mapAnySearchSource(
    { title: 'Dated', url: 'https://dated.example/', snippet: 's', date: '2026-11-11' },
  );
  assert.equal(source.publishedAt, '2026-11-11');
  const alternate = mapAnySearchSource(
    { title: 'Alt', url: 'https://alt.example/', snippet: 's', published_at: '2026-11-12' },
  );
  assert.equal(alternate.publishedAt, '2026-11-12');
});

test('AnySearch compresses long content into a bounded summary', () => {
  const content = Array.from({ length: 100 }, (_, index) => `Sentence ${index} about Node.js fetch timeout.`).join(' ');
  const source = mapAnySearchSource({ title: 'A', url: 'https://a.example/', content }, 4000, 'Node.js fetch timeout');
  assert.ok(source.summary.length <= 1500);
  assert.ok(source.summary.length >= 800);
});

test('Tavily maps the generated answer into content when enabled', () => {
  const data = {
    answer: 'generated answer',
    results: [
      { title: 'T', url: 'https://t.example/', content: 'short content', raw_content: 'long raw content' },
    ],
  };
  const withAnswer = mapTavilySearch(data, 100, true);
  assert.equal(withAnswer.content, 'generated answer');
  assert.equal(withAnswer.sources[0].snippet, 'long raw content');
  assert.equal(withAnswer.sources[0].summary, 'long raw content');

  const withoutAnswer = mapTavilySearch(data, 100, false);
  assert.equal(withoutAnswer.content, undefined);
});

test('Firecrawl maps web results and throws on failure envelopes', () => {
  const result = mapFirecrawlSearch({
    success: true,
    data: { web: [{ title: 'F', url: 'https://f.example/', description: 'description' }] },
  });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].snippet, 'description');
  assert.throws(() => mapFirecrawlSearch({ success: false, error: 'bad request' }), /bad request/);
});

test('Zhihu maps metadata into the summary text', () => {
  const result = mapZhihuSearch(
    {
      Code: 0,
      Data: {
        Items: [
          {
            Title: '标题',
            Url: 'https://zhuanlan.zhihu.com/p/1',
            ContentText: '<em>摘要</em>',
            AuthorName: '张三',
            VoteUpCount: 5,
            CommentCount: 2,
            EditTime: 1_700_000_000,
          },
        ],
      },
    },
    200,
    true,
  );
  assert.equal(result.sources.length, 1);
  assert.match(result.sources[0].summary, /作者：张三；赞同 5；评论 2/);
  assert.equal(result.sources[0].publishedAt, '2023-11-14T22:13:20.000Z');
});

test('Zhihu strips nested tag fragments and decodes entities once', () => {
  const result = mapZhihuSearch(
    {
      Code: 0,
      Data: {
        Items: [
          {
            Title: '<scr<script>ipt>alert(1)</script >',
            Url: 'https://example.com/1',
            ContentText: '&amp;lt; &amp;amp;',
          },
        ],
      },
    },
    200,
    false,
  );
  assert.equal(result.sources[0].title, 'alert(1)');
  assert.equal(result.sources[0].snippet, '&lt; &amp;');
});

test('Zhihu preserves the rate-limit code from the API envelope', () => {
  assert.throws(
    () => mapZhihuSearch({ Code: 30001, Message: 'too many requests' }),
    (error) => error.code === 'WEB_RATE_LIMITED',
  );
});

test('date boundary converters shape each provider wire format', () => {
  assert.equal(toDateBoundary('2025', false), '2025-01-01');
  assert.equal(toDateBoundary('2025', true), '2025-12-31');
  assert.equal(toMonthDayYear('2025-01-02', false), '01/02/2025');
  assert.equal(toEpochBoundary('2025-01-01', false), 1_735_689_600);
  assert.equal(toEpochBoundary('2025-01-01', true), 1_735_689_600 + 86_399);
});
