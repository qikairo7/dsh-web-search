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

test('SiliconFlow reranker reorders sources by returned index', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ results: [{ index: 2 }, { index: 0 }, { index: 1 }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  try {
    const reranker = new SiliconFlowReranker({
      settings: rerankSettings,
      resolveKey: async () => 'key',
    });
    const result = await reranker.rerank('query', sources(), 3);
    assert.deepEqual(result.map((source) => source.url), [
      'https://c.example/',
      'https://a.example/',
      'https://b.example/',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test('SiliconFlow reranker returns the original order without a key', async () => {
  const reranker = new SiliconFlowReranker({
    settings: rerankSettings,
    resolveKey: async () => undefined,
  });
  const original = sources();
  const result = await reranker.rerank('query', original, 3);
  assert.deepEqual(result, original);
});
