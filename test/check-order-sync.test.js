import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkChain } from '../scripts/check-order-sync.mjs';

const OK_CHAIN = ['keenable', 'anysearch', 'exa', 'bing', 'tavily', 'firecrawl'];

test('an authoritative chain passes', () => {
  assert.equal(checkChain(OK_CHAIN), null);
});

test('a drifted paste is reported', () => {
  const drifted = ['keenable', 'anysearch', 'tavily', 'exa', 'bing', 'firecrawl'];
  const violation = checkChain(drifted);
  assert.ok(violation.includes('matches none of'));
});

test('short or unknown sequences are ignored', () => {
  assert.equal(checkChain(['keenable', 'anysearch']), null);
  assert.equal(checkChain(['alpha', 'beta', 'gamma']), null);
});
