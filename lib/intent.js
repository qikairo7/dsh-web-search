/** Query intent classification for provider routing. */

import { paidSearchFallback } from './catalog.js';
import { hasHan } from './text.js';
import { TECH_PATTERN } from './technical.js';

const currentYear = new Date().getFullYear();
// shortcut: year list is fixed at module load; a query naming a newer year
// reads as non-news until the process restarts, recompile per call when that matters
const NEWS_PATTERN = new RegExp(
  `(新闻|最新|今天|今日|本周|本月|刚刚|发布|上线|release|news|announcement|changelog|update|${currentYear}|${currentYear - 1})`,
  'iu',
);
const COMMUNITY_PATTERN = /(怎么|如何|评价|推荐|经验|为什么|哪个|值得|知乎|教程|踩坑)/iu;
const AI_PATTERN =
  /(\bai\b|人工智能|大模型|模型|\bllm\b|deepseek|openai|anthropic|nvidia|gemini|claude|智能体|agent)/iu;

// Free fast-mode prefixes keyed by language and routed intent ('ai-news' is a
// news query that is also about AI). fastOrder appends the catalog's paid
// search fallback after whichever prefix applies.
const FAST_FREE_PREFIXES = {
  chinese: {
    'ai-news': ['aihot', 'zhihu', 'keenable', 'anysearch'],
    news: ['zhihu', 'keenable', 'anysearch'],
    technical: ['keenable', 'anysearch', 'zhihu'],
  },
  english: {
    'ai-news': ['aihot', 'keenable', 'anysearch'],
    news: ['keenable', 'anysearch', 'zhihu'],
    technical: ['keenable', 'anysearch', 'zhihu'],
  },
};

/** True for queries that are specifically about AI news/topics. */
export function isAiQuery(query) {
  return AI_PATTERN.test(query);
}

/** Classify a query into one of the routing intents. */
export function classifyIntent(query) {
  if (NEWS_PATTERN.test(query)) return 'news';
  if (TECH_PATTERN.test(query)) return 'technical';
  if (hasHan(query) && COMMUNITY_PATTERN.test(query)) return 'chinese-community';
  return 'general';
}

/** Pick the free providers used by quality mode; paid backends remain fallback-only. */
export function qualityPair(query, intent) {
  const chinese = hasHan(query);
  if (intent === 'news' && isAiQuery(query)) return ['aihot', 'keenable', 'anysearch', 'zhihu'];
  if (chinese) return ['zhihu', 'keenable', 'anysearch'];
  return ['keenable', 'anysearch', 'zhihu'];
}

/** Pick the fast-mode order for a query. */
export function fastOrder(query, settings, intent) {
  const chinese = hasHan(query);
  if (settings.intentRouting !== true) {
    return chinese ? settings.chineseSearchOrder : settings.defaultSearchOrder;
  }
  const prefixes = chinese ? FAST_FREE_PREFIXES.chinese : FAST_FREE_PREFIXES.english;
  const prefix = prefixes[intent === 'news' && isAiQuery(query) ? 'ai-news' : intent];
  if (prefix === undefined) {
    return chinese ? settings.chineseSearchOrder : settings.defaultSearchOrder;
  }
  return [...prefix, ...paidSearchFallback()];
}
