/** Bad search responses must classify as invalid-response so the configurable fallback can gate them. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyFailure, toWebError } from '../lib/errors.js';
import { AutoSearchProvider } from '../lib/providers/router.js';
import { mapExaSearch } from '../lib/providers/exa.js';
import { mapTavilySearch } from '../lib/providers/tavily.js';
import { mapKeenableSearch } from '../lib/providers/keenable.js';
import { mapFirecrawlSearch } from '../lib/providers/firecrawl.js';
import { mapAihotItems } from '../lib/providers/aihot.js';

/** Each real search mapper plus a malformed envelope that must trip its guard. */
const SEARCH_MAPPERS = [
  ['Exa', () => mapExaSearch({})],
  ['Tavily', () => mapTavilySearch(null)],
  ['Keenable', () => mapKeenableSearch({})],
  ['Firecrawl', () => mapFirecrawlSearch(null)],
  ['AIHOT', () => mapAihotItems(null)],
];

for (const [provider, run] of SEARCH_MAPPERS) {
  test(`${provider} search mapper maps a bad response to invalid-response`, () => {
    let caught;
    try {
      run();
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, `${provider} mapper must throw on a malformed response`);
    const seamError = toWebError(caught, provider, 'search');
    assert.equal(seamError.code, 'WEB_INVALID_RESPONSE');
    assert.equal(classifyFailure(seamError), 'invalid-response');
  });
}

function baseSettings(overrides = {}) {
  return {
    searchMode: 'fast',
    intentRouting: false,
    chineseSearchOrder: ['bad', 'good'],
    defaultSearchOrder: ['bad', 'good'],
    requestTimeoutMs: 30_000,
    searchCacheTtlMs: 1_000,
    searchCacheMaxEntries: 0,
    bad: { enabled: true },
    good: { enabled: true },
    ...overrides,
  };
}

function badProvider(calls) {
  return {
    id: 'bad',
    available: () => true,
    ready: async () => true,
    async search() {
      calls.push('bad');
      let mapperError;
      try {
        mapExaSearch({});
      } catch (error) {
        mapperError = error;
      }
      throw toWebError(mapperError, 'Exa', 'search');
    },
  };
}

function goodProvider(calls) {
  return {
    id: 'good',
    available: () => true,
    ready: async () => true,
    async search() {
      calls.push('good');
      return { sources: [{ url: 'https://good.example/' }], truncated: false };
    },
  };
}

test('an allowed invalid-response falls back to the next search provider', async () => {
  const calls = [];
  const router = new AutoSearchProvider({
    settings: () => baseSettings({ fallbackFailureClasses: ['invalid-response'] }),
    providers: { bad: badProvider(calls), good: goodProvider(calls) },
  });
  const result = await router.search({ query: 'english query' });
  assert.deepEqual(calls, ['bad', 'good']);
  assert.equal(result.sources[0].url, 'https://good.example/');
});

test('excluding invalid-response stops the chain on a bad response', async () => {
  const calls = [];
  const router = new AutoSearchProvider({
    settings: () => baseSettings({ fallbackFailureClasses: ['quota', 'auth'] }),
    providers: { bad: badProvider(calls), good: goodProvider(calls) },
  });
  await assert.rejects(
    () => router.search({ query: 'english query' }),
    (error) => error.code === 'WEB_INVALID_RESPONSE',
  );
  assert.deepEqual(calls, ['bad']);
});
