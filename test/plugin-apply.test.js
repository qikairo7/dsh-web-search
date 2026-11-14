import test from 'node:test';
import assert from 'node:assert/strict';

import { apply, inject } from '../lib/index.js';
import { PROVIDER_CATALOG, providersWithCapability } from '../lib/catalog.js';

function fakeContext() {
  const search = [];
  const fetch = [];
  const tools = [];
  return {
    ctx: {
      web: {
        registerSearchProvider(provider) { search.push(provider.id); },
        registerFetchProvider(provider) { fetch.push(provider.id); },
      },
      credentials: { resolve: async () => undefined },
      tools: { register(definition) { tools.push(definition.name); } },
    },
    search,
    fetch,
    tools,
  };
}

test('apply registers every catalog provider and the allowlisted tools', () => {
  const { ctx, search, fetch, tools } = fakeContext();
  apply(ctx, {});
  assert.deepEqual(search, [...providersWithCapability('search'), 'auto']);
  assert.deepEqual(fetch, [...providersWithCapability('fetch'), 'auto']);
  assert.deepEqual(tools, [
    'anysearch_capabilities',
    'anysearch_search',
    'anysearch_batch_search',
    'tavily_search',
    'tavily_extract',
    'aihot_latest',
    'aihot_hot',
  ]);
  assert.ok(inject.includes('tools'));
  assert.ok(PROVIDER_CATALOG.length > 0);
});
