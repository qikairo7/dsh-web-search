import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyIntent, fastOrder, qualityPair } from '../lib/intent.js';
import { resolveSettings } from '../lib/settings.js';

// searchCacheKey deliberately leaves the fast-mode provider order out of the
// key: that is only correct while classifyIntent, fastOrder, and qualityPair
// are pure functions of (query, settings). These tests pin the purity, so a
// time- or randomness-based routing decision fails loudly here instead of
// silently colliding cache entries.

function routingOutputs(query, settings) {
  const intent = classifyIntent(query);
  return {
    intent,
    fastOrder: fastOrder(query, settings, intent),
    qualityPair: qualityPair(query, intent),
  };
}

function settingsVariants() {
  const base = resolveSettings({});
  return [
    base,
    { ...base, chineseSearchOrder: ['tavily', 'exa'], defaultSearchOrder: ['exa', 'tavily'] },
    { ...base, intentRouting: false },
  ];
}

function sampleQueries() {
  return [
    'DeepSeek 插件开发',
    '怎么评价 DeepSeek',
    '2026年11月 AI 最新新闻',
    'Node.js fetch timeout',
    'USD CNY exchange rate',
  ];
}

test('routing decisions stay identical while Date.now and Math.random vary', () => {
  const variants = settingsVariants();
  const queries = sampleQueries();
  const baseline = variants.map((settings) => {
    const pristine = structuredClone(settings);
    const outputs = queries.map((query) => structuredClone(routingOutputs(query, settings)));
    assert.deepEqual(settings, pristine);
    return outputs;
  });

  const originalNow = Date.now;
  const originalRandom = Math.random;
  let tick = 0;
  Date.now = () => 1_800_000_000_000 + (tick += 1) * 79_193;
  Math.random = () => 0.123_456_789;
  try {
    assert.notEqual(Date.now(), originalNow());
    assert.notEqual(Math.random(), originalRandom());
    variants.forEach((settings, variantIndex) => {
      const snapshot = structuredClone(settings);
      queries.forEach((query, queryIndex) => {
        assert.deepEqual(routingOutputs(query, settings), baseline[variantIndex][queryIndex]);
      });
      assert.deepEqual(settings, snapshot);
    });
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
  }
});

test('routing decisions deep-equal themselves on repeated calls', () => {
  const variants = settingsVariants();
  for (const settings of variants) {
    for (const query of sampleQueries()) {
      const first = routingOutputs(query, settings);
      assert.deepEqual(routingOutputs(query, settings), first);
    }
  }
});
