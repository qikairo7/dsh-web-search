/** Same-origin provider health check used by the settings page. */

import { joinURL, requestJSON } from './http.js';
import { readProviderUsage, recordProviderUsage } from './quotaStore.js';

const MAX_REQUEST_BODY_BYTES = 8_192;
const MAX_TEST_TIMEOUT_MS = 15_000;
const HEALTH_PATH = '/dsh-web-search/health';
const MODELS_PATH = '/dsh-web-search/models';
const QUOTAS_PATH = '/dsh-web-search/quotas';

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

function requestError(message, code = 'WEB_PROVIDER_ERROR') {
  return Object.assign(new Error(message), { code });
}

async function fetchSiliconFlowModels(kind, { settings, resolveKey }) {
  const config = settings().siliconflow;
  if (config?.enabled === false) throw requestError('SiliconFlow is disabled', 'WEB_PROVIDER_UNAVAILABLE');
  const branch = kind === 'rerank' ? 'reranker' : kind === 'embedding' ? 'embedding' : undefined;
  if (branch === undefined) throw requestError('kind must be rerank or embedding', 'bad-request');
  const apiKey = await resolveKey(config?.apiKeyEnv);
  if (apiKey === undefined) throw requestError('SiliconFlow API key is not configured', 'WEB_PROVIDER_UNAVAILABLE');
  const url = `${joinURL(config.baseURL, '/models')}?sub_type=${encodeURIComponent(branch)}`;
  const { data } = await requestJSON(url, {
    headers: { authorization: `Bearer ${apiKey}` },
    timeoutMs: MAX_TEST_TIMEOUT_MS,
    provider: 'SiliconFlow',
    operation: 'models',
  });
  const models = Array.isArray(data?.data)
    ? data.data.map((item) => (typeof item?.id === 'string' ? item.id.trim() : '')).filter((id) => id.length > 0)
    : [];
  return { ok: true, kind, models: [...new Set(models)].sort() };
}

async function fetchProviderQuota(providerId, { settings, resolveKey, providers }) {
  if (providerId === 'keenable') {
    const provider = providers?.keenable;
    if (provider !== undefined && (typeof provider.available !== 'function' || provider.available())) {
      const timeoutMs = Math.min(
        Math.max(Number(settings().requestTimeoutMs) || MAX_TEST_TIMEOUT_MS, 1_000),
        MAX_TEST_TIMEOUT_MS,
      );
      const result = await provider.search(
        { query: 'DeepSeek Harness', maxResults: 1 },
        AbortSignal.timeout(timeoutMs),
      );
      const usage = result?.usage;
      if (usage !== null && typeof usage === 'object') recordProviderUsage(providerId, usage);
      const remaining = Number(usage?.credits_remaining);
      if (Number.isFinite(remaining)) {
        return {
          ok: true,
          providerId,
          remaining,
          at: Date.now(),
          ...(typeof usage?.sku === 'string' ? { sku: usage.sku } : {}),
          ...(typeof usage?.paid === 'boolean' ? { paid: usage.paid } : {}),
        };
      }
    }
    const cached = readProviderUsage(providerId);
    if (cached !== undefined) {
      return { ok: true, providerId, remaining: cached.remaining, at: cached.at, cached: true };
    }
    throw requestError('Keenable has no quota reading yet; run a search first', 'WEB_PROVIDER_UNAVAILABLE');
  }
  const config = settings()[providerId];
  if (config?.enabled === false) throw requestError('Provider is disabled', 'WEB_PROVIDER_UNAVAILABLE');
  const apiKey = await resolveKey(config?.apiKeyEnv);
  if (apiKey === undefined) throw requestError('Provider API key is not configured', 'WEB_PROVIDER_UNAVAILABLE');
  if (providerId === 'tavily') {
    const { data } = await requestJSON(joinURL(config.baseURL, '/usage'), {
      headers: { authorization: `Bearer ${apiKey}` },
      timeoutMs: MAX_TEST_TIMEOUT_MS,
      provider: 'Tavily',
      operation: 'usage',
    });
    const usage = Number(data?.key?.usage);
    const limit = Number(data?.key?.limit);
    const planUsage = Number(data?.account?.plan_usage);
    const planLimit = Number(data?.account?.plan_limit);
    const keyRemaining = Number.isFinite(limit) && limit > 0 && Number.isFinite(usage)
      ? Math.max(0, limit - usage)
      : undefined;
    const planRemaining = Number.isFinite(planLimit) && planLimit > 0 && Number.isFinite(planUsage)
      ? Math.max(0, planLimit - planUsage)
      : undefined;
    return {
      ok: true,
      providerId,
      remaining: planRemaining ?? keyRemaining,
      limit: planLimit > 0 ? planLimit : limit > 0 ? limit : undefined,
      used: planLimit > 0 ? planUsage : usage,
    };
  }
  if (providerId === 'zhihu') {
    const now = Math.floor(Date.now() / 1_000);
    const url = `${joinURL(config.baseURL, '/api/v1/quota')}?APIIDs=${encodeURIComponent('global_search,zhihu_search')}`;
    const { data } = await requestJSON(url, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        'x-request-timestamp': String(now),
      },
      timeoutMs: MAX_TEST_TIMEOUT_MS,
      provider: 'Zhihu',
      operation: 'quota',
    });
    const items = Array.isArray(data?.Data) ? data.Data : [];
    const sum = (key) => items.reduce((total, item) => {
      const value = Number(item?.[key]);
      return Number.isFinite(value) ? total + value : total;
    }, 0);
    return {
      ok: true,
      providerId,
      remaining: items.length > 0 ? sum('RemainingQuota') : undefined,
      limit: items.length > 0 ? sum('TotalQuota') : undefined,
      used: items.length > 0 ? sum('TotalUsed') : undefined,
    };
  }
  if (providerId === 'firecrawl') {
    const { data } = await requestJSON(joinURL(config.baseURL, '/v2/team/credit-usage'), {
      headers: { authorization: `Bearer ${apiKey}` },
      timeoutMs: MAX_TEST_TIMEOUT_MS,
      provider: 'Firecrawl',
      operation: 'usage',
    });
    return {
      ok: true,
      providerId,
      remaining: typeof data?.data?.remainingCredits === 'number' ? data.data.remainingCredits : undefined,
      limit: typeof data?.data?.planCredits === 'number' ? data.data.planCredits : undefined,
    };
  }
  if (providerId === 'siliconflow') {
    // SiliconFlow retired the public /user/info balance API (HTTP 410); the
    // remaining balance is only available in its console.
    throw requestError('SiliconFlow balance is available in the provider console', 'WEB_PROVIDER_UNAVAILABLE');
  }
  throw requestError('This provider does not expose a quota endpoint', 'WEB_PROVIDER_UNAVAILABLE');
}

function parseProviderPayload(req) {
  return readJSON(req);
}

export function registerProviderManagementRoutes(ctx, { settings, resolveKey, providers }) {
  if (typeof ctx?.inject !== 'function') return;
  ctx.inject(['webServer'], (webCtx) => {
    const disposers = [
      webCtx.webServer.register({
        kind: 'exact',
        path: MODELS_PATH,
        async handler(req, res) {
          if (req.method !== 'POST') {
            sendJSON(res, 405, { ok: false, code: 'bad-request', message: 'method must be POST' });
            return;
          }
          if (!sameOrigin(req)) {
            sendJSON(res, 403, { ok: false, code: 'forbidden', message: 'same-origin request required' });
            return;
          }
          try {
            const payload = await parseProviderPayload(req);
            const result = await fetchSiliconFlowModels(payload?.kind, { settings, resolveKey });
            sendJSON(res, 200, result);
          } catch (error) {
            sendJSON(res, 200, {
              ok: false,
              code: typeof error?.code === 'string' ? error.code : 'WEB_PROVIDER_ERROR',
              message: String(error?.message ?? error),
            });
          }
        },
      }),
      webCtx.webServer.register({
        kind: 'exact',
        path: QUOTAS_PATH,
        async handler(req, res) {
          if (req.method !== 'POST') {
            sendJSON(res, 405, { ok: false, code: 'bad-request', message: 'method must be POST' });
            return;
          }
          if (!sameOrigin(req)) {
            sendJSON(res, 403, { ok: false, code: 'forbidden', message: 'same-origin request required' });
            return;
          }
          try {
            const payload = await parseProviderPayload(req);
            const providerIds = Array.isArray(payload?.providerIds) ? payload.providerIds : [];
            const values = {};
            for (const providerId of providerIds) {
              if (typeof providerId !== 'string') continue;
              try {
                values[providerId] = await fetchProviderQuota(providerId, { settings, resolveKey, providers });
              } catch (error) {
                values[providerId] = {
                  ok: false,
                  providerId,
                  code: typeof error?.code === 'string' ? error.code : 'WEB_PROVIDER_ERROR',
                  message: String(error?.message ?? error),
                };
              }
            }
            sendJSON(res, 200, { ok: true, providers: values });
          } catch (error) {
            sendJSON(res, 200, {
              ok: false,
              code: typeof error?.code === 'string' ? error.code : 'WEB_PROVIDER_ERROR',
              message: String(error?.message ?? error),
            });
          }
        },
      }),
    ];
    return () => { for (const dispose of disposers) dispose(); };
  });
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
