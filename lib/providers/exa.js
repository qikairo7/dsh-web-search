/** Exa search and contents providers. */

import { joinURL, requestJSON, isHTTPURL } from '../http.js';
import { webError, toWebError } from '../errors.js';
import { cleanMarkdown } from '../clean.js';
import { clampCount, jsonHeaders, requireKey, textResult } from './shared.js';

export const EXA_PROVIDER_ID = 'exa';
export const EXA_DEFAULT_BASE_URL = 'https://api.exa.ai';

/** Map Exa results to the seam source shape; highlights are the primary snippet. */
export function mapExaSearch(data, maxChars = 4000) {
  if (data === null || typeof data !== 'object' || !Array.isArray(data.results)) {
    throw new Error('response.results is not an array');
  }
  const sources = [];
  for (const item of data.results) {
    if (item === null || typeof item !== 'object') continue;
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    if (!isHTTPURL(url)) continue;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const highlights = Array.isArray(item.highlights)
      ? item.highlights.filter((value) => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim())
      : [];
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    const snippet = (highlights[0] ?? text).slice(0, maxChars);
    const summary = highlights.join(' ').slice(0, Math.min(maxChars, 1500)) || snippet;
    const publishedAt = typeof item.publishedDate === 'string' ? item.publishedDate : '';
    sources.push({
      url,
      ...(title.length > 0 ? { title } : {}),
      ...(snippet.length > 0 ? { snippet } : {}),
      ...(summary.length > 0 ? { summary } : {}),
      ...(publishedAt.length > 0 ? { publishedAt } : {}),
    });
  }
  return { sources, truncated: false };
}

/** Exa semantic search and Contents fetch provider. */
export class ExaProvider {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  get id() { return EXA_PROVIDER_ID; }
  get title() { return 'Exa'; }
  get description() {
    return { en: 'Exa semantic search and clean Contents extraction.', zh: 'Exa 语义搜索与干净 Contents 提取。' };
  }

  available() {
    const config = this.settings().exa;
    return config.enabled === true && isHTTPURL(config.baseURL);
  }

  async ready() {
    const config = this.settings().exa;
    return (await this.resolveKey(config.apiKeyEnv)) !== undefined;
  }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.exa;
    const apiKey = requireKey(await this.resolveKey(config.apiKeyEnv), 'Exa API key');
    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/search'), {
        method: 'POST',
        headers: jsonHeaders(apiKey),
        body: {
          query: request.query,
          type: 'auto',
          numResults: clampCount(request.maxResults, 10, 100),
          contents: { highlights: { highlightsPerUrl: 1 }, text: { maxCharacters: 2000 } },
        },
        signal,
        timeoutMs: settings.requestTimeoutMs,
        provider: 'Exa',
        operation: 'search',
      });
      return mapExaSearch(data, settings.maxSnippetChars);
    } catch (error) {
      throw toWebError(error, 'Exa', 'search');
    }
  }

  async fetch(request, signal) {
    const settings = this.settings();
    const config = settings.exa;
    if (!isHTTPURL(request.url)) {
      throw webError('Exa fetch requires an absolute HTTP(S) URL', 'WEB_INVALID_URL');
    }
    const apiKey = requireKey(await this.resolveKey(config.apiKeyEnv), 'Exa API key');
    const maxChars = Math.min(settings.maxFetchChars, 199999);
    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/contents'), {
        method: 'POST',
        headers: jsonHeaders(apiKey),
        body: { urls: [request.url], text: { maxCharacters: maxChars + 1 }, highlights: { highlightsPerUrl: 1 } },
        signal,
        timeoutMs: settings.requestTimeoutMs,
        timeoutCode: 'WEB_FETCH_TIMEOUT',
        provider: 'Exa',
        operation: 'fetch',
      });
      const first = Array.isArray(data?.results) ? data.results[0] : undefined;
      if (first === undefined) throw new Error('contents response has no result');
      const text = typeof first.text === 'string' && first.text.trim().length > 0
        ? first.text
        : Array.isArray(first.highlights) ? first.highlights.join('\n\n') : '';
      const content = cleanMarkdown(text, request.url);
      if (content.length === 0) throw new Error('contents response has no text');
      return textResult(request.url, content, settings.maxFetchChars);
    } catch (error) {
      throw toWebError(error, 'Exa', 'fetch', { fetch: true });
    }
  }
}
