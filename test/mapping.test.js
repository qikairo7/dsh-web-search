import test from 'node:test';
import assert from 'node:assert/strict';

import { mapAnySearchSearch } from '../lib/providers/anysearch.js';
import { mapTavilySearch } from '../lib/providers/tavily.js';
import { mapFirecrawlSearch } from '../lib/providers/firecrawl.js';
import { mapZhihuSearch } from '../lib/providers/zhihu.js';

test('AnySearch maps citeable results and drops invalid URLs', () => {
  const result = mapAnySearchSearch(
    {
      code: 0,
      data: {
        results: [
          { title: 'A', url: 'https://a.example/', snippet: 'short', content: 'long body' },
          { title: 'bad', url: 'ftp://bad.example/' },
        ],
      },
    },
    100,
  );
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].title, 'A');
  assert.equal(result.sources[0].snippet, 'short');
  assert.equal(result.sources[0].summary, 'long body');
  assert.equal(result.truncated, false);
});

test('AnySearch rejects a non-zero business code', () => {
  assert.throws(() => mapAnySearchSearch({ code: 7, message: 'upstream failed' }), /upstream failed/);
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

test('Zhihu preserves the rate-limit code from the API envelope', () => {
  assert.throws(
    () => mapZhihuSearch({ Code: 30001, Message: 'too many requests' }),
    (error) => error.code === 'WEB_RATE_LIMITED',
  );
});
