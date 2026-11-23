import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSettings } from '../lib/settings.js';
import { ProviderRunner } from '../lib/providerRunner.js';

test('mode parameter defaults resolve and invalid values fall back', () => {
  const defaults = resolveSettings();
  assert.equal(defaults.qualityMaxEngines, 4);
  assert.equal(defaults.qualityRerankEnabled, true);
  assert.deepEqual(defaults.qualityExcludedProviders, []);
  assert.equal(defaults.fastPrimaryProvider, '');
  assert.equal(defaults.fastMaxFallbacks, 1);
  assert.deepEqual(defaults.cleanExtractProviders, ['keenable', 'anysearch', 'exa']);
  const clamped = resolveSettings({ qualityMaxEngines: 99, fastMaxFallbacks: -1, qualityExcludedProviders: 'github, github' });
  assert.equal(clamped.qualityMaxEngines, 4);
  assert.equal(clamped.fastMaxFallbacks, 1);
  assert.deepEqual(clamped.qualityExcludedProviders, ['github']);
});

test('capability switches filter provider candidates', () => {
  const providers = {
    alpha: { search: async () => ({ sources: [] }), available: () => true, ready: async () => true },
    beta: { search: async () => ({ sources: [] }), available: () => true, ready: async () => true },
  };
  const runner = new ProviderRunner({
    providers,
    settings: () => ({
      alpha: { enabled: true, searchEnabled: false, fetchEnabled: true },
      beta: { enabled: true, searchEnabled: true, fetchEnabled: false },
    }),
  });
  assert.deepEqual(runner.candidates('search', ['alpha', 'beta']), ['beta']);
  assert.deepEqual(runner.candidates('fetch', ['alpha', 'beta']), []);
});

test('AnySearch feature defaults stay in the documented shape', () => {
  const anysearch = resolveSettings().anysearch;
  assert.equal(anysearch.searchEnabled, true);
  assert.equal(anysearch.fetchEnabled, true);
  assert.equal(anysearch.tag, '');
  assert.equal(anysearch.zone, 'auto');
  assert.equal(anysearch.cleanContent, true);
  assert.equal(anysearch.batchEnabled, true);
  assert.equal(resolveSettings().zhihu.searchMode, 'global');
});
