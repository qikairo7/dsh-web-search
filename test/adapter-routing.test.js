import test from 'node:test';
import assert from 'node:assert/strict';

import { TavilyProvider } from '../lib/providers/tavily.js';
import { FirecrawlProvider } from '../lib/providers/firecrawl.js';
import { ZhihuProvider } from '../lib/providers/zhihu.js';
import { AnySearchProvider } from '../lib/providers/anysearch.js';

function jsonEnvelope(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('Tavily search applies the news topic from routing and skips it without routing', async () => {
  const original = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return jsonEnvelope({ results: [] });
  };
  try {
    const provider = new TavilyProvider({
      settings: () => ({
        requestTimeoutMs: 5_000,
        maxSnippetChars: 300,
        languageRouting: true,
        tavily: {
          enabled: true,
          apiKeyEnv: 'TAVILY_API_KEY',
          baseURL: 'https://api.tavily.example',
          includeAnswer: false,
        },
      }),
      resolveKey: async () => 'k',
    });
    await provider.search({
      query: 'quiet topic lorem',
      maxResults: 5,
      routing: { intent: 'news', language: undefined, syntax: {} },
    });
    await provider.search({ query: 'quiet topic lorem', maxResults: 5 });
    assert.equal(bodies[0].topic, 'news');
    assert.equal(bodies[0].time_range, 'week');
    assert.equal('topic' in bodies[1], false);
  } finally {
    globalThis.fetch = original;
  }
});

test('Tavily search prefers the routing language over detected language', async () => {
  const original = globalThis.fetch;
  let body;
  globalThis.fetch = async (url, init) => {
    body = JSON.parse(init.body);
    return jsonEnvelope({ results: [] });
  };
  try {
    const provider = new TavilyProvider({
      settings: () => ({
        requestTimeoutMs: 5_000,
        maxSnippetChars: 300,
        languageRouting: true,
        tavily: {
          enabled: true,
          apiKeyEnv: 'TAVILY_API_KEY',
          baseURL: 'https://api.tavily.example',
          includeAnswer: false,
        },
      }),
      resolveKey: async () => 'k',
    });
    await provider.search({
      query: 'plain ascii query',
      maxResults: 5,
      routing: { intent: 'general', language: 'zh', syntax: {} },
    });
    assert.equal(body.language, 'zh');
  } finally {
    globalThis.fetch = original;
  }
});

test('Zhihu global search maps routing news intent to SearchDB=realtime and self-derives all', async () => {
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return jsonEnvelope({ Code: 0, Message: 'success', Data: { Items: [] } });
  };
  try {
    const provider = new ZhihuProvider({
      settings: () => ({
        requestTimeoutMs: 5_000,
        maxSnippetChars: 300,
        zhihu: {
          enabled: true,
          apiKeyEnv: 'ZHIHU_API_KEY',
          baseURL: 'https://developer.zhihu.example',
          includeMetadata: true,
        },
      }),
      resolveKey: async () => 'k',
    });
    await provider.search({
      query: 'quiet topic lorem',
      maxResults: 4,
      routing: { intent: 'news', syntax: {} },
    });
    await provider.search({ query: 'quiet topic lorem', maxResults: 4 });
    assert.match(urls[0], /SearchDB=realtime/);
    assert.match(urls[1], /SearchDB=all/);
  } finally {
    globalThis.fetch = original;
  }
});

test('AnySearch search prefers the routing language over detectLanguage', async () => {
  const original = globalThis.fetch;
  let body;
  globalThis.fetch = async (url, init) => {
    body = JSON.parse(init.body);
    return jsonEnvelope({ code: 0, data: { results: [] } });
  };
  try {
    const provider = new AnySearchProvider({
      settings: () => ({
        requestTimeoutMs: 5_000,
        maxSnippetChars: 300,
        languageRouting: true,
        anysearch: {
          enabled: true,
          apiKeyEnv: 'ANYSEARCH_API_KEY',
          baseURL: 'https://api.anysearch.example',
        },
      }),
      resolveKey: async () => 'k',
    });
    const result = await provider.search({
      query: '中文查询',
      maxResults: 4,
      routing: { language: 'en' },
    });
    assert.equal(body.language, 'en');
    assert.equal(result.sources.length, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test('Firecrawl search consumes routing news intent and after syntax', async () => {
  const original = globalThis.fetch;
  let body;
  globalThis.fetch = async (url, init) => {
    body = JSON.parse(init.body);
    return jsonEnvelope({ success: true, data: {} });
  };
  try {
    const provider = new FirecrawlProvider({
      settings: () => ({
        requestTimeoutMs: 5_000,
        maxSnippetChars: 300,
        firecrawl: {
          enabled: true,
          apiKeyEnv: 'FIRECRAWL_API_KEY',
          baseURL: 'https://api.firecrawl.example',
        },
      }),
      resolveKey: async () => 'k',
    });
    await provider.search({
      query: 'quiet topic lorem',
      maxResults: 5,
      routing: { intent: 'news', syntax: { after: '2026-01-01' } },
    });
    assert.ok(body.tbs.includes('cd_min:'));
    assert.deepEqual(body.sources, [{ type: 'web' }, { type: 'news' }]);
  } finally {
    globalThis.fetch = original;
  }
});
