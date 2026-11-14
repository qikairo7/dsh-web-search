/** Ordered fallback router with mode dispatch and cache. */

import { webError } from '../errors.js';
import { ProviderRunner } from '../providerRunner.js';
import { TtlLruCache } from '../cache.js';
import { classifyIntent, fastOrder } from '../intent.js';
import { qualitySearch } from '../quality.js';
import { fetchCacheKey, searchCacheKey } from '../cacheKey.js';
import { realtimeSearch } from '../realtime.js';

/** Fallback search provider. */
export class AutoSearchProvider {
  constructor({ settings, providers, reranker, embeddings, fetcher }) {
    this.settings = settings;
    this.providers = providers;
    this.reranker = reranker;
    this.embeddings = embeddings;
    this.fetcher = fetcher;
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
      result = await qualitySearch({
        request,
        signal,
        settings,
        intent,
        providers: this.providers,
        runner: this.runner,
        reranker: this.reranker,
        embeddings: this.embeddings,
        fetcher: this.fetcher,
      });
    }
    result ??= await this.runSearchOrder(fastOrder(request.query, settings, intent), request, signal);

    if (result.sources.length > 0) {
      this.cache.set(cacheKey, result, settings.searchCacheMaxEntries);
    }
    return result;
  }

  async runSearchOrder(order, request, signal) {
    return this.runner.run({ capability: 'search', order, request, signal });
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

  available() {
    const settings = this.settings();
    const order = (settings.fetchMode ?? 'fast') === 'clean' ? settings.cleanFetchOrder : settings.fetchOrder;
    return this.runner.available('fetch', order);
  }

  async ready() {
    const settings = this.settings();
    const order = (settings.fetchMode ?? 'fast') === 'clean' ? settings.cleanFetchOrder : settings.fetchOrder;
    return this.runner.ready('fetch', order);
  }

  async fetch(request, signal) {
    if (signal?.aborted === true) throw webError('Web fetch aborted', 'WEB_ABORTED', { cause: signal.reason });
    const settings = this.settings();
    const mode = settings.fetchMode ?? 'fast';
    const order = mode === 'clean' ? settings.cleanFetchOrder : settings.fetchOrder;
    const cacheKey = fetchCacheKey(settings, request);
    const cached = this.cache.get(cacheKey, settings.fetchCacheTtlMs);
    if (cached !== undefined) return cached;

    const result = await this.runFetchOrder(order, request, signal);
    this.cache.set(cacheKey, result, settings.fetchCacheMaxEntries);
    return result;
  }

  async runFetchOrder(order, request, signal) {
    return this.runner.run({ capability: 'fetch', order, request, signal });
  }
}
