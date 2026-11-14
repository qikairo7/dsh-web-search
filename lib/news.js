/** News-domain priority for `news` intent ranking. */

const NEWS_HOSTS = new Set([
  // Chinese
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
  // English
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

/** True when a URL belongs to a known news domain. */
export function isNewsDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./u, '');
    return NEWS_HOSTS.has(host);
  } catch {
    return false;
  }
}
