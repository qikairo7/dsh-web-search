/** AnySearch native provider: anonymous search plus cleaned Extract fetch. */

import { joinURL, requestJSON, isHTTPURL } from '../http.js';
import { toWebError } from '../errors.js';
import { detectLanguage } from '../language.js';
import { cleanMarkdown } from '../clean.js';
import { summarizeContent } from '../summarize.js';

export const ANYSEARCH_PROVIDER_ID = 'anysearch';

/** Map one AnySearch result into the seam's source vocabulary. */
export function mapAnySearchSource(item, maxChars = 800, query = '') {
  if (item === null || typeof item !== 'object') return undefined;
  const url = typeof item.url === 'string' ? item.url.trim() : '';
  if (!isHTTPURL(url)) return undefined;
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  const snippet = typeof item.snippet === 'string' ? item.snippet.trim() : '';
  const content = typeof item.content === 'string' ? item.content.trim() : '';
  const summary = summarizeContent(content || snippet, query, 800, Math.min(maxChars, 1500));
  return {
    url,
    ...(title.length > 0 ? { title } : {}),
    ...(snippet.length > 0 ? { snippet } : {}),
    ...(summary.length > 0 ? { summary } : {}),
  };
}

/** Map a complete AnySearch search response. */
export function mapAnySearchSearch(data, maxChars = 800, query = '') {
  if (data === null || typeof data !== 'object') {
    throw new Error('response is not an object');
  }
  if (data.code !== 0) {
    throw new Error(
      typeof data.message === 'string' && data.message.trim().length > 0
        ? data.message.trim()
        : `API error ${String(data.code)}`,
    );
  }
  const results = Array.isArray(data.data?.results) ? data.data.results : [];
  const sources = results
    .map((item) => mapAnySearchSource(item, maxChars, query))
    .filter((item) => item !== undefined);
  return { sources, truncated: false };
}

/** AnySearch-backed search and fetch provider. */
export class AnySearchProvider {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  get id() {
    return ANYSEARCH_PROVIDER_ID;
  }

  get title() {
    return 'AnySearch';
  }

  get description() {
    return {
      en: 'Anonymous-capable web search and cleaned Extract fetch through AnySearch.',
      zh: '通过 AnySearch 提供可匿名使用的网页搜索与正文提取。',
    };
  }

  available() {
    const config = this.settings().anysearch;
    return config.enabled === true && isHTTPURL(config.baseURL);
  }

  async ready() {
    return true;
  }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.anysearch;
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    const headers = {
      'content-type': 'application/json',
      'user-agent': 'dsh-web-search-router/0.1.0',
    };
    if (apiKey !== undefined) headers.authorization = `Bearer ${apiKey}`;

    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/v1/search'), {
        method: 'POST',
        headers,
        body: {
          query: request.query,
          ...(request.maxResults === undefined ? {} : { max_results: request.maxResults }),
          ...(settings.languageRouting === false ? {} : { language: detectLanguage(request.query) }),
        },
        signal,
        timeoutMs: settings.requestTimeoutMs,
        provider: 'AnySearch',
        operation: 'search',
      });
      return mapAnySearchSearch(data, settings.maxSnippetChars, request.query);
    } catch (error) {
      throw toWebError(error, 'AnySearch', 'search');
    }
  }

  async fetch(request, signal) {
    const settings = this.settings();
    const config = settings.anysearch;
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    const headers = {
      'content-type': 'application/json',
      'user-agent': 'dsh-web-search-router/0.1.0',
    };
    if (apiKey !== undefined) headers.authorization = `Bearer ${apiKey}`;

    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/v1/extract'), {
        method: 'POST',
        headers,
        body: { url: request.url },
        signal,
        timeoutMs: settings.requestTimeoutMs,
        timeoutCode: 'WEB_FETCH_TIMEOUT',
        provider: 'AnySearch',
        operation: 'fetch',
      });
      if (data === null || typeof data !== 'object' || data.code !== 0) {
        throw new Error(
          data !== null && typeof data === 'object' && typeof data.message === 'string'
            ? data.message
            : 'extract response is invalid',
        );
      }
      const content = cleanMarkdown(typeof data.data?.content === 'string' ? data.data.content : '');
      if (content.length === 0) throw new Error('extract response has no content');
      return {
        url: request.url,
        statusCode: 200,
        body: { kind: 'text', content },
        truncated: false,
      };
    } catch (error) {
      throw toWebError(error, 'AnySearch', 'fetch', { fetch: true });
    }
  }
}
