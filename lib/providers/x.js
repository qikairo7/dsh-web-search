/** X (Twitter) search backend: cookie-authenticated tweet search through the signed-in web endpoint. */

import { isHTTPURL } from '../http.js';
import { errorMessage, isAbortLike, isSeamError, webError } from '../errors.js';
import { clampCount } from './shared.js';
import { XClient } from '../tools/x/client.js';
import { searchWork } from '../tools/x/search.js';
import { item, tweetResults } from '../tools/x/normalize.js';

export const X_PROVIDER_ID = 'x';

/** Title excerpt length; the full tweet stays in the snippet. */
const TITLE_EXCERPT_CHARS = 80;

/** X error codes mapped onto the seam's recoverable failure vocabulary. */
const X_FAILURE_CODES = new Map([
  ['X_COOKIE_MISSING', 'WEB_PROVIDER_CREDENTIAL_MISSING'],
  ['X_COOKIE_INVALID', 'WEB_PROVIDER_CREDENTIAL_MISSING'],
  ['X_RISK_CONTROL', 'WEB_RATE_LIMITED'],
  ['X_UPSTREAM_CHANGED', 'WEB_INVALID_RESPONSE'],
  ['X_NETWORK', 'WEB_PROVIDER_ERROR'],
]);

/** Derive a display handle from the author profile URL. */
function authorHandle(url) {
  if (typeof url !== 'string') return '';
  try {
    return new URL(url).pathname.replace(/^\/+/u, '').trim();
  } catch {
    return '';
  }
}

/** Build the display title from the author and a one-line excerpt of the tweet. */
function tweetTitle(tweet, text) {
  const name = typeof tweet.author?.name === 'string' ? tweet.author.name.trim() : '';
  const handle = authorHandle(tweet.author?.url);
  const author = name.length > 0 ? name : handle.length > 0 ? `@${handle}` : '';
  const excerpt = text.replace(/\s+/gu, ' ').slice(0, TITLE_EXCERPT_CHARS);
  if (author.length === 0) return excerpt;
  return excerpt.length === 0 ? author : `${author}: ${excerpt}`;
}

/**
 * Map a SearchTimeline GraphQL payload into standard search sources.
 *
 * @param {unknown} response - the raw GraphQL response.
 * @param {number} [maxSnippetChars] - snippet bound.
 * @returns {{ sources: Array<object>, truncated: boolean }}
 */
export function mapXTweetSearch(response, maxSnippetChars = 4_000) {
  if (response === null || typeof response !== 'object') {
    throw webError('X response is not an object', 'WEB_INVALID_RESPONSE');
  }
  const sources = [];
  for (const raw of tweetResults(response)) {
    const tweet = item(raw);
    if (!isHTTPURL(tweet.url)) continue;
    const text = typeof tweet.text === 'string' ? tweet.text.trim() : '';
    const title = tweetTitle(tweet, text);
    const snippet = text.slice(0, maxSnippetChars);
    sources.push({
      url: tweet.url,
      ...(title.length > 0 ? { title } : {}),
      ...(snippet.length > 0 ? { snippet } : {}),
      ...(typeof tweet.created_at === 'string' && tweet.created_at.length > 0
        ? { publishedAt: tweet.created_at }
        : {}),
    });
  }
  return { sources, truncated: false };
}

/** Translate one X port error into the seam's error vocabulary. */
function xSearchError(error) {
  if (isSeamError(error)) return error;
  if (isAbortLike(error)) return webError('X search aborted', 'WEB_ABORTED', { cause: error });
  const mapped = typeof error?.code === 'string' ? X_FAILURE_CODES.get(error.code) : undefined;
  return webError(`X search failed: ${errorMessage(error)}`, mapped ?? 'WEB_PROVIDER_ERROR', { cause: error });
}

/** X tweet search backend; the cookie value is resolved per operation. */
export class XProvider {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  get id() {
    return X_PROVIDER_ID;
  }

  get title() {
    return 'X / Twitter';
  }

  get description() {
    return {
      en: 'X (Twitter) tweet search through the signed-in web endpoint; cookie auth, off by default.',
      zh: 'X（Twitter）推文搜索：用浏览器 cookie 走网页端，默认关闭。',
    };
  }

  available() {
    const config = this.settings().xTools ?? {};
    // The cookie value resolves asynchronously; ready() answers whether one is stored.
    return config.enabled === true
      && typeof config.cookieRef === 'string'
      && config.cookieRef.trim().length > 0;
  }

  async ready() {
    const config = this.settings().xTools ?? {};
    if (config.enabled !== true) return false;
    const reference = typeof config.cookieRef === 'string' ? config.cookieRef.trim() : '';
    if (reference.length === 0 || typeof this.resolveKey !== 'function') return false;
    try {
      return (await this.resolveKey(reference)) !== undefined;
    } catch {
      return false;
    }
  }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.xTools ?? {};
    if (config.enabled !== true) {
      throw webError('X search is disabled (xToolsEnabled=false)', 'WEB_PROVIDER_UNAVAILABLE');
    }
    const reference = typeof config.cookieRef === 'string' ? config.cookieRef.trim() : '';
    if (reference.length === 0) {
      throw webError('X cookie reference is not configured', 'WEB_PROVIDER_CREDENTIAL_MISSING');
    }
    try {
      const cookie = typeof this.resolveKey === 'function' ? await this.resolveKey(reference) : undefined;
      if (cookie === undefined) {
        throw webError(`X cookie credential is not configured (${reference})`, 'WEB_PROVIDER_CREDENTIAL_MISSING');
      }
      const timeoutMs = Math.min(Number(settings.requestTimeoutMs) || 30_000, 30_000);
      const client = new XClient({ cookie, timeoutMs });
      await client.init();
      const response = await searchWork(client, String(request.query ?? ''), {
        product: 'Top',
        count: clampCount(request.maxResults, 20, 100),
        signal,
      });
      return mapXTweetSearch(response, settings.maxSnippetChars);
    } catch (error) {
      throw xSearchError(error);
    }
  }
}
