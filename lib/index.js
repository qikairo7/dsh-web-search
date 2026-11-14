/** DSH web search router: standard-id providers plus an auto fallback router. */

import z from '@deepseek-ai/schemastery';
import { WebError } from '@deepseek-ai/dsh-web';

import { setWebErrorClass } from './errors.js';
import { createKeyResolver } from './credentials.js';
import { DEFAULT_SETTINGS, resolveSettings } from './settings.js';
import { AnySearchProvider } from './providers/anysearch.js';
import { TavilyProvider } from './providers/tavily.js';
import { FirecrawlProvider } from './providers/firecrawl.js';
import { ZhihuProvider, ZhihuSiteProvider } from './providers/zhihu.js';
import { AihotProvider } from './providers/aihot.js';
import { HttpFetchProvider } from './providers/http.js';
import { AutoFetchProvider, AutoSearchProvider } from './providers/router.js';
import { SiliconFlowReranker } from './rerank.js';
import { SiliconFlowEmbeddings } from './embeddings.js';

/** Cordis plugin name used in loader diagnostics. */
export const name = 'web-search-router';

/** The web capability seam and credential store are hard dependencies. */
export const inject = ['web', 'credentials'];

/**
 * Wrap one field schema as volatile when the installed schemastery supports it,
 * so DSH 0.2.x can update saved settings in place without remounting the plugin.
 */
function maybeVolatile(schema) {
  return typeof schema.volatile === 'function' ? schema.volatile() : schema;
}

/** Live plugin configuration schema. */
export const Config = z.object({
  searchMode: maybeVolatile(z.union(['fast', 'quality']).default(DEFAULT_SETTINGS.searchMode)),
  fetchMode: maybeVolatile(z.union(['fast', 'clean']).default(DEFAULT_SETTINGS.fetchMode)),
  intentRouting: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.intentRouting)),
  languageRouting: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.languageRouting)),
  officialDocsEnabled: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.officialDocsEnabled)),
  chineseSearchOrder: maybeVolatile(z.string().default(DEFAULT_SETTINGS.chineseSearchOrder.join(','))),
  defaultSearchOrder: maybeVolatile(z.string().default(DEFAULT_SETTINGS.defaultSearchOrder.join(','))),
  fetchOrder: maybeVolatile(z.string().default(DEFAULT_SETTINGS.fetchOrder.join(','))),
  cleanFetchOrder: maybeVolatile(z.string().default(DEFAULT_SETTINGS.cleanFetchOrder.join(','))),

  anysearchEnabled: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.anysearch.enabled)),
  anysearchApiKeyEnv: maybeVolatile(z.string().role('credential-ref').default(DEFAULT_SETTINGS.anysearch.apiKeyEnv)),
  anysearchBaseURL: maybeVolatile(z.string().default(DEFAULT_SETTINGS.anysearch.baseURL)),

  tavilyEnabled: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.tavily.enabled)),
  tavilyApiKeyEnv: maybeVolatile(z.string().role('credential-ref').default(DEFAULT_SETTINGS.tavily.apiKeyEnv)),
  tavilyBaseURL: maybeVolatile(z.string().default(DEFAULT_SETTINGS.tavily.baseURL)),
  tavilyIncludeAnswer: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.tavily.includeAnswer)),

  firecrawlEnabled: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.firecrawl.enabled)),
  firecrawlApiKeyEnv: maybeVolatile(z.string().role('credential-ref').default(DEFAULT_SETTINGS.firecrawl.apiKeyEnv)),
  firecrawlBaseURL: maybeVolatile(z.string().default(DEFAULT_SETTINGS.firecrawl.baseURL)),

  zhihuEnabled: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.zhihu.enabled)),
  zhihuApiKeyEnv: maybeVolatile(z.string().role('credential-ref').default(DEFAULT_SETTINGS.zhihu.apiKeyEnv)),
  zhihuBaseURL: maybeVolatile(z.string().default(DEFAULT_SETTINGS.zhihu.baseURL)),
  zhihuIncludeMetadata: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.zhihu.includeMetadata)),

  httpEnabled: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.http.enabled)),
  aihotEnabled: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.aihot.enabled)),
  aihotBaseURL: maybeVolatile(z.string().default(DEFAULT_SETTINGS.aihot.baseURL)),
  siliconflowEnabled: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.siliconflow.enabled)),
  siliconflowApiKeyEnv: maybeVolatile(z.string().role('credential-ref').default(DEFAULT_SETTINGS.siliconflow.apiKeyEnv)),
  siliconflowBaseURL: maybeVolatile(z.string().default(DEFAULT_SETTINGS.siliconflow.baseURL)),
  siliconflowRerankModel: maybeVolatile(z.string().default(DEFAULT_SETTINGS.siliconflow.model)),
  siliconflowEmbeddingsEnabled: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.siliconflow.embeddingsEnabled)),
  siliconflowEmbeddingModel: maybeVolatile(z.string().default(DEFAULT_SETTINGS.siliconflow.embeddingModel)),
  semanticDedupThreshold: maybeVolatile(z.number().min(0).max(1).default(DEFAULT_SETTINGS.semanticDedupThreshold)),
  enrichEnabled: maybeVolatile(z.boolean().default(DEFAULT_SETTINGS.enrichEnabled)),
  enrichTopN: maybeVolatile(z.number().step(1).min(0).max(10).default(DEFAULT_SETTINGS.enrichTopN)),
  enrichSummaryMinChars: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.enrichSummaryMinChars)),
  enrichSummaryMaxChars: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.enrichSummaryMaxChars)),
  requestTimeoutMs: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.requestTimeoutMs)),
  maxFetchChars: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.maxFetchChars)),
  maxSnippetChars: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.maxSnippetChars)),
  minDirectHtmlChars: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.minDirectHtmlChars)),
  searchCacheTtlMs: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.searchCacheTtlMs)),
  searchCacheMaxEntries: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.searchCacheMaxEntries)),
  fetchCacheTtlMs: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.fetchCacheTtlMs)),
  fetchCacheMaxEntries: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.fetchCacheMaxEntries)),
  breakerFailureThreshold: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.breakerFailureThreshold)),
  breakerCooldownMs: maybeVolatile(z.number().step(1).min(1).default(DEFAULT_SETTINGS.breakerCooldownMs)),
});

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
    tavily: new TavilyProvider({ settings, resolveKey }),
    firecrawl: new FirecrawlProvider({ settings, resolveKey }),
    zhihu: new ZhihuProvider({ settings, resolveKey }),
    'zhihu-site': new ZhihuSiteProvider({ settings, resolveKey }),
    aihot: new AihotProvider({ settings }),
    http: new HttpFetchProvider({ settings }),
  };

  for (const name of ['anysearch', 'tavily', 'firecrawl', 'zhihu', 'zhihu-site', 'aihot']) {
    ctx.web.registerSearchProvider(providers[name]);
  }
  for (const name of ['anysearch', 'tavily', 'firecrawl', 'http']) {
    ctx.web.registerFetchProvider(providers[name]);
  }

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
