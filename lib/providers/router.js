/** Ordered fallback router with mode dispatch, routing annotation, and cache. */

import { webError } from '../errors.js';
import { ProviderRunner } from '../providerRunner.js';
import { TtlLruCache } from '../cache.js';
import { classifyIntent, fastOrder } from '../intent.js';
import { parseQuerySyntax } from '../query.js';
import { detectLanguage } from '../language.js';
import { QualityEngine } from '../quality.js';
import { fetchCacheKey, searchCacheKey } from '../cacheKey.js';
import { realtimeSearch } from '../realtime.js';

/**
 * Resolve the routing facts once per search so adapters only translate them.
 *
 * `language` is the final provider language hint: the `lang:` operator's
 * first value wins, otherwise the detected language when language routing
 * is enabled, otherwise undefined.
 */
function routingFacts(query, settings, intent) {
  const syntax = parseQuerySyntax(query);
  const language =
    syntax.lang !== undefined
      ? syntax.lang.split(',')[0]
      : settings.languageRouting !== false
        ? detectLanguage(query)
        : undefined;
  return { intent, language, syntax };
}

/** Fallback search provider. */
export class AutoSearchProvider {
  constructor({ settings, providers, reranker, embeddings, fetcher }) {
    this.settings = settings;
    this.providers = providers;
    this.cache = new TtlLruCache();
    this.runner = new ProviderRunner({ settings, providers });
    this.engine = new QualityEngine({ settings, providers, runner: this.runner, reranker, embeddings, fetcher });
  }

  get id() {
    return 'auto';
  }

  get title() {
    return '自动路由';
  }

  get description() {
    return {
      en: 'Quality mode queries three providers and reranks with BGE; fast mode uses one provider with fallback.',
      zh: '质量模式查询三家后端并用 BGE 重排；快速模式单后端优先并自动回退。',
    };
  }

  available() {
    return this.runner.available('search');
  }

  async ready() {
    return this.runner.ready('search');
  }

  async search(request, signal) {
    if (signal?.aborted === true) throw webError('Web search aborted', 'WEB_ABORTED', { cause: signal.reason });
    const settings = this.settings();
    const mode = settings.searchMode ?? 'fast';
    const intent = classifyIntent(request.query);
    const routed = { ...request, routing: routingFacts(request.query, settings, intent) };
    const cacheKey = searchCacheKey(settings, request);
    const cached = this.cache.get(cacheKey, settings.searchCacheTtlMs);
    if (cached !== undefined) return cached;

    const realtime = await realtimeSearch(request.query, settings, signal);
    if (realtime !== undefined) {
      this.cache.set(cacheKey, realtime, settings.searchCacheMaxEntries);
      return realtime;
    }

    let result;
    if (mode === 'quality') {
      result = await this.engine.search(routed, signal);
    }
    result ??= await this.runner.run({
      capability: 'search',
      order: fastOrder(request.query, settings, intent),
      request: routed,
      signal,
    });

    if (result.sources.length > 0) {
      this.cache.set(cacheKey, result, settings.searchCacheMaxEntries);
    }
    return result;
  }
}

/** Fallback fetch provider. */
export class AutoFetchProvider {
  constructor({ settings, providers }) {
    this.settings = settings;
    this.providers = providers;
    this.cache = new TtlLruCache();
    this.runner = new ProviderRunner({ settings, providers });
  }

  get id() {
    return 'auto';
  }

  get title() {
    return '自动路由';
  }

  get description() {
    return {
      en: 'Fast mode uses Keenable and direct HTTP first; clean mode prefers Keenable and AnySearch for clean Markdown, with Exa/Tavily/Firecrawl fallback.',
      zh: '快速模式 Keenable / 直连 HTTP 优先；质量模式优先 Keenable / AnySearch 获取干净 Markdown，Exa/Tavily/Firecrawl 兜底。',
    };
  }

  defaultOrder(settings) {
    return (settings.fetchMode ?? 'fast') === 'clean' ? settings.cleanFetchOrder : settings.fetchOrder;
  }

  available() {
    return this.runner.available('fetch', this.defaultOrder(this.settings()));
  }

  async ready() {
    return this.runner.ready('fetch', this.defaultOrder(this.settings()));
  }

  /**
   * Fetch one URL. An explicit `order` overrides the mode-derived order and
   * joins the cache key, so policy variants share this instance's cache and
   * circuit breaker instead of a second provider stack.
   */
  async fetch(request, signal, { order } = {}) {
    if (signal?.aborted === true) throw webError('Web fetch aborted', 'WEB_ABORTED', { cause: signal.reason });
    const settings = this.settings();
    const effectiveOrder = order ?? this.defaultOrder(settings);
    const cacheKey = fetchCacheKey(settings, request, effectiveOrder);
    const cached = this.cache.get(cacheKey, settings.fetchCacheTtlMs);
    if (cached !== undefined) return cached;

    const result = await this.runner.run({ capability: 'fetch', order: effectiveOrder, request, signal });
    this.cache.set(cacheKey, result, settings.fetchCacheMaxEntries);
    return result;
  }
}
