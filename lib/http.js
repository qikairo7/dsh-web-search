/** Shared HTTP helpers for provider adapters. */

import { errorMessage } from './errors.js';

/** A failed HTTP request, before it is mapped to a seam error. */
export class ProviderRequestError extends Error {
  constructor(message, { provider, operation, status, code = 'WEB_PROVIDER_ERROR', cause, retryAfterMs } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ProviderRequestError';
    this.provider = provider;
    this.operation = operation;
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

/** True for an absolute HTTP(S) URL. */
export function isHTTPURL(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Hard cap for one provider response body before parsing. */
export const MAX_RESPONSE_BODY_BYTES = 10_000_000;

/** Read the charset parameter from a Content-Type value, if present. */
function charsetFromContentType(contentType) {
  const match = /(?:^|;)\s*charset\s*=\s*"?([^";\s]+)"?/iu.exec(contentType);
  return match?.[1]?.trim().toLowerCase();
}

/** Decode bytes with the response charset; unknown charsets fall back to UTF-8. */
function decodeBody(bytes, contentType) {
  const charset = charsetFromContentType(contentType) ?? 'utf-8';
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

/**
 * Read a response body with a byte cap. The cap applies while reading, so a
 * server that sends an endless or oversized body cannot exhaust memory before
 * the limit is checked.
 *
 * @param {Response} response
 * @param {{
 *   maxBytes?: number,
 *   signal?: AbortSignal,
 *   timeoutSignal?: AbortSignal,
 *   provider?: string,
 *   operation?: string,
 *   timeoutMs?: number,
 *   timeoutCode?: string,
 *   tooLargeCode?: string,
 * }} options
 * @returns {Promise<string>}
 */
export async function readResponseText(response, options = {}) {
  const {
    maxBytes = MAX_RESPONSE_BODY_BYTES,
    signal,
    timeoutSignal,
    provider = 'provider',
    operation = 'request',
    timeoutMs,
    timeoutCode = 'WEB_PROVIDER_ERROR',
    tooLargeCode = 'WEB_PROVIDER_ERROR',
  } = options;

  const contentLength = Number(response.headers?.get?.('content-length') ?? NaN);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new ProviderRequestError(`${provider} ${operation} response exceeded ${maxBytes} bytes`, {
      provider,
      operation,
      status: response.status,
      code: tooLargeCode,
    });
  }
  if (response.body === null || response.body === undefined) {
    return typeof response.text === 'function' ? response.text() : '';
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new ProviderRequestError(`${provider} ${operation} response exceeded ${maxBytes} bytes`, {
          provider,
          operation,
          status: response.status,
          code: tooLargeCode,
        });
      }
      chunks.push(value);
    }
  } catch (error) {
    if (signal?.aborted === true) {
      throw new ProviderRequestError(`${provider} ${operation} aborted`, {
        provider,
        operation,
        code: 'WEB_ABORTED',
        cause: signal.reason ?? error,
      });
    }
    if (timeoutSignal?.aborted === true) {
      const suffix = timeoutMs === undefined ? '' : ` after ${timeoutMs} ms`;
      throw new ProviderRequestError(`${provider} ${operation} timed out${suffix}`, {
        provider,
        operation,
        code: timeoutCode,
        cause: error,
      });
    }
    if (error instanceof ProviderRequestError) throw error;
    throw new ProviderRequestError(`${provider} ${operation} response read failed: ${errorMessage(error)}`, {
      provider,
      operation,
      cause: error,
    });
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return decodeBody(bytes, response.headers.get('content-type') ?? '');
}

/** Parse a Retry-After header (seconds or HTTP date) into milliseconds, or undefined. */
function parseRetryAfterMs(value) {
  if (value === null || value === undefined) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(String(value));
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined;
}

/** Join a validated base URL with an endpoint path. */
export function joinURL(baseURL, path) {
  if (!isHTTPURL(baseURL)) {
    throw new ProviderRequestError(`invalid base URL "${String(baseURL)}"`, {
      provider: 'web-search-router',
      operation: 'request',
    });
  }
  const base = baseURL.trim().replace(/\/+$/u, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * Request JSON with a timeout and caller cancellation.
 *
 * @param {string} url
 * @param {{
 *   method?: string,
 *   headers?: Record<string, string>,
 *   body?: unknown,
 *   signal?: AbortSignal,
 *   timeoutMs?: number,
 *   timeoutCode?: string,
 *   provider?: string,
 *   operation?: string,
 * }} options
 * @returns {Promise<{ data: unknown, response: Response }>}
 */
export async function requestJSON(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    signal,
    timeoutMs = 60_000,
    timeoutCode = 'WEB_PROVIDER_ERROR',
    provider = 'provider',
    operation = 'request',
    redirect = 'error',
    parse = 'json',
  } = options;

  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort(
      new DOMException(`${provider} ${operation} timed out after ${timeoutMs} ms`, 'TimeoutError'),
    );
  }, timeoutMs);
  const requestSignal =
    signal === undefined ? timeoutController.signal : AbortSignal.any([signal, timeoutController.signal]);

  let response;
  try {
    response = await fetch(url, {
      method,
      redirect,
      headers: { accept: 'application/json', ...headers },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      signal: requestSignal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (signal?.aborted === true) {
      throw new ProviderRequestError(`${provider} ${operation} aborted`, {
        provider,
        operation,
        code: 'WEB_ABORTED',
        cause: signal.reason ?? error,
      });
    }
    if (timeoutController.signal.aborted) {
      throw new ProviderRequestError(`${provider} ${operation} timed out after ${timeoutMs} ms`, {
        provider,
        operation,
        code: timeoutCode,
        cause: error,
      });
    }
    throw new ProviderRequestError(`${provider} ${operation} request failed: ${errorMessage(error)}`, {
      provider,
      operation,
      cause: error,
    });
  }

  let text;
  try {
    text = await readResponseText(response, {
      signal,
      timeoutSignal: timeoutController.signal,
      provider,
      operation,
      timeoutMs,
      timeoutCode,
      tooLargeCode: 'WEB_PROVIDER_ERROR',
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = '';
    if (text.length > 0) {
      try {
        detail = extractErrorDetail(JSON.parse(text));
      } catch {
        detail = text;
      }
    }
    detail = detail.replace(/\s+/gu, ' ').trim().slice(0, 2_000);
    throw new ProviderRequestError(
      `${provider} ${operation} failed (HTTP ${response.status})${detail.length > 0 ? `: ${detail}` : ''}`,
      {
        provider,
        operation,
        status: response.status,
        code: response.status === 429 ? 'WEB_RATE_LIMITED' : 'WEB_PROVIDER_ERROR',
        retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')),
      },
    );
  }

  let data;
  if (parse === 'text') {
    data = text;
  } else if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new ProviderRequestError(`${provider} ${operation} returned invalid JSON: ${errorMessage(error)}`, {
        provider,
        operation,
        status: response.status,
        cause: error,
      });
    }
  }

  return { data, response };
}

/** Pull a useful diagnostic out of the common provider error shapes. */
function extractErrorDetail(data) {
  if (typeof data === 'string') return data;
  if (data === null || typeof data !== 'object') return '';
  if (typeof data.error === 'string') return data.error;
  if (data.error !== null && typeof data.error === 'object') {
    if (typeof data.error.message === 'string') return data.error.message;
    if (typeof data.error.error === 'string') return data.error.error;
  }
  if (typeof data.message === 'string') return data.message;
  if (typeof data.detail === 'string') return data.detail;
  if (data.detail !== null && typeof data.detail === 'object') {
    if (typeof data.detail.error === 'string') return data.detail.error;
  }
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => (item !== null && typeof item === 'object' && typeof item.msg === 'string' ? item.msg : ''))
      .filter((item) => item.length > 0)
      .join('; ');
  }
  return '';
}

/** Request a text/markdown body through the same timeout, redirect and error policy as requestJSON. */
export function requestText(url, options = {}) {
  return requestJSON(url, { ...options, parse: 'text' });
}
