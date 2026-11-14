/** Firecrawl provider: v2 Search and Scrape APIs. */

import { joinURL, requestJSON, isHTTPURL } from '../http.js';
import { toWebError, webError } from '../errors.js';
import { parseQuerySyntax, toMonthDayYear } from '../query.js';
import { classifyIntent } from '../intent.js';
import { cleanMarkdown } from '../clean.js';

export const FIRECRAWL_PROVIDER_ID = 'firecrawl';

function clampResultCount(value, fallback, max) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
}

/** Map a Firecrawl search response into the seam's source vocabulary. */
export function mapFirecrawlSearch(data, maxChars = 800) {
  if (data === null || typeof data !== 'object') throw new Error('response is not an object');
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
    const config = this.settings().firecrawl;
    return config.enabled === true && isHTTPURL(config.baseURL);
  }

  async ready() {
    const config = this.settings().firecrawl;
    return (await this.resolveKey(config.apiKeyEnv)) !== undefined;
  }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.firecrawl;
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    if (apiKey === undefined) {
      throw webError('Firecrawl API key is not configured', 'WEB_PROVIDER_CREDENTIAL_MISSING');
    }
    const syntax = parseQuerySyntax(request.query);
    const news = classifyIntent(request.query) === 'news';
    const body = {
      query: request.query,
      limit: clampResultCount(request.maxResults, 10, 100),
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

    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/v2/search'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'user-agent': 'dsh-web-search-router/0.1.0',
        },
        body,
        signal,
        timeoutMs: settings.requestTimeoutMs,
        provider: 'Firecrawl',
        operation: 'search',
      });
      return mapFirecrawlSearch(data, settings.maxSnippetChars);
    } catch (error) {
      throw toWebError(error, 'Firecrawl', 'search');
    }
  }

  async fetch(request, signal) {
    const settings = this.settings();
    const config = settings.firecrawl;
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    if (apiKey === undefined) {
      throw webError('Firecrawl API key is not configured', 'WEB_PROVIDER_CREDENTIAL_MISSING');
    }
    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/v2/scrape'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'user-agent': 'dsh-web-search-router/0.1.0',
        },
        body: {
          url: request.url,
          formats: ['markdown'],
          onlyMainContent: true,
        },
        signal,
        timeoutMs: settings.requestTimeoutMs,
        timeoutCode: 'WEB_FETCH_TIMEOUT',
        provider: 'Firecrawl',
        operation: 'fetch',
      });
      if (data === null || typeof data !== 'object') throw new Error('response is not an object');
      if (data.success !== true) {
        throw new Error(
          typeof data.error === 'string' && data.error.length > 0 ? data.error : 'Firecrawl scrape failed',
        );
      }
      const content = cleanMarkdown(typeof data.data?.markdown === 'string' ? data.data.markdown : '');
      if (content.length === 0) throw new Error('scrape response has no markdown');
      const truncated = content.length > settings.maxFetchChars;
      return {
        url:
          typeof data.data?.metadata?.url === 'string' && data.data.metadata.url.length > 0
            ? data.data.metadata.url
            : request.url,
        statusCode:
          typeof data.data?.metadata?.statusCode === 'number' ? data.data.metadata.statusCode : 200,
        body: { kind: 'text', content: truncated ? content.slice(0, settings.maxFetchChars) : content },
        truncated,
      };
    } catch (error) {
      throw toWebError(error, 'Firecrawl', 'fetch', { fetch: true });
    }
  }
}
