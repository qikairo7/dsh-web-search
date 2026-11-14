/** Ordered fallback router with quality search, cache, and circuit breakers. */

import { errorMessage, isAbortLike, webError } from '../errors.js';
import { TtlLruCache } from '../cache.js';
import { classifyIntent, fastOrder, qualityPair } from '../intent.js';
import { providerSettings } from '../settings.js';

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|spm$|scm$|from$|source$|ref$)/iu.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function mergeRoundRobin(results) {
  const lists = results.map((result) => result.sources ?? []);
  const maxRank = lists.reduce((max, list) => Math.max(max, list.length), 0);
  const seen = new Set();
  const merged = [];
  for (let rank = 0; rank < maxRank; rank += 1) {
    for (const list of lists) {
      const source = list[rank];
      if (source === undefined) continue;
      const key = normalizeUrl(source.url);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(source);
    }
  }
  return merged;
}

function firstContent(results) {
  for (const result of results) {
    if (typeof result.content === 'string' && result.content.length > 0) return result.content;
  }
  return undefined;
}

class ProviderHealth {
  constructor() {
    this.state = new Map();
  }

  blocked(name, settings) {
    const state = this.state.get(name);
    if (state?.blockedUntil === undefined) return false;
    if (Date.now() >= state.blockedUntil) {
      this.state.delete(name);
      return false;
    }
    return true;
  }

  failure(name, settings) {
    const state = this.state.get(name) ?? { failures: 0 };
    state.failures += 1;
    const threshold = settings.breakerFailureThreshold ?? 3;
    if (state.failures >= threshold) {
      state.blockedUntil = Date.now() + (settings.breakerCooldownMs ?? 300_000);
      state.failures = 0;
    }
    this.state.set(name, state);
  }

  success(name) {
    this.state.delete(name);
  }
}

/** Fallback search provider. */
export class AutoSearchProvider {
  constructor({ settings, providers, reranker }) {
    this.settings = settings;
    this.providers = providers;
    this.reranker = reranker;
    this.cache = new TtlLruCache();
    this.health = new ProviderHealth();
  }

  get id() {
    return 'auto';
  }

  get title() {
    return '自动路由';
  }

  get description() {
    return {
      en: 'Quality mode queries two providers and reranks with BGE; fast mode uses one provider with fallback.',
      zh: '质量模式查询两家后端并用 BGE 重排；快速模式单后端优先并自动回退。',
    };
  }

  available() {
    const settings = this.settings();
    return Object.entries(this.providers).some(
      ([name, provider]) =>
        typeof provider.search === 'function' &&
        providerSettings(settings, name)?.enabled !== false &&
        provider.available(),
    );
  }

  async ready() {
    const settings = this.settings();
    for (const [name, provider] of Object.entries(this.providers)) {
      if (typeof provider.search !== 'function') continue;
      if (providerSettings(settings, name)?.enabled === false) continue;
      try {
        if (await provider.ready()) return true;
      } catch {
        // Keep checking.
      }
    }
    return false;
  }

  async search(request, signal) {
    if (signal?.aborted === true) throw webError('Web search aborted', 'WEB_ABORTED', { cause: signal.reason });
    const settings = this.settings();
    const mode = settings.searchMode ?? 'fast';
    const intent = classifyIntent(request.query);
    const cacheKey = [
      mode,
      settings.intentRouting ?? true,
      settings.chineseSearchOrder.join(','),
      settings.defaultSearchOrder.join(','),
      settings.maxSnippetChars,
      request.query,
      request.maxResults ?? '',
    ].join('|');
    const cached = this.cache.get(cacheKey, settings.searchCacheTtlMs);
    if (cached !== undefined) return cached;

    const result =
      mode === 'quality'
        ? await this.qualitySearch(request, signal, settings, intent)
        : await this.runSearchOrder(fastOrder(request.query, settings, intent), request, signal, settings);

    if (result.sources.length > 0) {
      this.cache.set(cacheKey, result, settings.searchCacheMaxEntries);
    }
    return result;
  }

  async qualitySearch(request, signal, settings, intent) {
    const pair = qualityPair(request.query, intent);
    const selected = pair
      .map((name) => ({ name, provider: this.providers[name], config: providerSettings(settings, name) }))
      .filter(
        (entry) =>
          entry.provider !== undefined &&
          typeof entry.provider.search === 'function' &&
          entry.config?.enabled !== false,
      );

    if (selected.length === 0) {
      return this.runSearchOrder(fastOrder(request.query, settings, intent), request, signal, settings);
    }

    const tasks = selected.map(async ({ name, provider }) => {
      if (this.health.blocked(name, settings)) throw new Error(`${name} is cooling down`);
      if (!provider.available()) throw new Error(`${name} is unavailable`);
      if (!(await provider.ready())) throw new Error(`${name} is missing a credential`);
      try {
        const result = await provider.search(request, signal);
        this.health.success(name);
        return result;
      } catch (error) {
        if (isAbortLike(error)) throw error;
        this.health.failure(name, settings);
        throw error;
      }
    });

    const settled = await Promise.allSettled(tasks);
    const successes = settled
      .filter((entry) => entry.status === 'fulfilled')
      .map((entry) => entry.value);

    if (successes.length === 0) {
      return this.runSearchOrder(fastOrder(request.query, settings, intent), request, signal, settings);
    }

    const target =
      Number.isSafeInteger(request.maxResults) && request.maxResults > 0 ? request.maxResults : 10;
    const merged = mergeRoundRobin(successes);
    const reranked =
      this.reranker === undefined
        ? merged
        : await this.reranker.rerank(request.query, merged, target, signal);
    const content = firstContent(successes);
    return {
      ...(content === undefined ? {} : { content }),
      sources: reranked.slice(0, target),
      truncated: merged.length > target,
    };
  }

  async runSearchOrder(order, request, signal, settings) {
    const attempts = [];
    let eligible = 0;
    for (const name of order) {
      const provider = this.providers[name];
      if (provider === undefined || typeof provider.search !== 'function') continue;
      if (providerSettings(settings, name)?.enabled === false) continue;
      if (this.health.blocked(name, settings)) {
        attempts.push(`${name}: cooling down`);
        continue;
      }
      if (!provider.available()) {
        attempts.push(`${name}: unavailable`);
        continue;
      }
      try {
        if (!(await provider.ready())) {
          attempts.push(`${name}: credential missing`);
          continue;
        }
      } catch {
        attempts.push(`${name}: readiness check failed`);
        continue;
      }
      eligible += 1;
      try {
        const result = await provider.search(request, signal);
        this.health.success(name);
        return result;
      } catch (error) {
        if (isAbortLike(error)) throw error;
        this.health.failure(name, settings);
        attempts.push(`${name}: ${errorMessage(error)}`);
      }
    }
    throw webError(
      `All search providers failed (${attempts.length > 0 ? attempts.join('; ') : 'no providers configured'})`,
      eligible === 0 ? 'WEB_PROVIDER_UNAVAILABLE' : 'WEB_PROVIDER_ERROR',
    );
  }
}

/** Fallback fetch provider. */
export class AutoFetchProvider {
  constructor({ settings, providers }) {
    this.settings = settings;
    this.providers = providers;
    this.cache = new TtlLruCache();
    this.health = new ProviderHealth();
  }

  get id() {
    return 'auto';
  }

  get title() {
    return '自动路由';
  }

  get description() {
    return {
      en: 'Fast mode uses direct HTTP first; clean mode prefers Tavily and Firecrawl for cleaner Markdown.',
      zh: '快速模式直连 HTTP 优先；质量模式优先 Tavily / Firecrawl 获取更干净的 Markdown。',
    };
  }

  available() {
    const settings = this.settings();
    const order = (settings.fetchMode ?? 'fast') === 'clean' ? settings.cleanFetchOrder : settings.fetchOrder;
    return order.some((name) => {
      const provider = this.providers[name];
      return (
        provider !== undefined &&
        typeof provider.fetch === 'function' &&
        providerSettings(settings, name)?.enabled !== false &&
        provider.available()
      );
    });
  }

  async ready() {
    const settings = this.settings();
    const order = (settings.fetchMode ?? 'fast') === 'clean' ? settings.cleanFetchOrder : settings.fetchOrder;
    for (const name of order) {
      const provider = this.providers[name];
      if (provider === undefined || typeof provider.fetch !== 'function') continue;
      if (providerSettings(settings, name)?.enabled === false) continue;
      try {
        if (await provider.ready()) return true;
      } catch {
        // Keep checking.
      }
    }
    return false;
  }

  async fetch(request, signal) {
    if (signal?.aborted === true) throw webError('Web fetch aborted', 'WEB_ABORTED', { cause: signal.reason });
    const settings = this.settings();
    const mode = settings.fetchMode ?? 'fast';
    const cacheKey = `${mode}|${request.url}`;
    const cached = this.cache.get(cacheKey, settings.fetchCacheTtlMs);
    if (cached !== undefined) return cached;

    const order = mode === 'clean' ? settings.cleanFetchOrder : settings.fetchOrder;
    const result = await this.runFetchOrder(order, request, signal, settings);
    this.cache.set(cacheKey, result, settings.fetchCacheMaxEntries);
    return result;
  }

  async runFetchOrder(order, request, signal, settings) {
    const attempts = [];
    let eligible = 0;
    for (const name of order) {
      const provider = this.providers[name];
      if (provider === undefined || typeof provider.fetch !== 'function') continue;
      if (providerSettings(settings, name)?.enabled === false) continue;
      if (this.health.blocked(name, settings)) {
        attempts.push(`${name}: cooling down`);
        continue;
      }
      if (!provider.available()) {
        attempts.push(`${name}: unavailable`);
        continue;
      }
      try {
        if (!(await provider.ready())) {
          attempts.push(`${name}: credential missing`);
          continue;
        }
      } catch {
        attempts.push(`${name}: readiness check failed`);
        continue;
      }
      eligible += 1;
      try {
        const result = await provider.fetch(request, signal);
        this.health.success(name);
        return result;
      } catch (error) {
        if (isAbortLike(error)) throw error;
        this.health.failure(name, settings);
        attempts.push(`${name}: ${errorMessage(error)}`);
      }
    }
    throw webError(
      `All fetch providers failed (${attempts.length > 0 ? attempts.join('; ') : 'no providers configured'})`,
      eligible === 0 ? 'WEB_PROVIDER_UNAVAILABLE' : 'WEB_PROVIDER_ERROR',
    );
  }
}
