import test from 'node:test';
import assert from 'node:assert/strict';

import { SiliconFlowReranker } from '../lib/rerank.js';

function rerankSettings() {
  return {
    requestTimeoutMs: 5_000,
    siliconflow: {
      enabled: true,
      apiKeyEnv: 'SILICONFLOW_API_KEY',
      baseURL: 'https://api.siliconflow.cn/v1',
      model: 'BAAI/bge-reranker-v2-m3',
    },
  };
}

function sources() {
  return [
    { url: 'https://a.example/', title: 'A', summary: 'alpha' },
    { url: 'https://b.example/', title: 'B', summary: 'beta' },
    { url: 'https://c.example/', title: 'C', summary: 'gamma' },
  ];
}

test('SiliconFlow reranker maps returned scores and ranks back to their sources', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        results: [
          { index: 2, relevance_score: 0.9 },
          { index: 0, relevance_score: 0.5 },
          { index: 1, relevance_score: 0.7 },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  try {
    const reranker = new SiliconFlowReranker({
      settings: rerankSettings,
      resolveKey: async () => 'key',
    });
    const scored = await reranker.rerankScored('query', sources(), undefined);
    for (const entry of scored) {
      assert.deepEqual(Object.keys(entry).sort(), ['index', 'rank', 'score', 'source']);
    }
    const byScore = [...scored].sort((left, right) => right.score - left.score);
    assert.deepEqual(
      byScore.map((entry) => entry.source.url),
      ['https://c.example/', 'https://b.example/', 'https://a.example/'],
    );
    const byRank = [...scored].sort((left, right) => left.rank - right.rank);
    assert.deepEqual(
      byRank.map((entry) => entry.source.url),
      ['https://c.example/', 'https://a.example/', 'https://b.example/'],
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('SiliconFlow reranker returns undefined without a key', async () => {
  const reranker = new SiliconFlowReranker({
    settings: rerankSettings,
    resolveKey: async () => undefined,
  });
  assert.equal(await reranker.rerankScored('query', sources(), undefined), undefined);
});
