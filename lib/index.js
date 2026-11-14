/** DSH web search router: standard-id providers plus an auto fallback router. */

import z from '@deepseek-ai/schemastery';
import { WebError } from '@deepseek-ai/dsh-web';

import { setWebErrorClass } from './errors.js';
import { createKeyResolver } from './credentials.js';
import { resolveSettings } from './settings.js';
import { AnySearchProvider } from './providers/anysearch.js';
import { TavilyProvider } from './providers/tavily.js';
import { FirecrawlProvider } from './providers/firecrawl.js';
import { ZhihuProvider, ZhihuSiteProvider } from './providers/zhihu.js';
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
  searchMode: maybeVolatile(z.union(['fast', 'quality']).default('quality')),
  fetchMode: maybeVolatile(z.union(['fast', 'clean']).default('fast')),
  intentRouting: maybeVolatile(z.boolean().default(true)),
  chineseSearchOrder: maybeVolatile(z.string().default('zhihu,anysearch,tavily,firecrawl')),
  defaultSearchOrder: maybeVolatile(z.string().default('anysearch,tavily,zhihu,firecrawl')),
  fetchOrder: maybeVolatile(z.string().default('http,tavily,firecrawl,anysearch')),
  cleanFetchOrder: maybeVolatile(z.string().default('tavily,firecrawl,http,anysearch')),

  anysearchEnabled: maybeVolatile(z.boolean().default(true)),
  anysearchApiKeyEnv: maybeVolatile(z.string().role('credential-ref').default('ANYSEARCH_API_KEY')),
  anysearchBaseURL: maybeVolatile(z.string().default('https://api.anysearch.com')),

  tavilyEnabled: maybeVolatile(z.boolean().default(true)),
  tavilyApiKeyEnv: maybeVolatile(z.string().role('credential-ref').default('TAVILY_API_KEY')),
  tavilyBaseURL: maybeVolatile(z.string().default('https://api.tavily.com')),
  tavilyIncludeAnswer: maybeVolatile(z.boolean().default(true)),

  firecrawlEnabled: maybeVolatile(z.boolean().default(true)),
  firecrawlApiKeyEnv: maybeVolatile(z.string().role('credential-ref').default('FIRECRAWL_API_KEY')),
  firecrawlBaseURL: maybeVolatile(z.string().default('https://api.firecrawl.dev')),

  zhihuEnabled: maybeVolatile(z.boolean().default(true)),
  zhihuApiKeyEnv: maybeVolatile(z.string().role('credential-ref').default('ZHIHU_API_KEY')),
  zhihuBaseURL: maybeVolatile(z.string().default('https://developer.zhihu.com')),
  zhihuIncludeMetadata: maybeVolatile(z.boolean().default(true)),

  httpEnabled: maybeVolatile(z.boolean().default(true)),
  siliconflowEnabled: maybeVolatile(z.boolean().default(true)),
  siliconflowApiKeyEnv: maybeVolatile(z.string().role('credential-ref').default('SILICONFLOW_API_KEY')),
  siliconflowBaseURL: maybeVolatile(z.string().default('https://api.siliconflow.cn/v1')),
  siliconflowRerankModel: maybeVolatile(z.string().default('BAAI/bge-reranker-v2-m3')),
  siliconflowEmbeddingsEnabled: maybeVolatile(z.boolean().default(true)),
  siliconflowEmbeddingModel: maybeVolatile(z.string().default('BAAI/bge-m3')),
  semanticDedupThreshold: maybeVolatile(z.number().min(0).max(1).default(0.95)),
  requestTimeoutMs: maybeVolatile(z.number().step(1).min(1).default(30_000)),
  maxFetchChars: maybeVolatile(z.number().step(1).min(1).default(200_000)),
  maxSnippetChars: maybeVolatile(z.number().step(1).min(1).default(800)),
  minDirectHtmlChars: maybeVolatile(z.number().step(1).min(1).default(2_048)),
  searchCacheTtlMs: maybeVolatile(z.number().step(1).min(1).default(300_000)),
  searchCacheMaxEntries: maybeVolatile(z.number().step(1).min(1).default(200)),
  fetchCacheTtlMs: maybeVolatile(z.number().step(1).min(1).default(600_000)),
  fetchCacheMaxEntries: maybeVolatile(z.number().step(1).min(1).default(100)),
  breakerFailureThreshold: maybeVolatile(z.number().step(1).min(1).default(3)),
  breakerCooldownMs: maybeVolatile(z.number().step(1).min(1).default(300_000)),
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
    http: new HttpFetchProvider({ settings }),
  };

  for (const name of ['anysearch', 'tavily', 'firecrawl', 'zhihu', 'zhihu-site']) {
    ctx.web.registerSearchProvider(providers[name]);
  }
  for (const name of ['anysearch', 'tavily', 'firecrawl', 'http']) {
    ctx.web.registerFetchProvider(providers[name]);
  }

  const reranker = new SiliconFlowReranker({ settings, resolveKey });
  const embeddings = new SiliconFlowEmbeddings({ settings, resolveKey });
  ctx.web.registerSearchProvider(
    new AutoSearchProvider({ settings, providers, reranker, embeddings }),
  );
  ctx.web.registerFetchProvider(new AutoFetchProvider({ settings, providers }));
}
