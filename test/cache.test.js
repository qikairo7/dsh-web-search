import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { ResultCache, TtlLruCache } from '../lib/cache.js';

test('TtlLruCache returns values before TTL expiry', () => {
  const cache = new TtlLruCache();
  cache.set('a', 1, 10);
  assert.equal(cache.get('a', 10_000), 1);
});

test('TtlLruCache expires values after TTL', async () => {
  const cache = new TtlLruCache();
  cache.set('a', 1, 10);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(cache.get('a', 1), undefined);
});

test('TtlLruCache evicts the oldest entry over the max size', () => {
  const cache = new TtlLruCache();
  cache.set('a', 1, 2);
  cache.set('b', 2, 2);
  cache.set('c', 3, 2);
  assert.equal(cache.get('a', 10_000), undefined);
  assert.equal(cache.get('b', 10_000), 2);
  assert.equal(cache.get('c', 10_000), 3);
});

test('ResultCache expires reads by its own capability TTL field', () => {
  // The clock is pinned: a real 5ms sleep can wake past the 10ms TTL under load.
  mock.timers.enable({ now: Date.now() });
  try {
    const cache = new ResultCache('search');
    const settings = { searchCacheTtlMs: 10, searchCacheMaxEntries: 10, fetchCacheTtlMs: 1, fetchCacheMaxEntries: 1 };
    cache.write('a', 1, settings);
    mock.timers.tick(5);
    assert.equal(cache.read('a', settings), 1);
    mock.timers.tick(10);
    assert.equal(cache.read('a', settings), undefined);
  } finally {
    mock.timers.reset();
  }
});

test('ResultCache bounds writes by its own capability capacity field', () => {
  const cache = new ResultCache('fetch');
  const settings = { fetchCacheTtlMs: 10_000, fetchCacheMaxEntries: 2, searchCacheMaxEntries: 10 };
  cache.write('a', 1, settings);
  cache.write('b', 2, settings);
  cache.write('c', 3, settings);
  assert.equal(cache.read('a', settings), undefined);
  assert.equal(cache.read('c', settings), 3);
});

test('ResultCache writes nothing while its capability capacity is below 1', () => {
  const cache = new ResultCache('search');
  const settings = { searchCacheTtlMs: 10_000, searchCacheMaxEntries: 0 };
  cache.write('a', 1, settings);
  assert.equal(cache.read('a', settings), undefined);
});

test('ResultCache rejects a capability with no cache fields', () => {
  assert.throws(() => new ResultCache('realtime'), /unknown cache capability/u);
});
