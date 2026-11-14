/** Query intent classification for provider routing. */

import { hasHan } from './text.js';
import { TECH_PATTERN } from './technical.js';

const NEWS_PATTERN =
  /(新闻|最新|今天|今日|本周|本月|刚刚|发布|上线|release|news|announcement|changelog|update|2026|2025)/iu;
const COMMUNITY_PATTERN = /(怎么|如何|评价|推荐|经验|为什么|哪个|值得|知乎|教程|踩坑)/iu;
const AI_PATTERN =
  /(\bai\b|人工智能|大模型|模型|\bllm\b|deepseek|openai|anthropic|nvidia|gemini|claude|智能体|agent)/iu;

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
  if (settings.intentRouting !== true) {
    return hasHan(query) ? settings.chineseSearchOrder : settings.defaultSearchOrder;
  }
  if (hasHan(query)) {
    if (intent === 'news' && isAiQuery(query)) {
      return ['aihot', 'zhihu', 'keenable', 'anysearch', 'exa', 'tavily', 'firecrawl'];
    }
    if (intent === 'news') return ['zhihu', 'keenable', 'anysearch', 'exa', 'tavily', 'firecrawl'];
    if (intent === 'technical') return ['keenable', 'anysearch', 'zhihu', 'exa', 'tavily', 'firecrawl'];
    return settings.chineseSearchOrder;
  }
  if (intent === 'news' && isAiQuery(query)) {
    return ['aihot', 'keenable', 'anysearch', 'exa', 'tavily', 'firecrawl'];
  }
  if (intent === 'news') return ['keenable', 'anysearch', 'zhihu', 'exa', 'tavily', 'firecrawl'];
  if (intent === 'technical') return ['keenable', 'anysearch', 'zhihu', 'exa', 'tavily', 'firecrawl'];
  return settings.defaultSearchOrder;
}
