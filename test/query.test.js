import test from 'node:test';
import assert from 'node:assert/strict';

import { parseQuerySyntax, toDateBoundary, toEpochBoundary, toMonthDayYear } from '../lib/query.js';

test('parses site, lang, after and before operators', () => {
  const parsed = parseQuerySyntax('DeepSeek site:github.com lang:zh after:2025-01-01 before:2026');
  assert.equal(parsed.site, 'github.com');
  assert.equal(parsed.lang, 'zh');
  assert.equal(parsed.after, '2025-01-01');
  assert.equal(parsed.before, '2026');
});

test('converts date boundaries for providers', () => {
  assert.equal(toDateBoundary('2025', false), '2025-01-01');
  assert.equal(toDateBoundary('2025', true), '2025-12-31');
  assert.equal(toMonthDayYear('2025-01-02', false), '01/02/2025');
  assert.equal(toEpochBoundary('2025-01-01', false), 1_735_689_600);
  assert.equal(toEpochBoundary('2025-01-01', true), 1_735_689_600 + 86_399);
});
