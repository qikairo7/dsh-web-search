/** DSH web search router: standard-id providers plus an auto fallback router. */

import z from '@deepseek-ai/schemastery';
import { WebError } from '@deepseek-ai/dsh-web';

import { setWebErrorClass } from './errors.js';
import { createKeyResolver } from './credentials.js';
import { providersWithCapability } from './catalog.js';
import { SETTINGS_SPEC, resolveSettings, settingDefault } from './settings.js';
import { AnySearchProvider } from './providers/anysearch.js';
import { KeenableProvider } from './providers/keenable.js';
import { ExaProvider } from './providers/exa.js';
import { AnySearchClient } from './providers/anysearchClient.js';
import { TavilyProvider } from './providers/tavily.js';
import { FirecrawlProvider } from './providers/firecrawl.js';
import { ZhihuProvider, ZhihuSiteProvider } from './providers/zhihu.js';
import { AihotProvider } from './providers/aihot.js';
import { HttpFetchProvider } from './providers/http.js';
import { AutoFetchProvider, AutoSearchProvider } from './providers/router.js';
import { SiliconFlowReranker } from './rerank.js';
import { SiliconFlowEmbeddings } from './embeddings.js';
import { registerAnySearchTools, registerTavilyTools, registerAihotToolset } from './tools/index.js';

/** Cordis plugin name used in loader diagnostics. */
export const name = 'web-search-router';

/** The web capability seam and credential store are hard dependencies. */
export const inject = ['web', 'credentials', 'tools'];

/**
 * Wrap one field schema as volatile when the installed schemastery supports it,
 * so DSH 0.2.x can update saved settings in place without remounting the plugin.
 */
function maybeVolatile(schema) {
  return typeof schema.volatile === 'function' ? schema.volatile() : schema;
}

/** Build one schemastery field from a settings spec entry. */
function configField(spec) {
  const fallback = settingDefault(spec);
  switch (spec.kind) {
    case 'enum':
      return z.union(spec.values).default(fallback);
    case 'boolean':
      return z.boolean().default(fallback);
    case 'order':
      return z.string().default(fallback.join(','));
    case 'string': {
      const schema = spec.role === undefined ? z.string() : z.string().role(spec.role);
      return schema.default(fallback);
    }
    case 'number': {
      let schema = z.number();
      if (spec.step !== undefined) schema = schema.step(spec.step);
      if (spec.min !== undefined) schema = schema.min(spec.min);
      if (spec.max !== undefined) schema = schema.max(spec.max);
      return schema.default(fallback);
    }
    default:
      throw new TypeError(`unknown setting kind: ${spec.kind}`);
  }
}

/** Live plugin configuration schema. */
export const Config = z.object(
  Object.fromEntries(SETTINGS_SPEC.map((spec) => [spec.key, maybeVolatile(configField(spec))])),
);

/**
 * Register every individual provider plus the auto router.
 *
 * The ids are the standard backend names because this bundle is the
 * replacement for the paid official providers; the profile must not also
 * mount another provider that uses the same id.
 */
export function apply(ctx, config) {
  setWebErrorClass(WebError);

  const settings = () => resolveSettings(config);
  const resolveKey = createKeyResolver(ctx);
  const providers = {
    anysearch: new AnySearchProvider({ settings, resolveKey }),
    keenable: new KeenableProvider({ settings, resolveKey }),
    exa: new ExaProvider({ settings, resolveKey }),
    tavily: new TavilyProvider({ settings, resolveKey }),
    firecrawl: new FirecrawlProvider({ settings, resolveKey }),
    zhihu: new ZhihuProvider({ settings, resolveKey }),
    'zhihu-site': new ZhihuSiteProvider({ settings, resolveKey }),
    aihot: new AihotProvider({ settings }),
    http: new HttpFetchProvider({ settings }),
  };

  for (const name of providersWithCapability('search')) {
    ctx.web.registerSearchProvider(providers[name]);
  }
  for (const name of providersWithCapability('fetch')) {
    ctx.web.registerFetchProvider(providers[name]);
  }

  registerAnySearchTools(ctx, {
    getClient: () => {
      const current = settings();
      return new AnySearchClient({
        baseURL: current.anysearch.baseURL,
        apiKeyReference: current.anysearch.apiKeyEnv,
        timeoutMs: current.requestTimeoutMs,
        resolveApiKey: () => resolveKey(current.anysearch.apiKeyEnv),
      });
    },
    getMaxRenderedContentChars: () => settings().anysearch.maxRenderedContentChars,
  });

  registerTavilyTools(ctx, providers.tavily);
  registerAihotToolset(ctx, providers.aihot);

  const reranker = new SiliconFlowReranker({ settings, resolveKey });
  const embeddings = new SiliconFlowEmbeddings({ settings, resolveKey });
  const autoFetch = new AutoFetchProvider({ settings, providers });
  const enrichmentFetch = new AutoFetchProvider({
    settings: () => ({ ...settings(), fetchMode: 'fast' }),
    providers,
  });
  ctx.web.registerSearchProvider(
    new AutoSearchProvider({ settings, providers, reranker, embeddings, fetcher: enrichmentFetch }),
  );
  ctx.web.registerFetchProvider(autoFetch);
}
