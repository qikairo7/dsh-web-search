import test from 'node:test';
import assert from 'node:assert/strict';

import { createKeyResolver } from '../lib/credentials.js';
import { createMultiKeyProvider } from '../lib/keyring.js';

function fakeProvider() {
  return {
    id: 'fake',
    available: () => true,
    ready: async () => true,
    async search() {
      return { sources: [{ url: 'https://base.example/' }], truncated: false };
    },
  };
}

test('multi-key provider rotates to the next key on quota or rate-limit errors', async () => {
  const seen = [];
  const wrapped = createMultiKeyProvider({
    provider: fakeProvider(),
    factory: (key) => ({
      id: 'fake',
      async search() {
        seen.push(key);
        if (key === 'first') {
          throw Object.assign(new Error('HTTP 402'), { status: 402 });
        }
        return { sources: [{ url: `https://${key}.example/` }], truncated: false };
      },
    }),
    resolveKeys: async () => ['first', 'second'],
  });
  const result = await wrapped.search({ query: 'q' }, undefined);
  assert.deepEqual(seen, ['first', 'second']);
  assert.equal(result.sources[0].url, 'https://second.example/');
});

test('multi-key provider does not rotate on ordinary provider errors', async () => {
  const seen = [];
  const wrapped = createMultiKeyProvider({
    provider: fakeProvider(),
    factory: (key) => ({
      id: 'fake',
      async search() {
        seen.push(key);
        throw new Error('bad response');
      },
    }),
    resolveKeys: async () => ['first', 'second'],
  });
  await assert.rejects(() => wrapped.search({ query: 'q' }, undefined), /bad response/);
  assert.deepEqual(seen, ['first']);
});

test('key resolver reads numbered key references in order', async () => {
  const previous = { base: process.env.DSH_TEST_KEY, second: process.env.DSH_TEST_KEY_2 };
  process.env.DSH_TEST_KEY = 'first';
  process.env.DSH_TEST_KEY_2 = 'second';
  try {
    const resolve = createKeyResolver({});
    assert.deepEqual(await resolve.all('DSH_TEST_KEY'), ['first', 'second']);
  } finally {
    if (previous.base === undefined) delete process.env.DSH_TEST_KEY;
    else process.env.DSH_TEST_KEY = previous.base;
    if (previous.second === undefined) delete process.env.DSH_TEST_KEY_2;
    else process.env.DSH_TEST_KEY_2 = previous.second;
  }
});
