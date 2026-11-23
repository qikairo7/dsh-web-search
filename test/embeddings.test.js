import test from 'node:test';
import assert from 'node:assert/strict';

import { SiliconFlowEmbeddings } from '../lib/embeddings.js';

function settings() {
  return {
    requestTimeoutMs: 5_000,
    siliconflow: {
      enabled: true,
      apiKeyEnv: 'SILICONFLOW_API_KEY',
      baseURL: 'https://api.siliconflow.cn/v1',
      model: 'BAAI/bge-reranker-v2-m3',
      embeddingsEnabled: true,
      embeddingModel: 'BAAI/bge-m3',
    },
  };
}

test('SiliconFlowEmbeddings removes near-duplicate sources', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        object: 'list',
        data: [
          { index: 0, embedding: [1, 0] },
          { index: 1, embedding: [1, 0.01] },
          { index: 2, embedding: [0, 1] },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  try {
    const embeddings = new SiliconFlowEmbeddings({ settings, resolveKey: async () => 'key' });
    const result = await embeddings.dedupe(
      [
        { url: 'https://a.example/', title: 'A', summary: 'same' },
        { url: 'https://b.example/', title: 'B', summary: 'same' },
        { url: 'https://c.example/', title: 'C', summary: 'different' },
      ],
      0.95,
    );
    assert.deepEqual(result.map((source) => source.url), [
      'https://a.example/',
      'https://c.example/',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test('SiliconFlowEmbeddings leaves sources unchanged without a key', async () => {
  const embeddings = new SiliconFlowEmbeddings({ settings, resolveKey: async () => undefined });
  const sources = [{ url: 'https://a.example/' }, { url: 'https://b.example/' }];
  assert.deepEqual(await embeddings.dedupe(sources, 0.95), sources);
});

test('SiliconFlowEmbeddings rethrows caller cancellation', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new DOMException('Aborted', 'AbortError'); };
  try {
    const embeddings = new SiliconFlowEmbeddings({ settings, resolveKey: async () => 'key' });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => embeddings.embed(['a', 'b'], controller.signal),
      (error) => error.code === 'WEB_ABORTED',
    );
  } finally {
    globalThis.fetch = original;
  }
});
