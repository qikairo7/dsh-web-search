/** Tavily provider: Search and Extract APIs. */

import { joinURL, requestJSON, isHTTPURL } from '../http.js';
import { toWebError, webError } from '../errors.js';

export const TAVILY_PROVIDER_ID = 'tavily';

function clampResultCount(value, fallback, max) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
}

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
      const content = typeof item.content === 'string' ? item.content.trim() : '';
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
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    if (apiKey === undefined) {
      throw webError('Tavily API key is not configured', 'WEB_PROVIDER_CREDENTIAL_MISSING');
    }
    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/search'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'user-agent': 'dsh-web-search-router/0.1.0',
        },
        body: {
          query: request.query,
          search_depth: 'basic',
          max_results: clampResultCount(request.maxResults, 10, 20),
          include_answer: false,
          include_raw_content: false,
        },
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

  async fetch(request, signal) {
    const settings = this.settings();
    const config = settings.tavily;
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    if (apiKey === undefined) {
      throw webError('Tavily API key is not configured', 'WEB_PROVIDER_CREDENTIAL_MISSING');
    }
    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/extract'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'user-agent': 'dsh-web-search-router/0.1.0',
        },
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
      const content = typeof first?.raw_content === 'string' ? first.raw_content : '';
      if (content.length === 0) {
        const failure = Array.isArray(data.failed_results) ? data.failed_results[0] : undefined;
        throw new Error(
          typeof failure?.error === 'string' && failure.error.length > 0
            ? failure.error
            : 'extract response has no content',
        );
      }
      return {
        url: request.url,
        statusCode: 200,
        body: { kind: 'text', content },
        truncated: false,
      };
    } catch (error) {
      throw toWebError(error, 'Tavily', 'fetch', { fetch: true });
    }
  }
}
