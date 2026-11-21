/** Single-source routing roles: quality sets, fast prefixes, and default orders. */

import { keylessSearchFallback, paidSearchFallback, providersWithCapability } from './catalog.js';

/**
 * Free search roles per detected language and routed intent ('ai-news' = a
 * news query that is also about AI). `quality` is the parallel fan-out set;
 * `fast` is the intent-routed free prefix for fast mode, where `null` keeps
 * the settings-level order (general and community queries). Paid and keyless
 * backends never appear here; fast orders append the catalog keyless floor
 * and paid tail. Exa holds the free depth position as the last free hop
 * (ADR-0010); Bing is the keyless floor (ADR-0011).
 */
export const SEARCH_ROLES = Object.freeze({
  zh: Object.freeze({
    general: Object.freeze({ quality: ['zhihu', 'keenable', 'anysearch'], fast: null }),
    technical: Object.freeze({
      quality: ['zhihu', 'keenable', 'anysearch'],
      fast: ['keenable', 'anysearch', 'zhihu', 'github', 'exa'],
    }),
    news: Object.freeze({
      quality: ['zhihu', 'keenable', 'anysearch'],
      fast: ['zhihu', 'keenable', 'anysearch', 'exa'],
    }),
    'ai-news': Object.freeze({
      quality: ['aihot', 'keenable', 'anysearch', 'zhihu'],
      fast: ['aihot', 'zhihu', 'keenable', 'anysearch', 'exa'],
    }),
  }),
  en: Object.freeze({
    general: Object.freeze({ quality: ['keenable', 'anysearch'], fast: null }),
    technical: Object.freeze({ quality: ['keenable', 'anysearch'], fast: ['keenable', 'anysearch', 'github', 'exa'] }),
    news: Object.freeze({ quality: ['keenable', 'anysearch'], fast: ['keenable', 'anysearch', 'exa'] }),
    'ai-news': Object.freeze({
      quality: ['aihot', 'keenable', 'anysearch'],
      fast: ['aihot', 'keenable', 'anysearch', 'exa'],
    }),
  }),
});

/** Resolve one role row; unmapped intents (chinese-community) use the general row. */
export function searchRole(language, intent) {
  const table = language === 'zh' ? SEARCH_ROLES.zh : SEARCH_ROLES.en;
  return table[intent] ?? table.general;
}

/** Default settings-level orders: the free stack plus the keyless floor and the paid tail. */
const PAID_SEARCH = paidSearchFallback();
const KEYLESS_SEARCH = keylessSearchFallback();
const PAID_FETCH = PAID_SEARCH.filter((id) => providersWithCapability('fetch').includes(id));

export const DEFAULT_SEARCH_ORDERS = Object.freeze({
  chineseSearchOrder: Object.freeze([
    ...SEARCH_ROLES.zh.general.quality,
    'exa',
    ...KEYLESS_SEARCH,
    ...PAID_SEARCH,
  ]),
  defaultSearchOrder: Object.freeze([
    ...SEARCH_ROLES.en.general.quality,
    'exa',
    ...KEYLESS_SEARCH,
    ...PAID_SEARCH,
  ]),
  fetchOrder: Object.freeze(['keenable', 'http', 'anysearch', 'exa', ...PAID_FETCH]),
  cleanFetchOrder: Object.freeze(['keenable', 'anysearch', 'exa', 'http', ...PAID_FETCH]),
});
