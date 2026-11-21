import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTavilyQuota, parseZhihuQuota, parseFirecrawlQuota, parseGithubQuota } from '../lib/health.js';

// Field-parsing coverage for the three quota mappers that used to live inline in
// fetchProviderQuota (#174). Each provider is exercised on a normal envelope, a
// missing-field envelope and a broken envelope; deleting a parser turns these red.

test('tavily parser prefers the plan envelope when both levels are present', () => {
  const result = parseTavilyQuota({
    key: { usage: 10, limit: 100 },
    account: { plan_usage: 20, plan_limit: 200 },
  }, 'tavily');
  assert.deepEqual(result, { ok: true, providerId: 'tavily', remaining: 180, limit: 200, used: 20 });
});

test('tavily parser falls back to the key envelope when plan fields are missing', () => {
  const result = parseTavilyQuota({ key: { usage: 10, limit: 100 } }, 'tavily');
  assert.deepEqual(result, { ok: true, providerId: 'tavily', remaining: 90, limit: 100, used: 10 });
});

test('tavily parser leaves quota fields undefined for a broken envelope', () => {
  const result = parseTavilyQuota(undefined, 'tavily');
  assert.equal(result.remaining, undefined);
  assert.equal(result.limit, undefined);
});

test('zhihu parser sums quota across items', () => {
  const result = parseZhihuQuota({
    Data: [
      { RemainingQuota: 5, TotalQuota: 10, TotalUsed: 5 },
      { RemainingQuota: 3, TotalQuota: 8, TotalUsed: 5 },
    ],
  }, 'zhihu');
  assert.deepEqual(result, { ok: true, providerId: 'zhihu', remaining: 8, limit: 18, used: 10 });
});

test('zhihu parser treats a missing per-item field as zero instead of NaN', () => {
  const result = parseZhihuQuota({ Data: [{ RemainingQuota: 5 }] }, 'zhihu');
  assert.deepEqual(result, { ok: true, providerId: 'zhihu', remaining: 5, limit: 0, used: 0 });
});

test('zhihu parser leaves quota fields undefined when the envelope has no items', () => {
  const result = parseZhihuQuota({}, 'zhihu');
  assert.equal(result.remaining, undefined);
  assert.equal(result.limit, undefined);
  assert.equal(result.used, undefined);
});

test('firecrawl parser reads remaining and plan credits', () => {
  const result = parseFirecrawlQuota({ data: { remainingCredits: 100, planCredits: 500 } }, 'firecrawl');
  assert.deepEqual(result, { ok: true, providerId: 'firecrawl', remaining: 100, limit: 500 });
});

test('firecrawl parser leaves a missing field undefined', () => {
  const result = parseFirecrawlQuota({ data: { remainingCredits: 100 } }, 'firecrawl');
  assert.deepEqual(result, { ok: true, providerId: 'firecrawl', remaining: 100, limit: undefined });
});

test('firecrawl parser leaves quota fields undefined for a broken envelope', () => {
  const result = parseFirecrawlQuota(null, 'firecrawl');
  assert.equal(result.remaining, undefined);
  assert.equal(result.limit, undefined);
});

test('github parser reads the search resource allowance', () => {
  const result = parseGithubQuota({ resources: { search: { limit: 30, remaining: 27, reset: 1 } } }, 'github');
  assert.deepEqual(result, { ok: true, providerId: 'github', remaining: 27, limit: 30 });
});

test('github parser leaves fields undefined for a broken envelope', () => {
  const result = parseGithubQuota(null, 'github');
  assert.equal(result.remaining, undefined);
  assert.equal(result.limit, undefined);
});
