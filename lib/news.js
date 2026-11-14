/** Language-aware news-domain priority and filtering. */

import { hasHan } from './text.js';

const ZH_NEWS_HOSTS = new Set([
  '163.com',
  '36kr.com',
  'caixin.com',
  'chinanews.com.cn',
  'cnbeta.com',
  'geekpark.net',
  'huanqiu.com',
  'ifeng.com',
  'ithome.com',
  'jiemian.com',
  'people.com.cn',
  'qq.com',
  'sina.com.cn',
  'sohu.com',
  'thepaper.cn',
  'xinhuanet.com',
  'yicai.com',
]);

const ZH_MAINSTREAM_HOSTS = new Set(['163.com', 'chinanews.com.cn', 'sohu.com', 'thepaper.cn']);

const EN_NEWS_HOSTS = new Set([
  'apnews.com',
  'arstechnica.com',
  'bbc.com',
  'bloomberg.com',
  'cnn.com',
  'ft.com',
  'nytimes.com',
  'reuters.com',
  'techcrunch.com',
  'techrepublic.com',
  'theinformation.com',
  'theverge.com',
  'venturebeat.com',
  'wired.com',
]);

/** Return `zh`, `en`, or undefined for a news URL. */
export function newsDomainLanguage(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./u, '');
    if (ZH_NEWS_HOSTS.has(host)) return 'zh';
    if (EN_NEWS_HOSTS.has(host)) return 'en';
    return undefined;
  } catch {
    return undefined;
  }
}

/** True when a URL belongs to a known news domain for the given language. */
export function isNewsDomain(url, language) {
  const domainLanguage = newsDomainLanguage(url);
  return domainLanguage !== undefined && (language === undefined || domainLanguage === language);
}

/** Ranking boost for news; mainstream Chinese outlets rank above other news. */
export function newsBoostValue(url, language) {
  const domainLanguage = newsDomainLanguage(url);
  if (domainLanguage === undefined || domainLanguage !== language) return 0;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./u, '');
    if (domainLanguage === 'zh' && ZH_MAINSTREAM_HOSTS.has(host)) return 0.2;
  } catch {
    return 0;
  }
  return 0.12;
}

/** Drop news sources that belong to the other language; also match title language. */
export function filterNewsLanguage(sources, language) {
  return sources.filter((source) => {
    const domainLanguage = newsDomainLanguage(source.url);
    if (domainLanguage !== undefined) return domainLanguage === language;
    const title = typeof source.title === 'string' ? source.title.trim() : '';
    if (title.length === 0) return true;
    return language === 'zh' ? hasHan(title) : !hasHan(title);
  });
}
