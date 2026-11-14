import test from 'node:test';
import assert from 'node:assert/strict';

import { mapAihotItems, normalizeAihotQuery } from '../lib/providers/aihot.js';

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
