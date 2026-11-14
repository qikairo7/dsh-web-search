import test from 'node:test';
import assert from 'node:assert/strict';

import { TtlLruCache } from '../lib/cache.js';

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
