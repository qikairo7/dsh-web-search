/** X web session: cookie auth, GraphQL POST, and error mapping.
 * Ported from catbus src/platforms/x@163424c67471d323ac3b1cb68e2b35a3427398ce (MIT).
 * Read-only search subset: login is cookie-only and the write/mutation paths are not ported.
 */

import { XSearchError, upstreamChanged } from './errors.js';
import { GraphQLOperation } from './graphql.js';
import { CookieJar, XHttp, parseCookies } from './http.js';
import { BROWSER, PROFILE, buildGraphqlHeaders } from './profile.js';
import { transaction } from './transaction.js';

/** GraphQL error codes that mean the session is gone (353 = ct0 mismatch). */
const AUTH_CODES = new Set([32, 89, 215, 326, 353]);
/** Rate-limit / risk codes: 88 rate limit, 226 automated, 344 daily cap. */
const RISK_CODES = new Set([88, 226, 344]);

/** twid cookie is like `u%3D1718802931036622848`; pull the numeric user id. */
function userIdFromTwid(twid) {
  return (twid ?? '').replace('u%3D', '').replace('u=', '').replace(/"/g, '').trim();
}

/** One authenticated X web session. */
export class XClient {
  constructor({ cookie, timeoutMs = 30_000, browser = BROWSER, os = 'windows' }) {
    this.jar = new CookieJar(parseCookies(cookie));
    this.http = new XHttp({ browser, os, timeoutMs, jar: this.jar });
  }

  get isLoggedIn() {
    return Boolean(this.jar.get('auth_token'));
  }

  get ct0() {
    return this.jar.get('ct0') ?? '';
  }

  get lang() {
    return (this.jar.get('lang') || PROFILE.clientLanguage).toLowerCase();
  }

  get userId() {
    return userIdFromTwid(this.jar.get('twid'));
  }

  /** Validate a usable cookie pair before any request. */
  async init() {
    if (!this.isLoggedIn) {
      throw new XSearchError('未配置 X cookie 的 auth_token：请把浏览器导出的 x.com cookie 存入凭据库', 'X_COOKIE_MISSING');
    }
    if (!this.ct0) {
      throw new XSearchError('X cookie 含 auth_token 但缺 ct0：请把浏览器 cookie 完整复制过来', 'X_COOKIE_INVALID');
    }
  }

  view() {
    return { ct0: this.ct0, lang: this.lang, loggedIn: this.isLoggedIn };
  }

  /** POST a query-type GraphQL operation (SearchTimeline). */
  async graphqlPostQuery(operationName, variables, options = {}) {
    const op = new GraphQLOperation(operationName);
    const res = await this.http.request({
      method: 'POST',
      url: op.url(),
      json: op.jsonBody(variables),
      headers: buildGraphqlHeaders(op.url(), this.view(), {
        xctid: transaction().generate('POST', op.path()),
        referer: options.referer,
      }),
    });
    return this.checkGraphQL(res, operationName);
  }

  async checkGraphQL(res, operation) {
    const body = await this.readJson(res, operation);
    const errors = body?.errors;
    if (Array.isArray(errors) && errors.length > 0) throw this.mapErrors(errors, operation, res.status);
    return body;
  }

  async readJson(res, operation) {
    const text = await res.text();
    if (!res.ok) throw this.httpError(res.status, text, operation);
    try {
      return JSON.parse(text);
    } catch {
      throw upstreamChanged(`X 返回的不是 JSON（HTTP ${res.status}）`);
    }
  }

  httpError(status, text, operation) {
    let errors;
    try {
      errors = JSON.parse(text)?.errors;
    } catch {
      errors = undefined;
    }
    if (Array.isArray(errors) && errors[0]?.code != null) return this.mapErrors(errors, operation, status);
    if (status === 401 || status === 403) {
      return new XSearchError(`X 登录态失效或 cookie 无效（HTTP ${status}）：请重新导入浏览器 cookie`, 'X_COOKIE_INVALID');
    }
    if (status === 429) return new XSearchError('X 限流（HTTP 429）：请稍后再试', 'X_RISK_CONTROL');
    if (status === 400 || status === 404 || status === 422) return upstreamChanged(`X 接口返回 HTTP ${status}`);
    return new XSearchError(`X 返回 HTTP ${status}`, 'X_UPSTREAM');
  }

  mapErrors(errors, operation, status) {
    const code = errors[0]?.code;
    const message = errors.map((error) => error?.message ?? error).join('; ');
    if (code != null && AUTH_CODES.has(Number(code))) return new XSearchError(`X 登录态失效：${message}`, 'X_COOKIE_INVALID');
    if (code != null && RISK_CODES.has(Number(code))) return new XSearchError(`X 风控/限流：${message}`, 'X_RISK_CONTROL');
    return upstreamChanged(message);
  }
}
