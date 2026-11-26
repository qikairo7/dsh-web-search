import test from 'node:test';
import assert from 'node:assert/strict';

import { ZhihuProvider } from '../lib/providers/zhihu.js';
import { withFetch } from './helpers/withFetch.js';

function zhihuSettings() {
  return {
    requestTimeoutMs: 5_000,
    maxSnippetChars: 300,
    zhihu: {
      enabled: true,
      apiKeyEnv: 'ZHIHU_API_KEY',
      baseURL: 'https://developer.zhihu.com',
      includeMetadata: true,
    },
  };
}

function item(title, url) {
  return {
    Title: title,
    Url: url,
    ContentText: `${title} 摘要`,
    AuthorName: '作者',
    VoteUpCount: 1,
    CommentCount: 2,
    EditTime: 1_700_000_000,
  };
}

test('Zhihu global search supplements Chinese queries with site search', async () => {
  const calls = [];
  await withFetch(
    async (url) => {
      const text = String(url);
      calls.push(text);
      const isSite = text.includes('/zhihu_search');
      const items = isSite
        ? [item('站内一', 'https://zhuanlan.zhihu.com/p/2'), item('站内二', 'https://zhuanlan.zhihu.com/p/3')]
        : [item('全网一', 'https://example.com/1'), item('全网二', 'https://example.com/2')];
      return new Response(JSON.stringify({ Code: 0, Message: 'success', Data: { Items: items } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    async () => {
      const provider = new ZhihuProvider({ settings: zhihuSettings, resolveKey: async () => 'key' });
      const result = await provider.search({ query: '中文查询', maxResults: 4 });
      assert.equal(result.sources.length, 4);
      assert.equal(calls.filter((url) => url.includes('/global_search')).length, 1);
      assert.equal(calls.filter((url) => url.includes('/zhihu_search')).length, 1);
      assert.equal(result.sources[2].url, 'https://zhuanlan.zhihu.com/p/2');
    },
  );
});

function searchFilter(url) {
  return new URL(url).searchParams.get('Filter') ?? undefined;
}

function assertSafeHostFilter(filter) {
  assert.ok(
    filter === undefined || /^host=="[a-z0-9.-]+"$/iu.test(filter),
    `Filter must not widen or unbalance the host clause: ${filter}`,
  );
}

test('Zhihu global search rejects a site operator that closes the quoted host clause', async () => {
  const calls = [];
  await withFetch(
    async (url) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({ Code: 0, Message: 'success', Data: { Items: [item('全网一', 'https://example.com/1')] } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const provider = new ZhihuProvider({ settings: zhihuSettings, resolveKey: async () => 'key' });
      await provider.search({ query: '中文 site:a.com"||host=="b.com', maxResults: 4 });
    },
  );
  const global = calls.find((url) => url.includes('/global_search'));
  assert.ok(global, 'global search must be requested');
  assertSafeHostFilter(searchFilter(global));
});

test('Zhihu global search rejects a site operator with an unbalanced quote', async () => {
  const calls = [];
  await withFetch(
    async (url) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({ Code: 0, Message: 'success', Data: { Items: [item('全网一', 'https://example.com/1')] } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const provider = new ZhihuProvider({ settings: zhihuSettings, resolveKey: async () => 'key' });
      await provider.search({ query: '中文 site:zhihu.com"', maxResults: 4 });
    },
  );
  const global = calls.find((url) => url.includes('/global_search'));
  assert.ok(global, 'global search must be requested');
  assertSafeHostFilter(searchFilter(global));
});

test('Zhihu global search does not call site search for English queries', async () => {
  const calls = [];
  await withFetch(
    async (url) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({ Code: 0, Message: 'success', Data: { Items: [item('one', 'https://example.com/1')] } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const provider = new ZhihuProvider({ settings: zhihuSettings, resolveKey: async () => 'key' });
      const result = await provider.search({ query: 'Node.js fetch timeout', maxResults: 4 });
      assert.equal(result.sources.length, 1);
      assert.equal(calls.filter((url) => url.includes('/zhihu_search')).length, 0);
    },
  );
});
