import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkChain, scanText } from '../scripts/check-order-sync.mjs';

const OK_CHAIN = ['keenable', 'anysearch', 'exa', 'bing', 'tavily', 'firecrawl'];
const FETCH_ORDER = ['keenable', 'http', 'anysearch', 'exa', 'tavily', 'firecrawl'];

test('an authoritative chain passes', () => {
  assert.equal(checkChain(OK_CHAIN), null);
});

test('a drifted paste is reported', () => {
  const drifted = ['keenable', 'anysearch', 'tavily', 'exa', 'bing', 'firecrawl'];
  const violation = checkChain(drifted);
  assert.ok(violation.includes('matches none of'));
});

test('sequences shorter than every chain are ignored', () => {
  assert.equal(checkChain(['keenable', 'anysearch']), null);
  assert.equal(checkChain(['alpha', 'beta', 'gamma']), null);
});

// #55: legal fan-outs are shorter than every authoritative chain — they pass.
test('a legal fan-out shorter than every chain passes', () => {
  assert.equal(checkChain(['zhihu', 'keenable', 'anysearch']), null);
});

// #56: an unknown id one edit away from a known id is a reported typo drift.
test('a typo id one edit from a known id is reported as drift', () => {
  const violation = checkChain(['keenable', 'http', 'anysearch', 'exa', 'tavly', 'firecrawl']);
  assert.ok(violation.includes('matches none of'));
  assert.ok(violation.includes('"tavly"'));
  assert.ok(violation.includes('"tavily"'));
});

// #25: an authoritative-length chain that mixes in an unknown id is still judged
// on order — a full-length chain must reproduce an authoritative chain verbatim.
test('an authoritative-length chain with an unknown id is reported', () => {
  const violation = checkChain(['keenable', 'anysearch', 'exa', 'bing', 'serper', 'firecrawl']);
  assert.ok(violation.includes('matches none of'));
  assert.ok(violation.includes('keenable → anysearch → exa → bing → serper → firecrawl'));
});

// #25: unknown id plus a reordered pair must not skip the order comparison.
test('an authoritative-length chain with an unknown id and wrong order is reported', () => {
  const violation = checkChain(['keenable', 'anysearch', 'bing', 'exa', 'serper', 'firecrawl']);
  assert.ok(violation.includes('matches none of'));
  assert.ok(violation.includes('keenable → anysearch → bing → exa → serper → firecrawl'));
});

// #25: docs/configuration.md prints a six-item failure-class taxonomy that is
// the same length as defaultSearchOrder; it is not a provider paste.
test('a same-length chain from another taxonomy stays silent', () => {
  assert.equal(
    checkChain(['quota', 'auth', 'bot-wall', 'transient', 'invalid-response', 'unknown']),
    null,
  );
});

// #56: unknown ids far from every known id stay silent (no false positives).
test('unknown ids far from every known id are ignored', () => {
  assert.equal(checkChain(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']), null);
});

// #57: fetchOrder has http mid-chain; the paste form must pass as-is.
test('a fetchOrder paste with http mid-chain passes', () => {
  assert.equal(checkChain(FETCH_ORDER), null);
});

// #57: a doc with one authoritative arrow chain plus one drifted comma chain
// yields exactly one failure (comma chains are scanned in configuration docs).
test('scanText reports exactly the drifted comma chain', () => {
  const text = [
    'search order: `keenable → anysearch → exa → bing → tavily → firecrawl`',
    'fallback: keenable,anysearch,tavily,exa,bing,firecrawl',
  ].join('\n');
  const failures = [];
  scanText(text, 'docs/configuration.md', failures);
  assert.equal(failures.length, 1);
  assert.ok(failures[0].startsWith('docs/configuration.md: '));
  assert.ok(failures[0].includes('matches none of'));
});
