/** Ordered fallback router with mode dispatch, routing annotation, and cache. */

import { webError } from '../errors.js';
import { ProviderRunner } from '../providerRunner.js';
import { ResultCache } from '../cache.js';
import { providerEntry } from '../catalog.js';
import { htmlToText } from '../clean.js';
import { classifyIntent, fastOrder } from '../intent.js';
import { routingFacts } from '../routing.js';
import { QualityEngine } from '../quality.js';
import { fetchCacheKey, searchCacheKey } from '../cacheKey.js';
import { realtimeSearch } from '../realtime.js';
import { githubFetchTarget } from '../host.js';

/** Weak-result fallback budget: at most one extra free provider (ADR-0015). */
const MAX_WEAK_FALLBACKS = 1;

/** True for a provider weak fallback may walk: every non-paid tier (ADR-0015). */
function isFreeTier(name) {
  return providerEntry(name)?.tier !== 'paid';
}

/** A search result with no sources is a weak result (ADR-0015). */
function isWeakSearch(result) {
  return (result?.sources?.length ?? 0) === 0;
}

/** A fetch result whose extracted body is empty or a blank shell is weak (ADR-0015). */
function isWeakFetch(result) {
  const body = result?.body;
  const content = typeof body?.content === 'string' ? body.content : '';
  const text = body?.kind === 'html' ? htmlToText(content) : content;
  return text.trim().length === 0;
}

const WEAK_SEARCH = { isWeak: isWeakSearch, isFree: isFreeTier, maxFallbacks: MAX_WEAK_FALLBACKS };
const WEAK_FETCH = { isWeak: isWeakFetch, isFree: isFreeTier, maxFallbacks: MAX_WEAK_FALLBACKS };

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
    // Quality mode stacks up to four requestTimeoutMs stages; this budget caps
    // them so a degraded search fails fast instead of outliving the caller's
    // tool deadline. The fast fallback below runs on the caller signal only, so
    // an expired internal deadline cannot poison the floor provider (#195).
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
      // Caller signal only: requestSignal may already be aborted by the internal
      // deadline, and reusing it aborts the floor provider before it can answer (#195).
      signal,
      // Empty sources are a weak result, retried once along the free stack (ADR-0015).
      weak: WEAK_SEARCH,
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
    let effectiveOrder = order ?? this.defaultOrder(settings);
    // A github.com issue or repo home page is served straight from the GitHub
    // API instead of the HTML extractors (ADR-0012); other URLs keep the order.
    if (order === undefined && githubFetchTarget(request.url) !== undefined) {
      effectiveOrder = ['github', ...effectiveOrder.filter((name) => name !== 'github')];
    }
    const cacheKey = fetchCacheKey(settings, request, effectiveOrder);
    const cached = this.cache.read(cacheKey, settings);
    if (cached !== undefined) return cached;

    const result = await this.runner.run({
      capability: 'fetch',
      order: effectiveOrder,
      request,
      signal,
      // An empty extracted body is a weak result, retried once along the free stack (ADR-0015).
      weak: WEAK_FETCH,
    });
    // Weak results are never cached, so the next call retries the chain (ADR-0015).
    if (!isWeakFetch(result)) {
      this.cache.write(cacheKey, result, settings);
    }
    return result;
  }
}
