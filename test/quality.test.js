import test from 'node:test';
import assert from 'node:assert/strict';

import { qualitySearch } from '../lib/quality.js';

function settings(overrides = {}) {
  return {
    officialDocsEnabled: false,
    enrichEnabled: false,
    semanticDedupThreshold: 0.95,
    ...overrides,
  };
}

const providers = {
  zhihu: { search: async () => ({}) },
  anysearch: { search: async () => ({}) },
  tavily: { search: async () => ({}) },
};

test('qualitySearch merges provider results, dedupes by URL and applies the reranker', async () => {
  const results = {
    zhihu: {
      sources: [
        { url: 'https://a.example/', title: 'A' },
        { url: 'https://shared.example/', title: 'shared' },
      ],
      truncated: false,
    },
    anysearch: {
      sources: [
        { url: 'https://b.example/', title: 'B' },
        { url: 'https://shared.example/', title: 'shared duplicate' },
      ],
      truncated: false,
    },
    tavily: { content: 'generated answer', sources: [{ url: 'https://c.example/', title: 'C' }], truncated: false },
  };
  const outcome = await qualitySearch({
    request: { query: 'DeepSeek 插件开发', maxResults: 10 },
    signal: undefined,
    settings: settings(),
    intent: 'general',
    providers,
    runner: { attempt: async (name) => results[name] },
    reranker: {
      rerankScored: async (_query, sources) =>
        sources.map((source, index) => ({ source, score: 10 - index, rank: index, index })),
    },
    embeddings: undefined,
    fetcher: undefined,
  });
  assert.deepEqual(
    outcome.sources.map((source) => source.url),
    ['https://a.example/', 'https://b.example/', 'https://c.example/', 'https://shared.example/'],
  );
  assert.equal(outcome.content, 'generated answer');
  assert.equal(outcome.truncated, false);
});

test('qualitySearch returns undefined when every provider fails', async () => {
  const outcome = await qualitySearch({
    request: { query: '普通查询' },
    signal: undefined,
    settings: settings(),
    intent: 'general',
    providers,
    runner: { attempt: async (name) => { throw new Error(`${name} failed`); } },
    reranker: undefined,
    embeddings: undefined,
    fetcher: undefined,
  });
  assert.equal(outcome, undefined);
});
