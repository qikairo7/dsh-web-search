/** Tavily provider: Search and Extract APIs. */

import { joinURL, requestJSON, isHTTPURL } from '../http.js';
import { toWebError } from '../errors.js';
import { parseQuerySyntax, toDateBoundary } from '../query.js';
import { classifyIntent } from '../intent.js';
import { detectLanguage } from '../language.js';
import { cleanMarkdown } from '../clean.js';
import { clampCount, jsonHeaders, requireKey, textResult } from './shared.js';

export const TAVILY_PROVIDER_ID = 'tavily';

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

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.tavily;
    const apiKey = requireKey(await this.resolveKey(config.apiKeyEnv), 'Tavily API key');
    const syntax = parseQuerySyntax(request.query);
    const news = classifyIntent(request.query) === 'news';
    const body = {
      query: request.query,
      search_depth: 'basic',
      max_results: clampCount(request.maxResults, 10, 20),
      include_answer: false,
      include_raw_content: true,
    };
    if (syntax.site !== undefined) body.include_domains = [syntax.site];
    if (syntax.lang !== undefined) body.language = syntax.lang.split(',')[0];
    else if (settings.languageRouting !== false) body.language = detectLanguage(request.query);
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
