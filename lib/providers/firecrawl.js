/** Firecrawl provider: v2 Search and Scrape APIs. */

import { joinURL, isHTTPURL } from '../http.js';
import { webError } from '../errors.js';
import { resolveRouting } from '../routing.js';
import { cleanMarkdown } from '../clean.js';
import {
  clampCount,
  hasCredential,
  isProviderAvailable,
  jsonHeaders,
  providerOperation,
  requireKey,
  textResult,
} from './shared.js';

export const FIRECRAWL_PROVIDER_ID = 'firecrawl';

/** Convert a YYYY or YYYY-MM-DD boundary to MM/DD/YYYY for Firecrawl `tbs`. */
export function toMonthDayYear(value, endOfPeriod = false) {
  if (typeof value !== 'string') return undefined;
  const date = /^\d{4}$/u.test(value)
    ? endOfPeriod
      ? `${value}-12-31`
      : `${value}-01-01`
    : value;
  const [year, month, day] = date.split('-');
  return `${month}/${day}/${year}`;
}

/** Map a Firecrawl search response into the seam's source vocabulary. */
export function mapFirecrawlSearch(data, maxChars = 800) {
  if (data === null || typeof data !== 'object') throw webError('response is not an object', 'WEB_INVALID_RESPONSE');
  if (data.success !== true) {
    throw new Error(
      typeof data.error === 'string' && data.error.length > 0 ? data.error : 'Firecrawl search failed',
    );
  }
  const items = [
    ...(Array.isArray(data.data?.web) ? data.data.web : []),
    ...(Array.isArray(data.data?.news) ? data.data.news : []),
  ];
  const sources = items
    .map((item) => {
      if (item === null || typeof item !== 'object') return undefined;
      const url = typeof item.url === 'string' ? item.url.trim() : '';
      if (!isHTTPURL(url)) return undefined;
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const description =
        typeof item.description === 'string'
          ? item.description.trim()
          : typeof item.snippet === 'string'
            ? item.snippet.trim()
            : '';
      const snippet = description.slice(0, maxChars);
      return {
        url,
        ...(title.length > 0 ? { title } : {}),
        ...(snippet.length > 0 ? { snippet, summary: snippet } : {}),
        ...(typeof item.date === 'string' && item.date.length > 0
          ? { publishedAt: item.date }
          : {}),
      };
    })
    .filter((item) => item !== undefined);
  return { sources, truncated: false };
}

/** Firecrawl-backed search and fetch provider. */
export class FirecrawlProvider {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  get id() {
    return FIRECRAWL_PROVIDER_ID;
  }

  get title() {
    return 'Firecrawl';
  }

  get description() {
    return {
      en: 'Firecrawl Search and Scrape, strong for JavaScript-heavy pages and PDFs.',
      zh: 'Firecrawl 搜索与抓取，适合动态网页和 PDF。',
    };
  }

  available() {
    return isProviderAvailable(this.settings().firecrawl);
  }

  async ready() {
    return hasCredential(this.resolveKey, this.settings().firecrawl);
  }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.firecrawl;
    const apiKey = requireKey(await this.resolveKey(config.apiKeyEnv), 'Firecrawl API key');
    const { intent, syntax } = resolveRouting(request, settings);
    const news = intent === 'news';
    const body = {
      query: request.query,
      limit: clampCount(request.maxResults, 10, 100),
      sources: news ? [{ type: 'web' }, { type: 'news' }] : [{ type: 'web' }],
    };
    if (syntax.site !== undefined) body.includeDomains = [syntax.site];
    if (syntax.after !== undefined || syntax.before !== undefined) {
      const minimum = syntax.after === undefined ? undefined : toMonthDayYear(syntax.after, false);
      const maximum = syntax.before === undefined ? undefined : toMonthDayYear(syntax.before, true);
      body.tbs = `cdr:1${minimum === undefined ? '' : `,cd_min:${minimum}`}${maximum === undefined ? '' : `,cd_max:${maximum}`}`;
    } else if (news) {
      body.tbs = 'qdr:w';
    }

    return providerOperation({
      settings,
      provider: 'Firecrawl',
      operation: 'search',
      url: joinURL(config.baseURL, '/v2/search'),
      request: { method: 'POST', headers: jsonHeaders(apiKey), body, signal },
      map: (data) => mapFirecrawlSearch(data, settings.maxSnippetChars),
    });
  }

  async fetch(request, signal) {
    const settings = this.settings();
    const config = settings.firecrawl;
    const apiKey = requireKey(await this.resolveKey(config.apiKeyEnv), 'Firecrawl API key');
    return providerOperation({
      settings,
      provider: 'Firecrawl',
      operation: 'fetch',
      isFetch: true,
      url: joinURL(config.baseURL, '/v2/scrape'),
      request: {
        method: 'POST',
        headers: jsonHeaders(apiKey),
        body: {
          url: request.url,
          formats: ['markdown'],
          onlyMainContent: true,
        },
        signal,
      },
      map: (data) => {
        if (data === null || typeof data !== 'object') throw webError('response is not an object', 'WEB_INVALID_RESPONSE');
        if (data.success !== true) {
          throw new Error(
            typeof data.error === 'string' && data.error.length > 0 ? data.error : 'Firecrawl scrape failed',
          );
        }
        const url =
          typeof data.data?.metadata?.url === 'string' && data.data.metadata.url.length > 0
            ? data.data.metadata.url
            : request.url;
        const content = cleanMarkdown(
          typeof data.data?.markdown === 'string' ? data.data.markdown : '',
          url,
        );
        if (content.length === 0) throw webError('scrape response has no markdown', 'WEB_INVALID_RESPONSE');
        const statusCode =
          typeof data.data?.metadata?.statusCode === 'number' ? data.data.metadata.statusCode : 200;
        return textResult(url, content, settings.maxFetchChars, statusCode);
      },
    });
  }
}
