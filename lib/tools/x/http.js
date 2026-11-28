/** Minimal HTTP transport and cookie jar for the X port.
 * Ported from catbus src/platforms/x@163424c67471d323ac3b1cb68e2b35a3427398ce (MIT).
 * Trimmed to JSON POST + cookie header; the real sender uses wreq-js (browser TLS fingerprint) and is injected in tests.
 */

import { webError } from '../../errors.js';
import { XSearchError } from './errors.js';
import { compactJson } from './py.js';

let sender = null;
const transports = new Map();

/** Replace the network sender (tests only); returns a restore function. */
export function setSender(fn) {
  const previous = sender;
  sender = fn;
  return () => {
    sender = previous;
  };
}

async function wreqSender(prepared, options) {
  const wreq = await import('wreq-js');
  const key = `${options.browser}|${options.os}`;
  let transport = transports.get(key);
  if (!transport) {
    transport = wreq.createTransport({ browser: options.browser, os: options.os });
    transports.set(key, transport);
  }
  return wreq.fetch(prepared.url, {
    method: prepared.method,
    headers: prepared.headers,
    body: prepared.body ?? undefined,
    transport: await transport,
    timeout: options.timeoutMs,
    redirect: 'manual',
    disableDefaultHeaders: true,
    signal: options.signal,
  });
}

/** Parse a browser cookie string ("a=1; b=2") or an exported JSON array into name/value pairs. */
export function parseCookies(input) {
  const text = String(input ?? '').trim();
  if (text.length === 0) return [];
  if (text.startsWith('[')) {
    let cookies;
    try {
      cookies = JSON.parse(text);
    } catch (cause) {
      throw new XSearchError('X cookie 不是合法的 JSON 数组：请重新从浏览器导出 cookie', 'X_COOKIE_INVALID', { cause });
    }
    return cookies.map((cookie) => ({ name: String(cookie.name), value: String(cookie.value) }));
  }
  const out = [];
  for (const part of text.replace(/^cookie:\s*/i, '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    if (name.length > 0) out.push({ name, value: part.slice(index + 1).trim() });
  }
  return out;
}

/** In-memory cookie jar: name lookup plus the Cookie header string. */
export class CookieJar {
  constructor(cookies = []) {
    this.cookies = cookies;
  }

  get(name) {
    return this.cookies.find((cookie) => cookie.name === name)?.value;
  }

  has(name) {
    return this.cookies.some((cookie) => cookie.name === name);
  }

  header() {
    return this.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  }
}

function prepare(request, jar) {
  const method = (request.method ?? 'GET').toUpperCase();
  const headers = [...(request.headers ?? [])];
  let body = null;
  if (request.json !== undefined) {
    body = compactJson(request.json);
    if (!headers.some(([name]) => name.toLowerCase() === 'content-type'))
      headers.push(['content-type', 'application/json']);
  }
  if (jar && jar.cookies.length > 0) {
    const at = headers.findIndex(([name]) => name.toLowerCase() === 'priority');
    headers.splice(at < 0 ? headers.length : at, 0, ['cookie', jar.header()]);
  }
  return { method, url: request.url, headers, body };
}

function toNetworkError(error) {
  if (error instanceof XSearchError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new XSearchError(`X 网络错误：${message}`, 'X_NETWORK', { cause: error });
}

/** One HTTP client bound to a cookie jar and a browser profile. */
export class XHttp {
  constructor({ browser, os = 'windows', timeoutMs = 30_000, jar }) {
    this.browser = browser;
    this.os = os;
    this.timeoutMs = timeoutMs;
    this.jar = jar;
  }

  async request(request, signal) {
    if (signal?.aborted === true) {
      throw webError('X 请求已取消', 'WEB_ABORTED', { cause: signal.reason });
    }
    const prepared = prepare(request, this.jar);
    const run = sender ?? wreqSender;
    try {
      return await run(prepared, { browser: this.browser, os: this.os, timeoutMs: this.timeoutMs, signal });
    } catch (error) {
      if (signal?.aborted === true) {
        throw webError('X 请求已取消', 'WEB_ABORTED', { cause: signal.reason ?? error });
      }
      throw toNetworkError(error);
    }
  }
}
