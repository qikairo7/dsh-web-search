/** AIHOT AI-news provider: anonymous, read-only, search-only. */

import { joinURL, requestJSON, isHTTPURL } from '../http.js';
import { toWebError } from '../errors.js';

export const AIHOT_PROVIDER_ID = 'aihot';

/** AIHOT's `q` is a strict keyword match; strip date and generic news words. */
export function normalizeAihotQuery(query) {
  const cleaned = String(query ?? '')
    .replace(/20\d{2}年(?:\d{1,2}月)?/gu, ' ')
    .replace(/\b20\d{2}[-/]\d{1,2}(?:[-/]\d{1,2})?\b/gu, ' ')
    .replace(
      /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/giu,
      ' ',
    )
    .replace(/\b20\d{2}\b/gu, ' ')
    .replace(
      /(新闻|资讯|行业|最新|今日|日报|周报|月报|动态|消息|头条|news|industry|latest|headlines?)/giu,
      ' ',
    )
    .replace(/\s+/gu, ' ')
    .trim();
  if (cleaned.length === 0 || /^ai$/iu.test(cleaned)) return 'AI';
  return cleaned.slice(0, 60);
}

function clamp(value, fallback, max) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
}

/** Map AIHOT items into the seam's source vocabulary. */
export function mapAihotItems(data, maxChars = 800) {
  if (data === null || typeof data !== 'object') throw new Error('response is not an object');
  const items = Array.isArray(data.items) ? data.items : [];
  const sources = items
    .map((item) => {
      if (item === null || typeof item !== 'object') return undefined;
      const url =
        typeof item.links?.original === 'string'
          ? item.links.original
          : typeof item.links?.aihot === 'string'
            ? item.links.aihot
            : '';
      if (!isHTTPURL(url)) return undefined;
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const summary = typeof item.summary === 'string' ? item.summary.trim() : '';
      const snippet = summary.slice(0, maxChars);
      return {
        url,
        ...(title.length > 0 ? { title } : {}),
        ...(snippet.length > 0 ? { snippet, summary: snippet } : {}),
        ...(typeof item.publishedAt === 'string' && item.publishedAt.length > 0
          ? { publishedAt: item.publishedAt }
          : {}),
      };
    })
    .filter((item) => item !== undefined);
  return { sources, truncated: false };
}

/** AIHOT search provider. */
export class AihotProvider {
  constructor({ settings }) {
    this.settings = settings;
  }

  get id() {
    return AIHOT_PROVIDER_ID;
  }

  get title() {
    return 'AIHOT';
  }

  get description() {
    return {
      en: 'Curated AI news and hot topics from AIHOT; anonymous and read-only.',
      zh: 'AIHOT 的 AI 新闻与热点精选；匿名只读。',
    };
  }

  available() {
    const config = this.settings().aihot;
    return config.enabled === true && isHTTPURL(config.baseURL);
  }

  async ready() {
    return true;
  }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.aihot;
    const url = new URL(joinURL(config.baseURL, '/api/v1/items'));
    url.searchParams.set('mode', 'selected');
    url.searchParams.set('window', '7d');
    url.searchParams.set('limit', String(clamp(request.maxResults, 10, 30)));
    url.searchParams.set('q', normalizeAihotQuery(request.query));

    try {
      const { data } = await requestJSON(url.toString(), {
        method: 'GET',
        headers: { 'user-agent': 'dsh-web-search-router/0.1.0' },
        signal,
        timeoutMs: settings.requestTimeoutMs,
        provider: 'AIHOT',
        operation: 'search',
      });
      return mapAihotItems(data, settings.maxSnippetChars);
    } catch (error) {
      throw toWebError(error, 'AIHOT', 'search');
    }
  }
}
