import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSettings } from '../lib/settings.js';

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
