/** X web device profile and request-header assembly.
 * Ported from catbus src/platforms/x@163424c67471d323ac3b1cb68e2b35a3427398ce (MIT).
 */

export const PUBLIC_BEARER =
  'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

export const PROFILE = {
  ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  secChUa: '"Google Chrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"',
  secChUaMobile: '?0',
  secChUaPlatform: '"Windows"',
  acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7,ja;q=0.6',
  clientLanguage: 'zh-CN',
};

/** wreq-js tops out at chrome_149; the UA header is raised to 153 to match X's live build. */
export const BROWSER = 'chrome_149';
export const X_HOST = 'https://x.com';
export const COOKIE_DOMAIN = '.x.com';

function secFetchSite(url) {
  const host = (new URL(url).hostname || '').toLowerCase();
  if (host === 'x.com' || host === 'www.x.com') return 'same-origin';
  if (host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) return 'same-site';
  return 'cross-site';
}

/** Browser-general headers appended after the X-specific ones (live header order). */
export function fetchHeaders(url) {
  return [
    ['user-agent', PROFILE.ua],
    ['sec-ch-ua', PROFILE.secChUa],
    ['sec-ch-ua-mobile', PROFILE.secChUaMobile],
    ['sec-ch-ua-platform', PROFILE.secChUaPlatform],
    ['accept', '*/*'],
    ['accept-language', PROFILE.acceptLanguage],
    ['priority', 'u=1, i'],
    ['sec-fetch-site', secFetchSite(url)],
    ['sec-fetch-mode', 'cors'],
    ['sec-fetch-dest', 'empty'],
  ];
}

/** GraphQL request headers in the order a real browser sends them. */
export function buildGraphqlHeaders(url, auth, options = {}) {
  const x = [['content-type', 'application/json'], ['authorization', PUBLIC_BEARER]];
  if (auth.loggedIn) x.push(['x-twitter-auth-type', 'OAuth2Session']);
  x.push(['x-csrf-token', auth.ct0], ['x-twitter-client-language', auth.lang], ['x-twitter-active-user', 'yes']);
  if (options.xctid) x.push(['x-client-transaction-id', options.xctid]);
  if (options.referer) x.push(['referer', options.referer]);
  return [...x, ...fetchHeaders(url)];
}
