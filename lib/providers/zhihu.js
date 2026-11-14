/** Zhihu provider: global search with site supplement, plus a site-only provider. */

import { joinURL, requestJSON, isHTTPURL } from '../http.js';
import { isAbortLike, toWebError, webError } from '../errors.js';
import { hasHan } from '../text.js';

export const ZHIHU_PROVIDER_ID = 'zhihu';
export const ZHIHU_SITE_PROVIDER_ID = 'zhihu-site';

/** Strip the simple HTML fragments the Zhihu API returns in ContentText. */
function plainText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/gu, '')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Convert seconds since the epoch to an ISO timestamp. */
function epochSecondsToISO(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : undefined;
}

/** Map a Zhihu search response into the seam's source vocabulary. */
export function mapZhihuSearch(data, maxChars = 800, includeMetadata = true) {
  if (data === null || typeof data !== 'object') throw new Error('response is not an object');
  if (data.Code !== 0) {
    const message =
      typeof data.Message === 'string' && data.Message.length > 0
        ? data.Message
        : `API error ${String(data.Code)}`;
    const error = new Error(message);
    error.code = data.Code === 30001 ? 'WEB_RATE_LIMITED' : 'WEB_PROVIDER_ERROR';
    throw error;
  }
  const items = Array.isArray(data.Data?.Items) ? data.Data.Items : [];
  const sources = items
    .map((item) => {
      if (item === null || typeof item !== 'object') return undefined;
      const url = typeof item.Url === 'string' ? item.Url.trim() : '';
      if (!isHTTPURL(url)) return undefined;
      const title = plainText(item.Title);
      const text = plainText(item.ContentText);
      const signals = [];
      if (includeMetadata) {
        const author = typeof item.AuthorName === 'string' ? item.AuthorName.trim() : '';
        if (author.length > 0 && author !== '知乎用户') signals.push(`作者：${author}`);
        if (typeof item.VoteUpCount === 'number') signals.push(`赞同 ${item.VoteUpCount}`);
        if (typeof item.CommentCount === 'number') signals.push(`评论 ${item.CommentCount}`);
      }
      const prefix = signals.length > 0 ? `[${signals.join('；')}] ` : '';
      const snippet = `${prefix}${text}`.slice(0, maxChars);
      const publishedAt = epochSecondsToISO(item.EditTime ?? item.CreateTime);
      return {
        url,
        ...(title.length > 0 ? { title } : {}),
        ...(snippet.length > 0 ? { snippet, summary: snippet } : {}),
        ...(publishedAt === undefined ? {} : { publishedAt }),
      };
    })
    .filter((item) => item !== undefined);
  return { sources, truncated: false };
}

/** Send one Zhihu search request and map it. */
async function requestZhihu({ mode, query, count, settings, resolveKey, signal }) {
  const config = settings.zhihu;
  const apiKey = await resolveKey(config.apiKeyEnv);
  if (apiKey === undefined) {
    throw webError('Zhihu Access Secret is not configured', 'WEB_PROVIDER_CREDENTIAL_MISSING');
  }
  const isSite = mode === 'site';
  const path = isSite ? '/api/v1/content/zhihu_search' : '/api/v1/content/global_search';
  const url = new URL(joinURL(config.baseURL, path));
  url.searchParams.set('Query', query);
  url.searchParams.set('Count', String(Math.min(Math.max(count, 1), isSite ? 10 : 20)));
  if (!isSite) url.searchParams.set('SearchDB', 'all');
  const { data } = await requestJSON(url.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'x-request-timestamp': String(Math.floor(Date.now() / 1000)),
      'content-type': 'application/json',
      'user-agent': 'dsh-web-search-router/0.1.0',
    },
    signal,
    timeoutMs: settings.requestTimeoutMs,
    provider: 'Zhihu',
    operation: 'search',
  });
  return mapZhihuSearch(data, settings.maxSnippetChars, config.includeMetadata);
}

/** Zhihu global search provider with a Chinese-query site supplement. */
export class ZhihuProvider {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  get id() {
    return ZHIHU_PROVIDER_ID;
  }

  get title() {
    return '知乎全网搜索';
  }

  get description() {
    return {
      en: 'Zhihu global web search; Chinese queries are supplemented with Zhihu site search.',
      zh: '知乎全网搜索；中文查询会用知乎站内搜索补足结果。',
    };
  }

  available() {
    const config = this.settings().zhihu;
    return config.enabled === true && isHTTPURL(config.baseURL);
  }

  async ready() {
    return (await this.resolveKey(this.settings().zhihu.apiKeyEnv)) !== undefined;
  }

  async search(request, signal) {
    const settings = this.settings();
    const target =
      Number.isSafeInteger(request.maxResults) && request.maxResults > 0 ? request.maxResults : 10;
    try {
      const primary = await requestZhihu({
        mode: 'global',
        query: request.query,
        count: target,
        settings,
        resolveKey: this.resolveKey,
        signal,
      });
      const sources = [...primary.sources];
      if (hasHan(request.query) && sources.length < target) {
        try {
          const supplement = await requestZhihu({
            mode: 'site',
            query: request.query,
            count: Math.min(target - sources.length, 10),
            settings,
            resolveKey: this.resolveKey,
            signal,
          });
          const seen = new Set(sources.map((source) => source.url));
          for (const source of supplement.sources) {
            if (seen.has(source.url)) continue;
            seen.add(source.url);
            sources.push(source);
            if (sources.length >= target) break;
          }
        } catch (error) {
          if (isAbortLike(error)) throw error;
          // A supplement failure must not discard the successful global result.
        }
      }
      return { sources: sources.slice(0, target), truncated: false };
    } catch (error) {
      throw toWebError(error, 'Zhihu', 'search');
    }
  }
}

/** Zhihu site-only search provider. */
export class ZhihuSiteProvider {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  get id() {
    return ZHIHU_SITE_PROVIDER_ID;
  }

  get title() {
    return '知乎站内搜索';
  }

  get description() {
    return {
      en: 'Zhihu site search only; returns Zhihu answers and articles.',
      zh: '仅搜索知乎站内内容，返回知乎问答与文章。',
    };
  }

  available() {
    const config = this.settings().zhihu;
    return config.enabled === true && isHTTPURL(config.baseURL);
  }

  async ready() {
    return (await this.resolveKey(this.settings().zhihu.apiKeyEnv)) !== undefined;
  }

  async search(request, signal) {
    const settings = this.settings();
    const target =
      Number.isSafeInteger(request.maxResults) && request.maxResults > 0 ? request.maxResults : 10;
    try {
      return await requestZhihu({
        mode: 'site',
        query: request.query,
        count: target,
        settings,
        resolveKey: this.resolveKey,
        signal,
      });
    } catch (error) {
      throw toWebError(error, 'Zhihu site', 'search');
    }
  }
}
