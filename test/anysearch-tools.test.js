import test from 'node:test';
import assert from 'node:assert/strict';

import { registerAnySearchTools, registerTavilyTools, registerAihotToolset } from '../lib/tools/index.js';
import { parseAdvancedSearchArgs } from '../lib/tools/anysearch-search.js';
import { parseBatchSearchItems } from '../lib/tools/anysearch-batch.js';

test('registers the three optional AnySearch tools', () => {
  const names = [];
  const ctx = { tools: { register(definition) { names.push(definition.name); } } };
  registerAnySearchTools(ctx, {
    getClient: () => ({
      search: async () => ({ results: [], metadata: { totalResults: 0, searchTimeMs: 0 } }),
      listDomains: async () => ({ domains: [] }),
      getSubDomains: async () => ({ domains: [] }),
    }),
    getMaxRenderedContentChars: () => 12_000,
  });
  assert.deepEqual(names, ['anysearch_capabilities', 'anysearch_search', 'anysearch_batch_search']);
});

test('advanced search validates tags, params, and result bounds', () => {
  const parsed = parseAdvancedSearchArgs({
    query: '  DeepSeek Harness  ',
    maxResults: 5,
    tag: 'academic',
    params: { year: 2026, peer_reviewed: true },
    zone: 'cn',
    includeContent: true,
  });
  assert.equal(parsed.request.query, 'DeepSeek Harness');
  assert.equal(parsed.request.maxResults, 5);
  assert.equal(parsed.request.tag, 'academic');
  assert.deepEqual({ ...parsed.request.params }, { year: 2026, peer_reviewed: true });
  assert.equal(parsed.includeContent, true);

  assert.throws(() => parseAdvancedSearchArgs({ query: 'x', maxResults: 21 }), /1 to 20/);
  assert.throws(() => parseAdvancedSearchArgs({ query: 'x', params: { bad: null } }), /string, finite number, or boolean/);
});

test('batch accepts one to five independent searches', () => {
  const parsed = parseBatchSearchItems([
    { query: 'a' },
    { query: 'b', tag: 'finance' },
  ]);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].request.tag, 'finance');
  assert.throws(() => parseBatchSearchItems([]), /at least one/);
  assert.throws(
    () => parseBatchSearchItems(Array.from({ length: 6 }, (_, index) => ({ query: String(index) }))),
    /at most 5/,
  );
});

test('registers the two Tavily advanced tools', () => {
  const names = [];
  const ctx = { tools: { register(definition) { names.push(definition.name); } } };
  registerTavilyTools(ctx, {
    searchAdvanced: async () => ({ sources: [], truncated: false }),
    extractMany: async () => ({ results: [], failed: [] }),
  });
  assert.deepEqual(names, ['tavily_search', 'tavily_extract']);
});

test('registers the two free AIHOT tools', () => {
  const names = [];
  const ctx = { tools: { register(definition) { names.push(definition.name); } } };
  registerAihotToolset(ctx, {
    latest: async () => '# latest',
    hot: async () => '# hot',
  });
  assert.deepEqual(names, ['aihot_latest', 'aihot_hot']);
});
