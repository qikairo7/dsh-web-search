/** Direct HTTP(S) fetch provider. HTML is returned to the tool layer for Markdown conversion. */

import { isHTTPURL } from '../http.js';
import { errorMessage } from '../errors.js';
import { webError } from '../errors.js';

export const HTTP_PROVIDER_ID = 'http';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 5_000_000;
const USER_AGENT = 'dsh-web-search-router/0.1.0';

/** Classify a content type as an accepted textual body kind. */
function contentKind(contentType) {
  const type = contentType.split(';', 1)[0].trim().toLowerCase();
  if (type === 'text/html' || type === 'application/xhtml+xml') return 'html';
  if (
    type.startsWith('text/') ||
    type === 'application/json' ||
    type.endsWith('+json') ||
    type === 'application/xml' ||
    type.endsWith('+xml') ||
    type === 'application/javascript' ||
    type === 'application/x-javascript'
  ) {
    return 'text';
  }
  return undefined;
}

/** True when a small HTML body is likely an empty client-rendered app shell. */
function looksLikeSpaShell(html, minChars) {
  if (html.length >= minChars) return false;
  return (
    /<script[\s>]/iu.test(html) &&
    /(id=["'](?:root|app|__next)["']|__NEXT_DATA__|__NUXT__|data-reactroot|window\.__INITIAL_STATE__)/iu.test(
      html,
    )
  );
}

/** Direct HTTP(S) fetch provider. */
export class HttpFetchProvider {
  constructor({ settings }) {
    this.settings = settings;
  }

  get id() {
    return HTTP_PROVIDER_ID;
  }

  get title() {
    return 'HTTP';
  }

  get description() {
    return {
      en: 'Anonymous direct HTTP(S) fetch; HTML is converted by the built-in web_fetch tool.',
      zh: '匿名直连 HTTP(S) 抓取；HTML 由内置 web_fetch 工具转换为 Markdown。',
    };
  }

  available() {
    return this.settings().http.enabled === true;
  }

  async ready() {
    return true;
  }

  async fetch(request, signal) {
    const settings = this.settings();
    if (!isHTTPURL(request.url)) {
      throw webError('url must be an absolute HTTP(S) URL', 'WEB_INVALID_URL');
    }
    const timeout = AbortSignal.timeout(settings.requestTimeoutMs);
    const requestSignal = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);

    let current = request.url;
    let response;
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        response = await fetch(current, {
          redirect: 'manual',
          headers: {
            'user-agent': USER_AGENT,
            accept: 'text/html,application/xhtml+xml,application/pdf,text/plain,*/*',
          },
          signal: requestSignal,
        });
        if (!REDIRECT_STATUSES.has(response.status)) break;
        const location = response.headers.get('location');
        if (location === null) break;
        if (hop === MAX_REDIRECTS) {
          throw webError(`HTTP fetch exceeded ${MAX_REDIRECTS} redirects`, 'WEB_REDIRECT_BLOCKED');
        }
        const next = new URL(location, current);
        if (next.protocol !== 'http:' && next.protocol !== 'https:') {
          throw webError('HTTP fetch redirected to a non-HTTP URL', 'WEB_REDIRECT_BLOCKED');
        }
        await response.body?.cancel().catch(() => {});
        current = next.href;
      }
    } catch (error) {
      if (error?.name === 'WebError') throw error;
      if (signal?.aborted === true) {
        throw webError('HTTP fetch aborted', 'WEB_ABORTED', { cause: signal.reason ?? error });
      }
      if (error?.name === 'TimeoutError' || timeout.aborted === true) {
        throw webError(`HTTP fetch timed out after ${settings.requestTimeoutMs} ms`, 'WEB_FETCH_TIMEOUT', {
          cause: error,
        });
      }
      throw webError(`HTTP fetch failed: ${errorMessage(error)}`, 'WEB_PROVIDER_ERROR', { cause: error });
    }

    if (response === undefined) {
      throw webError('HTTP fetch produced no response', 'WEB_PROVIDER_ERROR');
    }
    if (response.status === 403 || response.status === 429 || response.status >= 500) {
      throw webError(
        `HTTP fetch failed (HTTP ${response.status})`,
        response.status === 429 ? 'WEB_RATE_LIMITED' : 'WEB_PROVIDER_ERROR',
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    const kind = contentKind(contentType);
    if (kind === undefined) {
      throw webError(
        `HTTP fetch does not support content type ${contentType.length > 0 ? contentType : '(missing)'}`,
        'WEB_UNSUPPORTED_CONTENT_TYPE',
      );
    }

    let buffer;
    try {
      buffer = await response.arrayBuffer();
    } catch (error) {
      if (signal?.aborted === true) {
        throw webError('HTTP fetch aborted', 'WEB_ABORTED', { cause: signal.reason ?? error });
      }
      throw webError(`HTTP fetch response read failed: ${errorMessage(error)}`, 'WEB_PROVIDER_ERROR', {
        cause: error,
      });
    }
    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      throw webError(
        `HTTP fetch response exceeded ${MAX_RESPONSE_BYTES} bytes`,
        'WEB_FETCH_TOO_LARGE',
      );
    }
    const text = new TextDecoder().decode(buffer);
    if (kind === 'html' && looksLikeSpaShell(text, settings.minDirectHtmlChars)) {
      throw webError(
        'HTTP fetch returned a small client-rendered app shell; fallback to an API fetch provider',
        'WEB_PROVIDER_ERROR',
      );
    }
    const truncated = text.length > settings.maxFetchChars;
    return {
      url: current,
      statusCode: response.status,
      body: { kind, content: truncated ? text.slice(0, settings.maxFetchChars) : text },
      truncated,
    };
  }
}
