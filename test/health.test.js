import test from 'node:test';
import assert from 'node:assert/strict';

import { registerProviderManagementRoutes, registerSearchHealthRoute } from '../lib/health.js';

function fakeServer() {
  let route;
  const ctx = {
    inject(names, callback) {
      assert.deepEqual(names, ['webServer']);
      callback({
        webServer: {
          register(value) {
            route = value;
            return () => {};
          },
        },
      });
    },
  };
  registerSearchHealthRoute(ctx, {
    providers: {
      keenable: {
        available: () => true,
        ready: async () => true,
        search: async () => ({ sources: [{ url: 'https://example.com/' }], truncated: false }),
      },
    },
    settings: () => ({ requestTimeoutMs: 5_000 }),
  });
  return route;
}

function request(body, headers = {}) {
  return {
    method: 'POST',
    headers: { host: '127.0.0.1:8195', 'sec-fetch-site': 'same-origin', ...headers },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body));
    },
  };
}

function response() {
  let status;
  let body = '';
  return {
    get status() { return status; },
    get body() { return body; },
    writeHead(value) { status = value; },
    end(value) { body = value ?? ''; },
  };
}

test('health route registers and returns a real provider result', async () => {
  const route = fakeServer();
  assert.equal(route.kind, 'exact');
  assert.equal(route.path, '/dsh-web-search/health');
  const res = response();
  await route.handler(request({ providerId: 'keenable', capability: 'search' }), res);
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.count, 1);
  assert.equal(body.providerId, 'keenable');
});

test('health route rejects cross-origin requests', async () => {
  const route = fakeServer();
  const res = response();
  await route.handler(request({ providerId: 'keenable', capability: 'search' }, { origin: 'https://evil.example' }), res);
  assert.equal(res.status, 403);
});

test('health route rejects unknown providers without throwing', async () => {
  const route = fakeServer();
  const res = response();
  await route.handler(request({ providerId: 'missing', capability: 'search' }), res);
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, false);
  assert.equal(body.code, 'WEB_PROVIDER_UNAVAILABLE');
});

test('provider management routes register model and quota endpoints', () => {
  const routes = [];
  const ctx = {
    inject(names, callback) {
      assert.deepEqual(names, ['webServer']);
      callback({
        webServer: {
          register(route) {
            routes.push(route);
            return () => {};
          },
        },
      });
    },
  };
  registerProviderManagementRoutes(ctx, {
    settings: () => ({
      siliconflow: { enabled: true, apiKeyEnv: 'SILICONFLOW_API_KEY', baseURL: 'https://api.siliconflow.cn/v1' },
    }),
    resolveKey: async () => 'key',
  });
  assert.deepEqual(routes.map((route) => route.path), ['/dsh-web-search/models', '/dsh-web-search/quotas']);
});
