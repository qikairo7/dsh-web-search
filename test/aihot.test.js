import test from 'node:test';
import assert from 'node:assert/strict';

import { AihotProvider, mapAihotItems, normalizeAihotQuery } from '../lib/providers/aihot.js';

test('normalizeAihotQuery removes dates and generic news words', () => {
  assert.equal(normalizeAihotQuery('2026年11月 AI 行业新闻'), 'AI');
  assert.equal(normalizeAihotQuery('AI industry news November 2026'), 'AI');
  assert.equal(normalizeAihotQuery('DeepSeek'), 'DeepSeek');
});

test('mapAihotItems maps original links, summaries and timestamps', () => {
  const result = mapAihotItems(
    {
      items: [
        {
          title: 'AI news',
          summary: 'summary text',
          links: { original: 'https://example.com/news', aihot: 'https://aihot.news/items/1' },
          publishedAt: '2026-11-13T12:00:00.000Z',
        },
      ],
    },
    100,
  );
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].url, 'https://example.com/news');
  assert.equal(result.sources[0].title, 'AI news');
  assert.equal(result.sources[0].summary, 'summary text');
  assert.equal(result.sources[0].publishedAt, '2026-11-13T12:00:00.000Z');
});

function aihotSettings() {
  return {
    requestTimeoutMs: 5_000,
    maxSnippetChars: 800,
    aihot: { enabled: true, baseURL: 'https://aihot.news' },
  };
}

test('AihotProvider.latest requests the agent latest endpoint with query options', async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), init };
    return new Response('# Latest AI news', {
      status: 200,
      headers: { 'content-type': 'text/markdown' },
    });
  };
  try {
    const provider = new AihotProvider({ settings: aihotSettings });
    const result = await provider.latest({ window: '7d', category: 'ai-models', mode: 'selected', limit: 5 });
    assert.equal(result, '# Latest AI news');
    const url = new URL(seen.url);
    assert.equal(url.origin, 'https://aihot.news');
    assert.equal(url.pathname, '/api/v1/agent/latest');
    assert.equal(url.searchParams.get('window'), '7d');
    assert.equal(url.searchParams.get('category'), 'ai-models');
    assert.equal(url.searchParams.get('mode'), 'selected');
    assert.equal(url.searchParams.get('limit'), '5');
    assert.equal(seen.init.method, 'GET');
    assert.match(seen.init.headers.accept, /text\/markdown/);
  } finally {
    globalThis.fetch = original;
  }
});

test('AihotProvider.hot requests the agent hot endpoint and returns Markdown', async () => {
  const original = globalThis.fetch;
  let seenUrl = '';
  globalThis.fetch = async (url) => {
    seenUrl = String(url);
    return new Response('# Hot topics', {
      status: 200,
      headers: { 'content-type': 'text/markdown' },
    });
  };
  try {
    const provider = new AihotProvider({ settings: aihotSettings });
    const result = await provider.hot();
    assert.equal(result, '# Hot topics');
    assert.equal(seenUrl, 'https://aihot.news/api/v1/agent/hot');
  } finally {
    globalThis.fetch = original;
  }
});
