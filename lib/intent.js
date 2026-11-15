/** Query intent classification for provider routing. */

import { paidSearchFallback } from './catalog.js';
import { searchRole } from './roles.js';
import { hasHan } from './text.js';
import { TECH_PATTERN } from './technical.js';

// The news year list follows the clock; the pattern rebuilds when the year rolls over.
let newsCache = { year: -1, pattern: null };
const COMMUNITY_PATTERN = /(怎么|如何|评价|推荐|经验|为什么|哪个|值得|知乎|教程|踩坑)/iu;
const AI_PATTERN =
  /(\bai\b|人工智能|大模型|模型|\bllm\b|deepseek|openai|anthropic|nvidia|gemini|claude|智能体|agent)/iu;

/** True for queries that are specifically about AI news/topics. */
export function isAiQuery(query) {
  return AI_PATTERN.test(query);
}

/** Classify a query into one of the routing intents. */
export function classifyIntent(query) {
  const year = new Date().getFullYear();
  if (year !== newsCache.year) {
    newsCache = {
      year,
      pattern: new RegExp(
        `(新闻|最新|今天|今日|本周|本月|刚刚|发布|上线|release|news|announcement|changelog|update|${year}|${year - 1})`,
        'iu',
      ),
    };
  }
  if (newsCache.pattern.test(query)) return 'news';
  if (TECH_PATTERN.test(query)) return 'technical';
  if (hasHan(query) && COMMUNITY_PATTERN.test(query)) return 'chinese-community';
  return 'general';
}

/** Map a routed intent onto its role-table key. */
function roleKey(query, intent) {
  if (intent === 'news' && isAiQuery(query)) return 'ai-news';
  return intent;
}

/** Pick the free quality set for a query; paid backends remain fallback-only (ADR-0010). */
export function qualityPair(query, intent) {
  return searchRole(hasHan(query) ? 'zh' : 'en', roleKey(query, intent)).quality;
}

/** Pick the fast-mode order for a query. */
export function fastOrder(query, settings, intent) {
  const chinese = hasHan(query);
  if (settings.intentRouting !== true) {
    return chinese ? settings.chineseSearchOrder : settings.defaultSearchOrder;
  }
  const { fast } = searchRole(chinese ? 'zh' : 'en', roleKey(query, intent));
  if (fast === null) {
    return chinese ? settings.chineseSearchOrder : settings.defaultSearchOrder;
  }
  return [...fast, ...paidSearchFallback()];
}
