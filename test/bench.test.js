import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyIntent } from '../lib/intent.js';
import { classifyFailure } from '../lib/errors.js';
import { detectLanguage } from '../lib/text.js';

/** Magnitude-level performance floors (CI-safe): each floor is ~1/10 of the
 * measured local baseline, so only an order-of-magnitude regression fails.
 * Baselines (2026-11-17, local): intent 2.6M/s, failure 16.5M/s, lang 25.8M/s. */

const QUERY = 'how to parse json in node.js site:stackoverflow.com';

function opsPerSecond(fn) {
  const iterations = 20000;
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i += 1) fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return (iterations / ms) * 1000;
}

test('classifyIntent stays above its performance floor', () => {
  assert.ok(opsPerSecond(() => classifyIntent(QUERY)) > 200_000, 'classifyIntent below 200k ops/s');
});

test('classifyFailure stays above its performance floor', () => {
  assert.ok(
    opsPerSecond(() => classifyFailure({ code: 'WEB_RATE_LIMITED' })) > 1_500_000,
    'classifyFailure below 1.5M ops/s',
  );
});

test('detectLanguage stays above its performance floor', () => {
  assert.ok(opsPerSecond(() => detectLanguage(QUERY)) > 2_500_000, 'detectLanguage below 2.5M ops/s');
});
