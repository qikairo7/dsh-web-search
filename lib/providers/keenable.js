/** Keenable search and fetch providers, ported from @keenable/dsh-keenable. */

import { isHTTPURL, joinURL, requestJSON } from '../http.js';
import { toWebError, webError } from '../errors.js';
import { cleanMarkdown } from '../clean.js';
import { textResult } from './shared.js';

export const KEENABLE_PROVIDER_ID = 'keenable';
export const KEENABLE_DEFAULT_BASE_URL = 'https://api.keenable.ai';

function endpoint(baseURL, path, apiKey) {
  return joinURL(baseURL, path) + (apiKey ? '' : '/public');
}

async function callKeenable({ url, method, body, apiKey, signal, timeoutMs, label }) {
  const headers = {
    'user-agent': 'dsh-web-search-router/0.1.0',
    'x-keenable-title': 'dsh-web-search-router',
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (apiKey) headers['x-api-key'] = apiKey;
  const { data } = await requestJSON(url, {
    method,
    headers,
    body,
    signal,
    timeoutMs,
    redirect: 'follow',
    provider: 'Keenable',
    operation: label,
  });
  return data;
}

/** Map Keenable search results to the seam source shape. */
export function mapKeenableSearch(data, maxSnippetChars = 500) {
  if (data === null || typeof data !== 'object' || !Array.isArray(data.results)) {
    throw new Error('response.results is not an array');
  }
  const sources = [];
  for (const item of data.results) {
    if (item === null || typeof item !== 'object') continue;
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    if (!isHTTPURL(url)) continue;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const raw = [item.snippet, item.description].map((value) => typeof value === 'string' ? value.trim() : '').find((value) => value.length > 0) ?? '';
    const snippet = raw.replace(/\s+/gu, ' ').slice(0, maxSnippetChars);
    const publishedAt = typeof item.published_at === 'string' ? item.published_at : '';
    sources.push({
      url,
      ...(title.length > 0 ? { title } : {}),
      ...(snippet.length > 0 ? { snippet, summary: snippet } : {}),
      ...(publishedAt.length > 0 ? { publishedAt } : {}),
    });
  }
  return { sources, truncated: false };
}

/** Keenable search and clean Markdown fetch provider. */
export class KeenableProvider {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  get id() { return KEENABLE_PROVIDER_ID; }
  get title() { return 'Keenable'; }
  get description() {
    return { en: 'Keyless-capable search and clean Markdown fetch through Keenable.', zh: 'Keenable 搜索与干净 Markdown 抓取，可匿名使用。' };
  }

  available() {
    const config = this.settings().keenable;
    return config.enabled === true && isHTTPURL(config.baseURL);
  }

  async ready() { return true; }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.keenable;
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    const body = { query: request.query, snippet_max_length: Math.min(Math.max(settings.maxSnippetChars, 180), 10000) };
    if (Number.isSafeInteger(request.maxResults) && request.maxResults > 0) body.max_results = Math.min(request.maxResults, 50);
    try {
      const data = await callKeenable({
        url: endpoint(config.baseURL, '/v1/search', apiKey),
        method: 'POST',
        body,
        apiKey,
        signal,
        timeoutMs: settings.requestTimeoutMs,
        label: 'Keenable search',
      });
      return mapKeenableSearch(data, settings.maxSnippetChars);
    } catch (error) {
      throw toWebError(error, 'Keenable', 'search');
    }
  }

  async fetch(request, signal) {
    const settings = this.settings();
    const config = settings.keenable;
    if (!isHTTPURL(request.url)) throw webError('Keenable fetch requires an absolute HTTP(S) URL', 'WEB_INVALID_URL');
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    const maxChars = Math.min(settings.maxFetchChars, 199999);
    const query = new URLSearchParams({ url: request.url, max_chars: String(maxChars + 1), live: 'true' });
    try {
      const data = await callKeenable({
        url: endpoint(config.baseURL, '/v1/fetch', apiKey) + '?' + query.toString(),
        method: 'GET',
        apiKey,
        signal,
        timeoutMs: settings.requestTimeoutMs,
        label: 'Keenable fetch',
      });
      if (typeof data?.content !== 'string') throw new Error('response.content is not a string');
      const title = typeof data.title === 'string' ? data.title.trim() : '';
      const content = cleanMarkdown(title.length > 0 && !data.content.slice(0, 300).includes(title) ? '# ' + title + '\n\n' + data.content : data.content, request.url);
      return textResult(request.url, content, settings.maxFetchChars);
    } catch (error) {
      throw toWebError(error, 'Keenable', 'fetch', { fetch: true });
    }
  }
}
