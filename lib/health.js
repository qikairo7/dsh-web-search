/** Same-origin provider health check used by the settings page. */

const MAX_REQUEST_BODY_BYTES = 8_192;
const MAX_TEST_TIMEOUT_MS = 15_000;
const HEALTH_PATH = '/dsh-web-search/health';

function sendJSON(res, status, value) {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(value));
}

function sameOrigin(req) {
  const host = req.headers.host;
  if (typeof host !== 'string' || host.length === 0) return false;
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = req.headers['sec-fetch-site'];
  return site === 'same-origin' || site === 'none';
}

async function readJSON(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_REQUEST_BODY_BYTES) {
      throw Object.assign(new Error('request body is too large'), { code: 'bad-request' });
    }
  }
  if (body.length === 0) throw Object.assign(new Error('request body is empty'), { code: 'bad-request' });
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error('request body is not valid JSON'), { code: 'bad-request' });
  }
}

async function runTest(provider, capability, settings) {
  if (provider === undefined) {
    throw Object.assign(new Error('unknown provider'), { code: 'WEB_PROVIDER_UNAVAILABLE' });
  }
  if (typeof provider.available === 'function' && !provider.available()) {
    throw Object.assign(new Error('provider is disabled'), { code: 'WEB_PROVIDER_UNAVAILABLE' });
  }
  if (typeof provider.ready === 'function' && !(await provider.ready())) {
    throw Object.assign(new Error('provider credential is not configured'), { code: 'WEB_PROVIDER_UNAVAILABLE' });
  }
  const timeoutMs = Math.min(
    Math.max(Number(settings().requestTimeoutMs) || MAX_TEST_TIMEOUT_MS, 1_000),
    MAX_TEST_TIMEOUT_MS,
  );
  const signal = AbortSignal.timeout(timeoutMs);
  const startedAt = Date.now();
  if (capability === 'search') {
    if (typeof provider.search !== 'function') {
      throw Object.assign(new Error('provider does not support search'), { code: 'WEB_PROVIDER_UNAVAILABLE' });
    }
    const result = await provider.search({ query: 'DeepSeek Harness', maxResults: 1 }, signal);
    return {
      ok: true,
      capability,
      latencyMs: Date.now() - startedAt,
      count: Array.isArray(result?.sources) ? result.sources.length : 0,
    };
  }
  if (capability === 'fetch') {
    if (typeof provider.fetch !== 'function') {
      throw Object.assign(new Error('provider does not support fetch'), { code: 'WEB_PROVIDER_UNAVAILABLE' });
    }
    const result = await provider.fetch({ url: 'https://example.com/', maxFetchChars: 2_000 }, signal);
    return {
      ok: true,
      capability,
      latencyMs: Date.now() - startedAt,
      statusCode: result?.statusCode ?? 0,
    };
  }
  throw Object.assign(new Error('capability must be search or fetch'), { code: 'bad-request' });
}

/**
 * Register the optional same-origin health route. The route is only mounted in
 * profiles that provide a Web Server; desktop and headless profiles keep
 * loading without it.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ providers: Record<string, object>, settings: () => object }} options
 */
export function registerSearchHealthRoute(ctx, { providers, settings }) {
  if (typeof ctx?.inject !== 'function') return;
  ctx.inject(['webServer'], (webCtx) => {
    const dispose = webCtx.webServer.register({
      kind: 'exact',
      path: HEALTH_PATH,
      async handler(req, res) {
        if (req.method !== 'POST') {
          sendJSON(res, 405, { ok: false, code: 'bad-request', message: 'method must be POST' });
          return;
        }
        if (!sameOrigin(req)) {
          sendJSON(res, 403, { ok: false, code: 'forbidden', message: 'same-origin request required' });
          return;
        }
        let payload;
        try {
          payload = await readJSON(req);
        } catch (error) {
          sendJSON(res, 400, { ok: false, code: 'bad-request', message: String(error.message ?? error) });
          return;
        }
        const providerId = typeof payload?.providerId === 'string' ? payload.providerId : '';
        if (providerId.length === 0) {
          sendJSON(res, 400, { ok: false, code: 'bad-request', message: 'providerId is required' });
          return;
        }
        try {
          const result = await runTest(providers[providerId], payload.capability, settings);
          sendJSON(res, 200, { ...result, providerId });
        } catch (error) {
          sendJSON(res, 200, {
            ok: false,
            providerId,
            code: typeof error?.code === 'string' ? error.code : 'WEB_PROVIDER_ERROR',
            message: String(error?.message ?? error),
          });
        }
      },
    });
    return dispose;
  });
}
