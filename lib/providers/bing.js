/** Bing HTML SERP search provider: the keyless floor before the paid tail (ADR-0011). */

import { joinURL, isHTTPURL } from '../http.js';
import { webError } from '../errors.js';
import { decodeHtmlEntities } from '../clean.js';
import { resolveRouting } from '../routing.js';
import { clampCount, isProviderAvailable, providerOperation, USER_AGENT } from './shared.js';

export const BING_PROVIDER_ID = 'bing';

/**
 * Unwrap a bing.com/ck/a redirect: the real address is the `u` parameter
 * (base64url with an `a1` prefix). Undecodable or non-http payloads keep the
 * redirect link.
 */
export function unwrapBingUrl(href) {
  if (typeof href !== 'string' || href.length === 0) return href;
  const url = decodeHtmlEntities(href);
  if (!/^https?:\/\/(www\.)?bing\.com\/ck\/a/iu.test(url)) return href;
  try {
    const u = new URL(url).searchParams.get('u');
    if (u === null || u.length === 0) return href;
    const b64 = u.startsWith('a1') ? u.slice(2) : u;
    const decoded = Buffer.from(b64.replace(/-/gu, '+').replace(/_/gu, '/'), 'base64').toString('utf8');
    return /^https?:\/\//iu.test(decoded) ? decoded : href;
  } catch {
    return href;
  }
}

/** Query vocabulary for the relevance gate: CJK bigrams plus ASCII words. */
function overlapTokens(query) {
  const tokens = new Set();
  for (const run of String(query).match(/\p{Script=Han}+/gu) ?? []) {
    // Single CJK characters appear on almost any page; keep bigrams only.
    if (run.length === 2) tokens.add(run);
    for (let index = 0; index + 1 < run.length; index += 1) tokens.add(run.slice(index, index + 2));
  }
  for (const word of String(query).toLowerCase().split(/[^a-z0-9]+/u)) {
    if (word.length >= 2) tokens.add(word);
  }
  return [...tokens];
}

/**
 * True when the batch shares enough vocabulary with the query. Bing answers
 * zero-result queries with unrelated cache pages; a batch that fails this
 * gate counts as zero results so the fallback chain advances (ADR-0011).
 */
function batchLooksRelevant(query, sources) {
  const tokens = overlapTokens(query);
  // Pure-symbol/single-character queries cannot be judged reliably; let them through.
  if (tokens.length === 0) return true;
  const strong = tokens.filter((token) => !/^\d+$/u.test(token));
  const usable = strong.length > 0 ? strong : tokens;
  // A short ASCII token such as "gt" is usually a model suffix, not the
  // subject; a title hit needs a CJK bigram or an ASCII word of length 4+.
  const titleStrong = strong.filter((token) => /\p{Script=Han}/u.test(token) || token.length >= 4);
  const titleTokens = titleStrong.length > 0 ? titleStrong : usable;
  const matched = new Set();
  const titleMatched = new Set();
  let relevant = 0;
  for (const source of sources) {
    const title = String(source.title ?? '').toLowerCase();
    const hay = `${title} ${source.snippet ?? ''} ${source.url ?? ''}`.toLowerCase();
    const hits = usable.filter((token) => hay.includes(token));
    if (hits.length === 0) continue;
    relevant += 1;
    for (const hit of hits) matched.add(hit);
    for (const token of titleTokens) {
      if (title.includes(token)) titleMatched.add(token);
    }
  }
  const enoughSources = relevant >= Math.max(1, Math.ceil(sources.length / 3));
  const enoughTokens = matched.size >= Math.min(2, usable.length) || matched.size / usable.length >= 0.5;
  return enoughSources && enoughTokens && titleMatched.size > 0;
}

/** Strip tags from one HTML fragment and decode the entity subset. */
function textOf(fragment) {
  if (fragment === undefined) return '';
  return decodeHtmlEntities(String(fragment).replace(/<[^>]+>/gu, ' ')).replace(/\s+/gu, ' ').trim();
}

/**
 * Map a Bing SERP HTML body into seam sources. Zero `b_algo` blocks and
 * batches that fail the relevance gate both map to zero sources (ADR-0011).
 */
export function mapBingSearch(html, query, maxSnippetChars = 4000) {
  const blocks = String(html).match(/<li class="b_algo"[\s\S]*?<\/li>/gu) ?? [];
  const seen = new Set();
  const sources = [];
  for (const block of blocks) {
    const href = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"/u);
    if (href === null) continue;
    const url = unwrapBingUrl(href[1]);
    if (!isHTTPURL(url) || seen.has(url)) continue;
    seen.add(url);
    const title = textOf(block.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/u)?.[1]);
    const snippet = textOf(block.match(/<p[^>]*>([\s\S]*?)<\/p>/u)?.[1]).slice(0, maxSnippetChars);
    sources.push({
      url,
      ...(title.length > 0 ? { title } : {}),
      ...(snippet.length > 0 ? { snippet } : {}),
    });
  }
  if (sources.length > 0 && !batchLooksRelevant(query, sources)) {
    return { sources: [], truncated: false };
  }
  return { sources, truncated: false };
}

/** Keyless Bing search provider; no credentials, no metered quota. */
export class BingProvider {
  constructor({ settings }) {
    this.settings = settings;
  }

  get id() {
    return BING_PROVIDER_ID;
  }

  get title() {
    return 'Bing';
  }

  get description() {
    return {
      en: 'Keyless Bing web search over the public SERP; fallback floor before paid backends.',
      zh: '免 Key 的 Bing 网页搜索（公开 SERP）；付费后端之前的兜底地板。',
    };
  }

  available() {
    return isProviderAvailable(this.settings().bing);
  }

  async ready() {
    return true;
  }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.bing;
    // mkt is sent only when explicitly configured: overseas egress plus
    // mkt=zh-CN returns an empty SERP container (ADR-0011).
    const market = typeof config.market === 'string' ? config.market.trim() : '';
    const url = new URL(joinURL(config.baseURL, '/search'));
    url.searchParams.set('q', String(request.query ?? ''));
    if (market.length > 0) url.searchParams.set('mkt', market);
    const { language } = resolveRouting(request, settings);
    const result = await providerOperation({
      settings,
      provider: 'Bing',
      operation: 'search',
      text: true,
      url: url.toString(),
      request: {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html',
          'accept-language':
            market.length > 0 ? market : language === 'zh' ? 'zh-CN,zh;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
        },
        signal,
      },
      map: (html) => mapBingSearch(html, request.query, settings.maxSnippetChars),
    });
    // Zero sources must throw, not return: the runner ends the chain on any
    // successful return, so an empty floor hands over as a recoverable error.
    // One request per search, no retry — retrying an empty SERP from a
    // rate-shaped egress IP doubles requests and invites harder shaping.
    if (result.sources.length === 0) {
      throw webError('Bing search returned no relevant results', 'WEB_PROVIDER_ERROR');
    }
    return {
      sources: result.sources.slice(0, clampCount(request.maxResults, 10, 50)),
      truncated: false,
    };
  }
}
