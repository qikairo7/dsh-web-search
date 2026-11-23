import test from 'node:test';
import assert from 'node:assert/strict';

import { registerProviderManagementRoutes, registerSearchHealthRoute } from '../lib/health.js';

const HOST = '127.0.0.1:8195';
const AUTH_COOKIE = 'session-token=valid';

/**
 * Minimal stand-in for the DSH Host Connection trust fence
 * (`connection.requestRejection`).
 *
 * Real trust lives in DSH: `isTrustedApiRequest` applies the Host/Origin fence
 * and `browserAuth` verifies the signed, authority-named cookie the desktop
 * forwarder carries. Reproducing that crypto in this test would only exercise
 * the stub, so this models the *contract* the plugin depends on:
 *   - reject (403) when the Origin does not match Host, or the call is cross-site;
 *   - reject (401) when the browser credential (cookie) is missing;
 *   - admit (undefined) when both the fence and the credential pass.
 * The tests below pin only that the plugin delegates to this fence and maps any
 * rejection to a 403 — never that it re-implements DSH cookie validation.
 */
function connectionStub() {
  const stub = {
    calls: 0,
    requestRejection(request) {
      stub.calls += 1;
      const headers = request?.headers ?? {};
      if (typeof headers.host !== 'string' || headers.host.length === 0) return 403;
      if (headers['sec-fetch-site'] === 'cross-site') return 403;
      const origin = headers.origin;
      if (typeof origin === 'string' && origin.length > 0) {
        try {
          if (new URL(origin).host !== headers.host) return 403;
        } catch {
          return 403;
        }
      }
      const cookie = typeof headers.cookie === 'string' ? headers.cookie : '';
      return cookie.split(';').some((segment) => segment.trim() === AUTH_COOKIE) ? undefined : 401;
    },
  };
  return stub;
}

function captureCtx({ connection, routes }) {
  return {
    inject(names, callback) {
      assert.deepEqual(names, ['webServer']);
      callback({
        webServer: {
          register(route) {
            routes.push(route);
            return () => {};
          },
        },
        get(name) {
          return name === 'connection' ? connection : undefined;
        },
      });
    },
  };
}

function healthRoute({ connection } = {}) {
  const routes = [];
  registerSearchHealthRoute(captureCtx({ connection, routes }), {
    providers: {
      keenable: {
        available: () => true,
        ready: async () => true,
        search: async () => ({ sources: [{ url: 'https://example.com/' }], truncated: false }),
      },
    },
    settings: () => ({ requestTimeoutMs: 5_000 }),
  });
  assert.equal(routes.length, 1);
  return routes[0];
}

function managementRoutes({ connection } = {}) {
  const routes = [];
  registerProviderManagementRoutes(captureCtx({ connection, routes }), {
    settings: () => ({
      siliconflow: { enabled: true, apiKeyEnv: 'SILICONFLOW_API_KEY', baseURL: 'https://api.siliconflow.cn/v1' },
    }),
    resolveKey: async () => undefined,
  });
  return routes;
}

/** A same-origin browser request: matching Origin/Sec-Fetch-Site by default. */
function request(body, headers = {}) {
  return {
    method: 'POST',
    headers: { host: HOST, 'sec-fetch-site': 'same-origin', ...headers },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body ?? {}));
    },
  };
}

/** The desktop forwarder shape: no Origin, no Sec-Fetch-Site. */
function strippedRequest(body, headers = {}) {
  return {
    method: 'POST',
    headers: { host: HOST, ...headers },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body ?? {}));
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

// --- Fallback path: no Connection service mounted (plain browser only) -------

test('health route registers and returns a real provider result', async () => {
  const route = healthRoute();
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
  const route = healthRoute();
  const res = response();
  await route.handler(request({ providerId: 'keenable', capability: 'search' }, { origin: 'https://evil.example' }), res);
  assert.equal(res.status, 403);
});

function healthRouteWithX({ connection, verifyX } = {}) {
  const routes = [];
  registerSearchHealthRoute(captureCtx({ connection, routes }), {
    providers: {
      keenable: {
        available: () => true,
        ready: async () => true,
        search: async () => ({ sources: [{ url: 'https://example.com/' }], truncated: false }),
      },
    },
    settings: () => ({ requestTimeoutMs: 5_000 }),
    verifyX,
  });
  assert.equal(routes.length, 1);
  return routes[0];
}

test('health route routes x provider through verifyX without touching providers', async () => {
  const route = healthRouteWithX({ verifyX: async () => ({ ok: true, capability: 'search', latencyMs: 42, count: 1 }) });
  const res = response();
  await route.handler(request({ providerId: 'x', capability: 'search' }), res);
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.providerId, 'x');
  assert.equal(body.count, 1);
});

test('health route reports x verification as unavailable when verifyX is absent', async () => {
  const route = healthRouteWithX();
  const res = response();
  await route.handler(request({ providerId: 'x', capability: 'search' }), res);
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, false);
  assert.equal(body.code, 'WEB_PROVIDER_UNAVAILABLE');
});

test('health route rejects unknown providers without throwing', async () => {
  const route = healthRoute();
  const res = response();
  await route.handler(request({ providerId: 'missing', capability: 'search' }), res);
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, false);
  assert.equal(body.code, 'WEB_PROVIDER_UNAVAILABLE');
});

test('provider management routes register model and quota endpoints', () => {
  const routes = managementRoutes();
  assert.deepEqual(routes.map((route) => route.path), ['/dsh-web-search/models', '/dsh-web-search/quotas']);
});

// --- Trust matrix with the Host Connection fence mounted ---------------------
//
// The security contract: a matching Origin and a valid credential pass; a
// mismatched Origin or a cross-site marker is refused; the stripped desktop
// request passes only because it carries a valid credential; and a request with
// no browser markers and no credential is refused. (The plugin normalizes every
// rejection to 403, matching the route's pre-existing forbidden contract.)

test('trust matrix: matching Origin plus a valid credential is admitted', async () => {
  const connection = connectionStub();
  const route = healthRoute({ connection });
  const res = response();
  await route.handler(request(
    { providerId: 'keenable', capability: 'search' },
    { origin: `http://${HOST}`, cookie: AUTH_COOKIE },
  ), res);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.body).ok, true);
  assert.equal(connection.calls, 1);
});

test('trust matrix: mismatched Origin is rejected even with a valid credential', async () => {
  const connection = connectionStub();
  const route = healthRoute({ connection });
  const res = response();
  await route.handler(request(
    { providerId: 'keenable', capability: 'search' },
    { origin: 'https://evil.example', cookie: AUTH_COOKIE },
  ), res);
  assert.equal(res.status, 403);
});

test('trust matrix: stripped headers plus a valid Host credential is admitted', async () => {
  const connection = connectionStub();
  const route = healthRoute({ connection });
  const res = response();
  await route.handler(strippedRequest(
    { providerId: 'keenable', capability: 'search' },
    { cookie: AUTH_COOKIE },
  ), res);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.body).ok, true);
  assert.equal(connection.calls, 1);
});

test('trust matrix: no browser markers and no credential is rejected', async () => {
  const connection = connectionStub();
  const route = healthRoute({ connection });
  const res = response();
  await route.handler(strippedRequest({ providerId: 'keenable', capability: 'search' }), res);
  assert.equal(res.status, 403);
});

test('trust matrix: cross-site marker rejected even with a valid credential', async () => {
  const connection = connectionStub();
  const route = healthRoute({ connection });
  const res = response();
  await route.handler(request(
    { providerId: 'keenable', capability: 'search' },
    { 'sec-fetch-site': 'cross-site', cookie: AUTH_COOKIE },
  ), res);
  assert.equal(res.status, 403);
});

// --- Fallback (no Connection service) stays closed for stripped requests -----

test('fallback without Connection: stripped headers are still rejected', async () => {
  const route = healthRoute();
  const res = response();
  await route.handler(strippedRequest({ providerId: 'keenable', capability: 'search' }), res);
  assert.equal(res.status, 403);
});

// --- Capability probe: present Connection service without requestRejection -----
//
// A supported host may ship a Connection service that no longer exposes
// requestRejection. isTrustedRequest must then fall back to sameOrigin and stay
// closed for a stripped request while still admitting a plain same-origin browser.

test('fallback when the Connection service lacks requestRejection admits a same-origin browser', async () => {
  const route = healthRoute({ connection: {} });
  const res = response();
  await route.handler(request({ providerId: 'keenable', capability: 'search' }), res);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.body).ok, true);
});

test('fallback when the Connection service lacks requestRejection rejects a stripped request', async () => {
  const route = healthRoute({ connection: {} });
  const res = response();
  await route.handler(strippedRequest({ providerId: 'keenable', capability: 'search' }), res);
  assert.equal(res.status, 403);
});

// --- The other two management routes apply the same fence -------------------

test('models and quotas reject an unauthenticated stripped request', async () => {
  const connection = connectionStub();
  const [models, quotas] = managementRoutes({ connection });
  for (const route of [models, quotas]) {
    const res = response();
    await route.handler(strippedRequest({ kind: 'rerank', providerIds: ['keenable'] }), res);
    assert.equal(res.status, 403);
  }
});

test('models admits the stripped desktop shape and reaches the handler', async () => {
  const connection = connectionStub();
  const [models] = managementRoutes({ connection });
  const res = response();
  await models.handler(strippedRequest({ kind: 'rerank' }, { cookie: AUTH_COOKIE }), res);
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  // Reached the handler: fails on the missing key, not on the trust fence.
  assert.equal(body.ok, false);
  assert.equal(body.code, 'WEB_PROVIDER_UNAVAILABLE');
});
