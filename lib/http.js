/** Shared HTTP helpers for provider adapters. */

import { errorMessage } from './errors.js';

/** A failed HTTP request, before it is mapped to a seam error. */
export class ProviderRequestError extends Error {
  constructor(message, { provider, operation, status, code = 'WEB_PROVIDER_ERROR', cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ProviderRequestError';
    this.provider = provider;
    this.operation = operation;
    this.status = status;
    this.code = code;
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
    text = await response.text();
  } catch (error) {
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
    throw new ProviderRequestError(`${provider} ${operation} response read failed: ${errorMessage(error)}`, {
      provider,
      operation,
      cause: error,
    });
  } finally {
    clearTimeout(timer);
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

  if (!response.ok) {
    const detail = extractErrorDetail(data);
    throw new ProviderRequestError(
      `${provider} ${operation} failed (HTTP ${response.status})${detail.length > 0 ? `: ${detail}` : ''}`,
      {
        provider,
        operation,
        status: response.status,
        code: response.status === 429 ? 'WEB_RATE_LIMITED' : 'WEB_PROVIDER_ERROR',
      },
    );
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
