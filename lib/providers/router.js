/** Ordered fallback router with mode dispatch, routing annotation, and cache. */

import { webError } from '../errors.js';
import { ProviderRunner } from '../providerRunner.js';
import { ResultCache } from '../cache.js';
import { classifyIntent, fastOrder } from '../intent.js';
import { routingFacts } from '../routing.js';
import { QualityEngine } from '../quality.js';
import { fetchCacheKey, searchCacheKey } from '../cacheKey.js';
import { realtimeSearch } from '../realtime.js';

/** Fallback search provider. */
export class AutoSearchProvider {
  constructor({ settings, providers, reranker, embeddings, fetcher, debug }) {
    this.settings = settings;
    this.providers = providers;
    this.cache = new ResultCache('search');
    this.runner = new ProviderRunner({ settings, providers, debug });
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
      en: 'Quality mode queries the free set for the query language (Chinese adds Zhihu) and reranks with BGE; fast mode uses one provider with fallback.',
      zh: '质量模式按查询语言选择免费组合（中文加知乎）并用 BGE 重排；快速模式单后端优先并自动回退。',
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
    // One budget for the whole search: quality mode stacks up to four
    // requestTimeoutMs stages; without a cap a degraded search can outlive
    // the caller's tool deadline instead of failing fast.
    const deadline = AbortSignal.timeout(3 * (settings.requestTimeoutMs ?? 30_000));
    const requestSignal = signal === undefined ? deadline : AbortSignal.any([signal, deadline]);
    const mode = settings.searchMode ?? 'fast';
    const intent = classifyIntent(request.query);
    const routed = { ...request, routing: routingFacts(request.query, settings, intent) };
    const cacheKey = searchCacheKey(settings, request);
    const cached = this.cache.read(cacheKey, settings);
    if (cached !== undefined) return cached;

    const realtime = await realtimeSearch(request.query, settings, requestSignal);
    if (realtime !== undefined) {
      this.cache.write(cacheKey, realtime, settings);
      return realtime;
    }

    let result;
    if (mode === 'quality') {
      result = await this.engine.search(routed, requestSignal);
    }
    result ??= await this.runner.run({
      capability: 'search',
      order: fastOrder(request.query, settings, intent),
      request: routed,
      signal: requestSignal,
    });

    if (result.sources.length > 0) {
      this.cache.write(cacheKey, result, settings);
    }
    return result;
  }
}

/** Fallback fetch provider. */
export class AutoFetchProvider {
  constructor({ settings, providers, debug }) {
    this.settings = settings;
    this.providers = providers;
    this.cache = new ResultCache('fetch');
    this.runner = new ProviderRunner({ settings, providers, debug });
  }

  get id() {
    return 'auto';
  }

  get title() {
    return '自动路由';
  }

  get description() {
    return {
      en: 'Fast mode uses Keenable and direct HTTP first; clean mode prefers free extraction (Keenable/AnySearch/Exa), with Tavily/Firecrawl fallback.',
      zh: '快速模式 Keenable / 直连 HTTP 优先；质量模式优先 Keenable / AnySearch / Exa 免费抽取，Tavily/Firecrawl 兜底。',
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
    const cached = this.cache.read(cacheKey, settings);
    if (cached !== undefined) return cached;

    const result = await this.runner.run({ capability: 'fetch', order: effectiveOrder, request, signal });
    this.cache.write(cacheKey, result, settings);
    return result;
  }
}
