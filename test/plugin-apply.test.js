import test from 'node:test';
import assert from 'node:assert/strict';

import { apply, createProviders, inject } from '../lib/index.js';
import { PROVIDER_CATALOG, PROVIDER_IDS, providersWithCapability } from '../lib/catalog.js';
import { resolveSettings } from '../lib/settings.js';

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

test('apply warns when the profile does not declare the tool-web bundle', () => {
  const { ctx } = fakeContext();
  const warnings = [];
  ctx.get = (name) => (name === 'profileContext' ? { startedBundles: ['custom-bundle'] } : undefined);
  ctx.logger = (name) => ({ warn(message) { warnings.push({ name, message }); } });
  apply(ctx, {});
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].name, 'web-search-router');
  assert.match(warnings[0].message, /dsh-tool-web/);
});

test('apply stays quiet when a standard bundle provides the tool layer', () => {
  const { ctx } = fakeContext();
  const warnings = [];
  ctx.get = (name) => (name === 'profileContext' ? { startedBundles: ['@deepseek-ai/dsh-base'] } : undefined);
  ctx.logger = () => ({ warn(message) { warnings.push(message); } });
  apply(ctx, {});
  assert.deepEqual(warnings, []);
});

test('constructed providers are keyed exactly like the catalog order', () => {
  const providers = createProviders({
    settings: () => resolveSettings(),
    resolveKey: async () => undefined,
  });
  assert.deepEqual(Object.keys(providers), [...PROVIDER_IDS]);
  for (const id of PROVIDER_IDS) {
    assert.equal(providers[id].id, id, `${id} instance id`);
  }
});
