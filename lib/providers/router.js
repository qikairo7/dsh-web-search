/** Ordered fallback router with quality search, cache, and circuit breakers. */

import { errorMessage, isAbortLike, webError } from '../errors.js';
import { isOfficialDocHost, sortByAuthority } from '../authority.js';
import { TtlLruCache } from '../cache.js';
import { classifyIntent, fastOrder, isAiQuery, qualityPair } from '../intent.js';
import { filterOfficialDocs, officialDomainsForQuery } from '../officialDocs.js';
import { filterNewsLanguage } from '../news.js';
import { parseQuerySyntax } from '../query.js';
import { detectLanguage } from '../language.js';
import { providerSettings } from '../settings.js';
import { summarizeContent, summarizeTechnicalContent } from '../summarize.js';
import { isTechnicalText } from '../technical.js';
import { cleanMarkdown, htmlToText } from '../clean.js';

function isTechnicalSource(source) {
  try {
    const host = new URL(source.url).hostname.toLowerCase();
    if (isOfficialDocHost(host)) return true;
  } catch {
    // Fall through to the text heuristic.
  }
  return isTechnicalText(`${source.title ?? ''} ${source.url}`);
}

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
  constructor({ settings, providers, reranker, embeddings, fetcher }) {
    this.settings = settings;
    this.providers = providers;
    this.reranker = reranker;
    this.embeddings = embeddings;
    this.fetcher = fetcher;
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
      settings.enrichEnabled ?? true,
      settings.enrichTopN,
      settings.enrichSummaryMinChars,
      settings.enrichSummaryMaxChars,
      settings.semanticDedupThreshold ?? '',
      settings.siliconflow?.embeddingsEnabled ?? '',
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

    const tasks = selected.map(({ name, provider }) => ({
      name,
      promise: (async () => {
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
      })(),
    }));

    const officialDomains =
      settings.officialDocsEnabled === false || parseQuerySyntax(request.query).site !== undefined
        ? []
        : officialDomainsForQuery(request.query);
    if (officialDomains.length > 0) {
      tasks.push({
        name: 'official-docs',
        promise: this.searchOfficialDocs(request, signal, settings, officialDomains),
      });
    }

    const settled = await Promise.allSettled(tasks.map((task) => task.promise));
    const successes = settled
      .map((entry, index) =>
        entry.status === 'fulfilled' ? { name: tasks[index].name, result: entry.value } : undefined,
      )
      .filter((entry) => entry !== undefined);

    if (successes.length === 0) {
      return this.runSearchOrder(fastOrder(request.query, settings, intent), request, signal, settings);
    }

    const target =
      Number.isSafeInteger(request.maxResults) && request.maxResults > 0 ? request.maxResults : 10;
    const providerByUrl = new Map();
    for (const { name, result } of successes) {
      for (const source of result.sources) {
        if (!providerByUrl.has(source.url)) providerByUrl.set(source.url, name);
      }
    }
    let candidates = mergeRoundRobin(successes.map((entry) => entry.result));
    if (intent === 'news') {
      const filtered = filterNewsLanguage(candidates, detectLanguage(request.query));
      if (filtered.length > 0) candidates = filtered;
    }
    if (this.embeddings !== undefined) {
      const deduped = await this.embeddings.dedupe(
        candidates,
        settings.semanticDedupThreshold ?? 0.95,
        signal,
      );
      if (deduped !== undefined) candidates = deduped;
    }

    const aiNews = intent === 'news' && isAiQuery(request.query);
    const sortOptions = {
      news: intent === 'news',
      language: detectLanguage(request.query),
      ...(aiNews
        ? { providerBoost: (source) => (providerByUrl.get(source.url) === 'aihot' ? 0.5 : 0) }
        : {}),
    };

    let ranked;
    if (this.reranker !== undefined && typeof this.reranker.rerankScored === 'function') {
      const scored = await this.reranker.rerankScored(request.query, candidates, signal);
      if (scored !== undefined) {
        ranked = sortByAuthority(scored, sortOptions).map((entry) => entry.source);
      }
    }
    if (ranked === undefined && this.reranker !== undefined) {
      const ordered = await this.reranker.rerank(request.query, candidates, target, signal);
      ranked = sortByAuthority(
        ordered.map((source, index) => ({ source, score: 0, index })),
        sortOptions,
      ).map((entry) => entry.source);
    }
    if (ranked === undefined) {
      ranked = sortByAuthority(
        candidates.map((source, index) => ({ source, score: 0, index })),
        sortOptions,
      ).map((entry) => entry.source);
    }

    const content = firstContent(successes.map((entry) => entry.result));
    const finalSources = await this.enrichSources(
      ranked.slice(0, target),
      request,
      settings,
      signal,
    );
    return {
      ...(content === undefined ? {} : { content }),
      sources: finalSources,
      truncated: candidates.length > target,
    };
  }

  async enrichSources(sources, request, settings, signal) {
    if (settings.enrichEnabled === false || this.fetcher === undefined) return sources;
    const topN = Math.min(Math.max(Number(settings.enrichTopN), 0), sources.length);
    if (topN === 0) return sources;
    return Promise.all(
      sources.map((source, index) =>
        index < topN ? this.enrichSource(source, request, settings, signal) : source,
      ),
    );
  }

  async enrichSource(source, request, settings, signal) {
    try {
      const result = await this.fetcher.fetch({ url: source.url }, signal);
      let content = result?.body?.content;
      if (typeof content !== 'string') return source;
      if (result.body.kind === 'html' || /<html|<!doctype|<body|<div|<script/iu.test(content)) {
        content = htmlToText(content);
      }
      content = cleanMarkdown(content);
      if (content.length < 200) return source;
      const minChars = Math.max(Number(settings.enrichSummaryMinChars), 1);
      const maxChars = Math.max(Number(settings.enrichSummaryMaxChars), minChars);
      const summary = isTechnicalSource(source)
        ? summarizeTechnicalContent(content, request.query, minChars, maxChars)
        : summarizeContent(content, request.query, minChars, maxChars);
      if (summary.length < 200) return source;
      const originalSummary = typeof source.summary === 'string' ? source.summary : '';
      if (summary.length < minChars || summary.length <= originalSummary.length) return source;
      return { ...source, summary };
    } catch (error) {
      if (isAbortLike(error)) throw error;
      return source;
    }
  }

  async searchOfficialDocs(request, signal, settings, domains) {
    const provider = this.providers.tavily;
    const config = providerSettings(settings, 'tavily');
    if (
      provider === undefined ||
      typeof provider.searchWithDomains !== 'function' ||
      config?.enabled === false
    ) {
      return { sources: [], truncated: false };
    }
    try {
      if (!provider.available() || !(await provider.ready())) {
        return { sources: [], truncated: false };
      }
      const result = await provider.searchWithDomains(request, domains, signal);
      return { ...result, sources: filterOfficialDocs(result.sources) };
    } catch {
      return { sources: [], truncated: false };
    }
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
