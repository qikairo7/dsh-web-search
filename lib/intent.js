/** Query intent classification for provider routing. */

import { hasHan } from './text.js';

const NEWS_PATTERN =
  /(新闻|最新|今天|今日|本周|本月|刚刚|发布|上线|release|news|announcement|changelog|update|2026|2025)/iu;
const TECH_PATTERN =
  /(api|sdk|npm|node|python|javascript|typescript|代码|编程|开发|插件|文档|框架|部署|安装|报错|错误|bug|error|github|docs|documentation|config|配置|接口)/iu;
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

/** Pick the two providers used by quality mode. */
export function qualityPair(query, intent) {
  const chinese = hasHan(query);
  if (intent === 'news' && isAiQuery(query)) return ['aihot', 'tavily'];
  if (chinese) {
    if (intent === 'news') return ['zhihu', 'tavily'];
    if (intent === 'technical') return ['anysearch', 'zhihu'];
    return ['zhihu', 'anysearch'];
  }
  if (intent === 'news') return ['tavily', 'anysearch'];
  return ['anysearch', 'tavily'];
}

/** Pick the fast-mode order for a query. */
export function fastOrder(query, settings, intent) {
  if (settings.intentRouting !== true) {
    return hasHan(query) ? settings.chineseSearchOrder : settings.defaultSearchOrder;
  }
  if (hasHan(query)) {
    if (intent === 'news' && isAiQuery(query)) {
      return ['aihot', 'zhihu', 'tavily', 'anysearch', 'firecrawl'];
    }
    if (intent === 'news') return ['zhihu', 'tavily', 'anysearch', 'firecrawl'];
    if (intent === 'technical') return ['anysearch', 'zhihu', 'tavily', 'firecrawl'];
    return settings.chineseSearchOrder;
  }
  if (intent === 'news' && isAiQuery(query)) {
    return ['aihot', 'tavily', 'anysearch', 'zhihu', 'firecrawl'];
  }
  if (intent === 'news') return ['tavily', 'anysearch', 'zhihu', 'firecrawl'];
  if (intent === 'technical') return ['anysearch', 'tavily', 'zhihu', 'firecrawl'];
  return settings.defaultSearchOrder;
}
