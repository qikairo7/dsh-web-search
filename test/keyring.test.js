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

test('multi-key provider rotates on a WEB_RATE_LIMITED seam error', async () => {
  const seen = [];
  const wrapped = createMultiKeyProvider({
    provider: fakeProvider(),
    factory: (key) => ({
      id: 'fake',
      async search() {
        seen.push(key);
        if (key !== 'first') return { sources: [], truncated: false };
        const error = new Error('rate limited');
        error.name = 'WebError';
        error.code = 'WEB_RATE_LIMITED';
        throw error;
      },
    }),
    resolveKeys: async () => ['first', 'second'],
  });
  await wrapped.search({ query: 'q' }, undefined);
  assert.deepEqual(seen, ['first', 'second']);
});

test('multi-key provider rotates on a 401 status', async () => {
  const seen = [];
  const wrapped = createMultiKeyProvider({
    provider: fakeProvider(),
    factory: (key) => ({
      id: 'fake',
      async search() {
        seen.push(key);
        if (key !== 'first') return { sources: [], truncated: false };
        throw Object.assign(new Error('HTTP 401'), { status: 401 });
      },
    }),
    resolveKeys: async () => ['first', 'second'],
  });
  await wrapped.search({ query: 'q' }, undefined);
  assert.deepEqual(seen, ['first', 'second']);
});

test('multi-key provider rotates on a WEB_PROVIDER_CREDENTIAL_MISSING seam error', async () => {
  const seen = [];
  const wrapped = createMultiKeyProvider({
    provider: fakeProvider(),
    factory: (key) => ({
      id: 'fake',
      async search() {
        seen.push(key);
        if (key !== 'first') return { sources: [], truncated: false };
        const error = new Error('credential missing');
        error.name = 'WebError';
        error.code = 'WEB_PROVIDER_CREDENTIAL_MISSING';
        throw error;
      },
    }),
    resolveKeys: async () => ['first', 'second'],
  });
  await wrapped.search({ query: 'q' }, undefined);
  assert.deepEqual(seen, ['first', 'second']);
});

test('multi-key provider does not rotate on a fetch timeout', async () => {
  const seen = [];
  const wrapped = createMultiKeyProvider({
    provider: fakeProvider(),
    factory: (key) => ({
      id: 'fake',
      async search() {
        seen.push(key);
        const error = new Error('timed out');
        error.name = 'WebError';
        error.code = 'WEB_FETCH_TIMEOUT';
        throw error;
      },
    }),
    resolveKeys: async () => ['first', 'second'],
  });
  await assert.rejects(
    () => wrapped.search({ query: 'q' }, undefined),
    (error) => error.code === 'WEB_FETCH_TIMEOUT',
  );
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

// #174: the credentialRef -> ctx.credentials.resolve -> resolved?.value branch was only ever
// exercised through the environment-variable fallback below. A fake ctx pins the resolve hit
// path and the resolve-throw path so deleting either branch turns these red.

test('key resolver returns the value from the injected credentials service', async () => {
  const previous = process.env.DSH_TEST_KEY_RESOLVED;
  delete process.env.DSH_TEST_KEY_RESOLVED;
  try {
    let calls = 0;
    const resolve = createKeyResolver({
      credentials: {
        resolve: async () => { calls += 1; return { value: ' from-service ' }; },
      },
    });
    assert.equal(await resolve('DSH_TEST_KEY_RESOLVED'), 'from-service');
    assert.equal(calls, 1, 'the credentials service must be consulted before any fallback');
  } finally {
    if (previous === undefined) delete process.env.DSH_TEST_KEY_RESOLVED;
    else process.env.DSH_TEST_KEY_RESOLVED = previous;
  }
});

test('key resolver falls back to the environment when credentials.resolve throws', async () => {
  const previous = process.env.DSH_TEST_KEY_THROWS;
  process.env.DSH_TEST_KEY_THROWS = 'env-key';
  try {
    let calls = 0;
    const resolve = createKeyResolver({
      credentials: {
        resolve: async () => { calls += 1; throw new Error('resolver failed'); },
      },
    });
    assert.equal(await resolve('DSH_TEST_KEY_THROWS'), 'env-key');
    assert.equal(calls, 1, 'the throwing resolve must be attempted before the fallback');
  } finally {
    if (previous === undefined) delete process.env.DSH_TEST_KEY_THROWS;
    else process.env.DSH_TEST_KEY_THROWS = previous;
  }
});
