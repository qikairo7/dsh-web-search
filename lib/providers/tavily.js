/** Tavily provider: Search and Extract APIs. */

import { joinURL, requestJSON, isHTTPURL } from '../http.js';
import { toWebError } from '../errors.js';
import { parseQuerySyntax, toDateBoundary } from '../query.js';
import { classifyIntent } from '../intent.js';
import { detectLanguage } from '../language.js';
import { cleanMarkdown } from '../clean.js';
import { clampCount, jsonHeaders, requireKey, textResult } from './shared.js';

export const TAVILY_PROVIDER_ID = 'tavily';

/** Total content budget for one batch extract, counted across all returned URLs. */
const MAX_EXTRACT_CONTENT_CHARS = 12_000;

/** Map a Tavily search response into the seam's source vocabulary. */
export function mapTavilySearch(data, maxChars = 800, includeAnswer = true) {
  if (data === null || typeof data !== 'object') throw new Error('response is not an object');
  const answer = includeAnswer && typeof data.answer === 'string' ? data.answer.trim() : '';
  const results = Array.isArray(data.results) ? data.results : [];
  const sources = results
    .map((item) => {
      if (item === null || typeof item !== 'object') return undefined;
      const url = typeof item.url === 'string' ? item.url.trim() : '';
      if (!isHTTPURL(url)) return undefined;
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const content =
        typeof item.raw_content === 'string'
          ? item.raw_content.trim()
          : typeof item.content === 'string'
            ? item.content.trim()
            : '';
      const snippet = content.slice(0, maxChars);
      return {
        url,
        ...(title.length > 0 ? { title } : {}),
        ...(snippet.length > 0 ? { snippet, summary: snippet } : {}),
        ...(typeof item.published_date === 'string' && item.published_date.length > 0
          ? { publishedAt: item.published_date }
          : {}),
      };
    })
    .filter((item) => item !== undefined);
  return {
    ...(answer.length > 0 ? { content: answer } : {}),
    sources,
    truncated: false,
  };
}

/** Tavily-backed search and fetch provider. */
export class TavilyProvider {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  get id() {
    return TAVILY_PROVIDER_ID;
  }

  get title() {
    return 'Tavily';
  }

  get description() {
    return {
      en: 'Tavily Search and Extract, with a free monthly credit allowance.',
      zh: 'Tavily 搜索与正文提取，含每月免费额度。',
    };
  }

  available() {
    const config = this.settings().tavily;
    return config.enabled === true && isHTTPURL(config.baseURL);
  }

  async ready() {
    const config = this.settings().tavily;
    return (await this.resolveKey(config.apiKeyEnv)) !== undefined;
  }

  /** Advanced Search exposing Tavily's documented filters; used by the optional tool. */
  async searchAdvanced(options, signal) {
    const settings = this.settings();
    const config = settings.tavily;
    const apiKey = requireKey(await this.resolveKey(config.apiKeyEnv), 'Tavily API key');
    const body = {
      query: options.query,
      search_depth: options.searchDepth ?? 'basic',
      max_results: clampCount(options.maxResults, 10, 20),
      include_answer: options.includeAnswer ?? false,
      include_raw_content: options.includeRawContent ?? true,
      include_published_date: true,
    };
    if (options.topic !== undefined) body.topic = options.topic;
    if (options.timeRange !== undefined) body.time_range = options.timeRange;
    if (options.startDate !== undefined) body.start_date = options.startDate;
    if (options.endDate !== undefined) body.end_date = options.endDate;
    if (Array.isArray(options.includeDomains) && options.includeDomains.length > 0) {
      body.include_domains = options.includeDomains.slice(0, 20);
    }
    if (Array.isArray(options.excludeDomains) && options.excludeDomains.length > 0) {
      body.exclude_domains = options.excludeDomains.slice(0, 20);
    }
    if (options.country !== undefined) body.country = options.country;
    if (options.chunksPerSource !== undefined) body.chunks_per_source = options.chunksPerSource;
    if (options.filterByPublishedDate !== undefined) {
      body.filter_by_published_date = options.filterByPublishedDate;
    }
    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/search'), {
        method: 'POST',
        headers: jsonHeaders(apiKey),
        body,
        signal,
        timeoutMs: settings.requestTimeoutMs,
        provider: 'Tavily',
        operation: 'search',
      });
      return mapTavilySearch(data, settings.maxSnippetChars, body.include_answer);
    } catch (error) {
      throw toWebError(error, 'Tavily', 'search');
    }
  }

  /** Batch Extract for one to twenty URLs; per-URL failures stay separate. */
  async extractMany(urls, options, signal) {
    const settings = this.settings();
    const config = settings.tavily;
    const apiKey = requireKey(await this.resolveKey(config.apiKeyEnv), 'Tavily API key');
    const body = {
      urls,
      extract_depth: options.extractDepth ?? 'basic',
      format: options.format ?? 'markdown',
      include_images: options.includeImages ?? false,
      include_published_date: options.includePublishedDate ?? false,
    };
    if (options.query !== undefined) body.query = options.query;
    if (options.chunksPerSource !== undefined) body.chunks_per_source = options.chunksPerSource;
    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/extract'), {
        method: 'POST',
        headers: jsonHeaders(apiKey),
        body,
        signal,
        timeoutMs: settings.requestTimeoutMs,
        timeoutCode: 'WEB_FETCH_TIMEOUT',
        provider: 'Tavily',
        operation: 'extract',
      });
      if (data === null || typeof data !== 'object') throw new Error('response is not an object');
      let remaining = MAX_EXTRACT_CONTENT_CHARS;
      const results = (Array.isArray(data.results) ? data.results : []).map((item) => {
        const url = typeof item?.url === 'string' ? item.url : '';
        const raw = typeof item?.raw_content === 'string' ? item.raw_content : '';
        const content = cleanMarkdown(raw, url);
        const limit = Math.max(0, Math.min(settings.maxFetchChars, remaining));
        const shown = content.slice(0, limit);
        const truncated = shown.length < content.length;
        remaining -= shown.length;
        return {
          url,
          ...(typeof item?.title === 'string' && item.title.length > 0 ? { title: item.title } : {}),
          ...(typeof item?.published_date === 'string' && item.published_date.length > 0
            ? { publishedDate: item.published_date }
            : {}),
          content: shown,
          truncated,
        };
      });
      const failed = (Array.isArray(data.failed_results) ? data.failed_results : []).map((item) => ({
        url: typeof item?.url === 'string' ? item.url : '',
        error: typeof item?.error === 'string' ? item.error : 'extract failed',
      }));
      return { results, failed };
    } catch (error) {
      throw toWebError(error, 'Tavily', 'extract', { fetch: true });
    }
  }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.tavily;
    const apiKey = requireKey(await this.resolveKey(config.apiKeyEnv), 'Tavily API key');
    const routing = request.routing;
    const syntax = routing?.syntax ?? parseQuerySyntax(request.query);
    const news = (routing?.intent ?? classifyIntent(request.query)) === 'news';
    const body = {
      query: request.query,
      search_depth: 'basic',
      max_results: clampCount(request.maxResults, 10, 20),
      include_answer: false,
      include_raw_content: true,
    };
    if (syntax.site !== undefined) body.include_domains = [syntax.site];
    const language = routing?.language
      ?? (syntax.lang !== undefined
        ? syntax.lang.split(',')[0]
        : settings.languageRouting !== false
          ? detectLanguage(request.query)
          : undefined);
    if (language !== undefined) body.language = language;
    if (syntax.after !== undefined) body.start_date = toDateBoundary(syntax.after, false);
    if (syntax.before !== undefined) body.end_date = toDateBoundary(syntax.before, true);
    if (news) {
      body.topic = 'news';
      body.time_range = 'week';
      body.include_published_date = true;
    }

    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/search'), {
        method: 'POST',
        headers: jsonHeaders(apiKey),
        body,
        signal,
        timeoutMs: settings.requestTimeoutMs,
        provider: 'Tavily',
        operation: 'search',
      });
      return mapTavilySearch(data, settings.maxSnippetChars, settings.tavily.includeAnswer);
    } catch (error) {
      throw toWebError(error, 'Tavily', 'search');
    }
  }

  /** Search only within the supplied domains (used for official docs). */
  async searchWithDomains(request, domains, signal) {
    const settings = this.settings();
    const config = settings.tavily;
    const apiKey = requireKey(await this.resolveKey(config.apiKeyEnv), 'Tavily API key');
    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/search'), {
        method: 'POST',
        headers: jsonHeaders(apiKey),
        body: {
          query: request.query,
          search_depth: 'basic',
          max_results: Math.min(clampCount(request.maxResults, 5, 20), 10),
          include_answer: false,
          include_raw_content: false,
          include_domains: domains,
        },
        signal,
        timeoutMs: settings.requestTimeoutMs,
        provider: 'Tavily',
        operation: 'search',
      });
      return mapTavilySearch(data, settings.maxSnippetChars, false);
    } catch (error) {
      throw toWebError(error, 'Tavily', 'search');
    }
  }

  async fetch(request, signal) {
    const settings = this.settings();
    const config = settings.tavily;
    const apiKey = requireKey(await this.resolveKey(config.apiKeyEnv), 'Tavily API key');
    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/extract'), {
        method: 'POST',
        headers: jsonHeaders(apiKey),
        body: {
          urls: [request.url],
          extract_depth: 'basic',
          format: 'markdown',
          include_images: false,
          include_usage: false,
        },
        signal,
        timeoutMs: settings.requestTimeoutMs,
        timeoutCode: 'WEB_FETCH_TIMEOUT',
        provider: 'Tavily',
        operation: 'fetch',
      });
      if (data === null || typeof data !== 'object') throw new Error('response is not an object');
      const first = Array.isArray(data.results) ? data.results[0] : undefined;
      const content = cleanMarkdown(
        typeof first?.raw_content === 'string' ? first.raw_content : '',
        typeof first?.url === 'string' && first.url.length > 0 ? first.url : request.url,
      );
      if (content.length === 0) {
        const failure = Array.isArray(data.failed_results) ? data.failed_results[0] : undefined;
        throw new Error(
          typeof failure?.error === 'string' && failure.error.length > 0
            ? failure.error
            : 'extract response has no content',
        );
      }
      return textResult(request.url, content, settings.maxFetchChars);
    } catch (error) {
      throw toWebError(error, 'Tavily', 'fetch', { fetch: true });
    }
  }
}