import test from 'node:test';
import assert from 'node:assert/strict';

import { Config } from '../lib/index.js';
import { DEFAULT_SETTINGS, SETTINGS_SPEC, resolveSettings } from '../lib/settings.js';

const readPath = (value, path) => path.split('.').reduce((current, key) => current[key], value);

test('resolves every default in the documented settings shape', () => {
  assert.deepEqual(resolveSettings(), DEFAULT_SETTINGS);
});

test('resolves enrichment settings including zero topN', () => {
  const settings = resolveSettings({
    enrichEnabled: false,
    enrichTopN: 0,
    enrichSummaryMinChars: 1_200,
    enrichSummaryMaxChars: 2_000,
  });
  assert.equal(settings.enrichEnabled, false);
  assert.equal(settings.enrichTopN, 0);
  assert.equal(settings.enrichSummaryMinChars, 1_200);
  assert.equal(settings.enrichSummaryMaxChars, 2_000);
});

test('falls back for invalid enrichment settings', () => {
  const settings = resolveSettings({ enrichTopN: 11, enrichSummaryMinChars: 0 });
  assert.equal(settings.enrichTopN, 5);
  assert.equal(settings.enrichSummaryMinChars, 800);
});

test('coerces order lists and rejects unknown enum values', () => {
  const settings = resolveSettings({
    searchMode: 'turbo',
    chineseSearchOrder: ' ZHIHU, anysearch ; zhihu ',
    fetchOrder: [],
  });
  assert.equal(settings.searchMode, 'quality');
  assert.deepEqual(settings.chineseSearchOrder, ['zhihu', 'anysearch']);
  assert.deepEqual(settings.fetchOrder, DEFAULT_SETTINGS.fetchOrder);
});

test('keeps numeric coercion rules for each number kind', () => {
  const settings = resolveSettings({
    requestTimeoutMs: '45000',
    enrichTopN: '0',
    enrichSummaryMaxChars: 0,
    semanticDedupThreshold: '0.8',
  });
  assert.equal(settings.requestTimeoutMs, 45_000);
  assert.equal(settings.enrichTopN, 0);
  assert.equal(settings.enrichSummaryMaxChars, 1_500);
  assert.equal(settings.semanticDedupThreshold, 0.95);
});

test('dereferences volatile config references', () => {
  const settings = resolveSettings({
    searchMode: { get: () => 'fast' },
    enrichTopN: { get: () => 2 },
    tavilyApiKeyEnv: { get: () => 'CUSTOM_TAVILY_KEY' },
  });
  assert.equal(settings.searchMode, 'fast');
  assert.equal(settings.enrichTopN, 2);
  assert.equal(settings.tavily.apiKeyEnv, 'CUSTOM_TAVILY_KEY');
});

test('Config contains every spec field with its default, role, and volatility', () => {
  assert.deepEqual(
    Object.keys(Config.dict),
    SETTINGS_SPEC.map((spec) => spec.key),
  );
  for (const spec of SETTINGS_SPEC) {
    const field = Config.dict[spec.key];
    const fallback = readPath(DEFAULT_SETTINGS, spec.defaultPath);
    const expected = spec.kind === 'order' ? fallback.join(',') : fallback;
    assert.ok(field, `missing Config field ${spec.key}`);
    assert.deepEqual(field.meta.default, expected, `${spec.key} default`);
    assert.equal(field.meta.role, spec.role, `${spec.key} role`);
    assert.equal(field.meta.volatile, true, `${spec.key} volatile`);
  }
});
