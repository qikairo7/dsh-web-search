/** Keenable search and fetch providers, ported from @keenable/dsh-keenable 0.1.2 (MIT). */

import { isHTTPURL, joinURL } from '../http.js';
import { webError } from '../errors.js';
import { cleanMarkdown } from '../clean.js';
import { isProviderAvailable, providerOperation, textResult, USER_AGENT } from './shared.js';

export const KEENABLE_PROVIDER_ID = 'keenable';
export const KEENABLE_DEFAULT_BASE_URL = 'https://api.keenable.ai';

function endpoint(baseURL, path, apiKey) {
  return joinURL(baseURL, path) + (apiKey ? '' : '/public');
}

/**
 * Send one Keenable request through the shared operation skeleton; headers,
 * the `/public` fallback and `redirect: follow` stay Keenable-specific.
 *
 * @param {object} call - one Keenable operation plus the skeleton's
 *   `settings`, `isFetch`, `label` and `map` fields.
 */
async function callKeenable({ url, method, body, apiKey, signal, settings, operation, label, isFetch, map }) {
  const headers = {
    'user-agent': USER_AGENT,
    'x-keenable-title': 'dsh-web-search-router',
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (apiKey) headers['x-api-key'] = apiKey;
  return providerOperation({
    settings,
    provider: 'Keenable',
    operation,
    label,
    isFetch,
    url,
    request: { method, headers, body, signal, redirect: 'follow' },
    ...(map === undefined ? {} : { map }),
  });
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
    return isProviderAvailable(this.settings().keenable);
  }

  async ready() { return true; }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.keenable;
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    const body = { query: request.query, snippet_max_length: Math.min(Math.max(settings.maxSnippetChars, 180), 10000) };
    if (Number.isSafeInteger(request.maxResults) && request.maxResults > 0) body.max_results = Math.min(request.maxResults, 50);
    return callKeenable({
      url: endpoint(config.baseURL, '/v1/search', apiKey),
      method: 'POST',
      body,
      apiKey,
      signal,
      settings,
      operation: 'search',
      label: 'Keenable search',
      map: (data) => mapKeenableSearch(data, settings.maxSnippetChars),
    });
  }

  async fetch(request, signal) {
    const settings = this.settings();
    const config = settings.keenable;
    if (!isHTTPURL(request.url)) throw webError('Keenable fetch requires an absolute HTTP(S) URL', 'WEB_INVALID_URL');
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    const maxChars = Math.min(settings.maxFetchChars, 199999);
    const query = new URLSearchParams({ url: request.url, max_chars: String(maxChars + 1), live: 'true' });
    return callKeenable({
      url: endpoint(config.baseURL, '/v1/fetch', apiKey) + '?' + query.toString(),
      method: 'GET',
      apiKey,
      signal,
      settings,
      operation: 'fetch',
      label: 'Keenable fetch',
      isFetch: true,
      map: (data) => {
        if (typeof data?.content !== 'string') throw new Error('response.content is not a string');
        const title = typeof data.title === 'string' ? data.title.trim() : '';
        const content = cleanMarkdown(title.length > 0 && !data.content.slice(0, 300).includes(title) ? '# ' + title + '\n\n' + data.content : data.content, request.url);
        return textResult(request.url, content, settings.maxFetchChars);
      },
    });
  }
}
