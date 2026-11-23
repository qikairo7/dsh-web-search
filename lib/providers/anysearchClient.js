/**
 * AnySearch HTTP client ported from @anysearch/anysearch-dsh 0.1.8 (MIT).
 * Copyright (c) 2026 AnySearch Team. See THIRD_PARTY_NOTICES.md for the license text.
 */

import { createRequire } from 'node:module';

import { MAX_RESPONSE_BODY_BYTES, ProviderRequestError, readResponseText } from '../http.js';

const { version } = createRequire(import.meta.url)('../../package.json');

/** Shared HTTP client for every AnySearch provider and tool operation. */
export const ANYSEARCH_DSH_CLIENT_ID = `dsh/${version}`;
/** Official AnySearch client deadline; keep below the 60s AnySearch tool budget. */
export const ANYSEARCH_HTTP_TIMEOUT_MS = 55_000;
const MAX_CANONICAL_CONTENT_CHARS = 200_000;
const MAX_UPSTREAM_ERROR_CHARS = 2_000;

/** Public AnySearch API origin. */
export const ANYSEARCH_DEFAULT_BASE_URL = 'https://api.anysearch.com';
const API_KEY_PLACEHOLDERS = new Set([
  'ANYSEARCH_API_KEY',
  'as_sk_your_key',
]);
/** Safe HTTP and credential failure surfaced by the shared client. */
export class AnySearchClientError extends Error {
  /** Failure category used by Harness adapters. */
  kind;
  /** Operation that failed. */
  operation;
  /** Upstream HTTP status when a response arrived. */
  httpStatus;
  /** Authentication mode used for an upstream response. */
  authentication;
  /** AnySearch request id when the response supplied one. */
  requestId;
  /** Upstream retry delay retained for diagnostics; the client never retries. */
  retryAfter;
  /** Stable AnySearch business error code when the response supplied one. */
  errorCode;
  constructor(message, options) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AnySearchClientError';
    this.kind = options.kind ?? 'provider';
    this.operation = options.operation;
    if (options.httpStatus !== undefined)
      this.httpStatus = options.httpStatus;
    if (options.authentication !== undefined)
      this.authentication = options.authentication;
    if (options.requestId !== undefined)
      this.requestId = options.requestId;
    if (options.retryAfter !== undefined)
      this.retryAfter = options.retryAfter;
    if (options.errorCode !== undefined)
      this.errorCode = options.errorCode;
  }
}
/** HTTP client shared by the native Provider and AnySearch-specific tools. */
export class AnySearchClient {
  options;
  constructor(options) {
    this.options = options;
    this.timeoutMs = options.timeoutMs ?? ANYSEARCH_HTTP_TIMEOUT_MS;
  }
  /** Whether the configured base URL can produce public HTTP endpoints. */
  available() {
    return endpoint(this.options.baseURL, '/v1/search') !== undefined;
  }
  /** Execute one search and validate its complete response. */
  async search(request, signal) {
    const envelope = await this.request('/v1/search', 'search', {
      method: 'POST',
      body: JSON.stringify({
        query: request.query,
        ...request.maxResults !== undefined ? { max_results: request.maxResults } : {},
        ...request.tag !== undefined ? { tag: request.tag } : {},
        ...request.params !== undefined ? { params: request.params } : {},
        ...request.zone !== undefined ? { zone: request.zone } : {},
        ...request.language !== undefined ? { language: request.language } : {},
      }),
    }, signal);
    return parseOperationData('search', envelope, parseSearchData);
  }
  /** Extract and validate the cleaned content of one public HTTP(S) URL. */
  async extract(request, signal) {
    const envelope = await this.request('/v1/extract', 'extract', {
      method: 'POST',
      body: JSON.stringify({ url: request.url }),
    }, signal);
    return parseOperationData('extract', envelope, (value) => parseExtractData(value, request.url));
  }
  /** List all top-level domains in the dynamic capability catalog. */
  async listDomains(signal) {
    const envelope = await this.request('/v1/domains', 'domains', { method: 'GET' }, signal);
    return parseOperationData('domains', envelope, parseDomainsData);
  }
  /** Read detailed capabilities for the supplied ordered domain names. */
  async getSubDomains(domains, signal) {
    const query = new URLSearchParams();
    for (const domain of domains)
      query.append('domain', domain);
    const suffix = query.toString();
    const envelope = await this.request(`/v1/sub-domains${suffix.length > 0 ? `?${suffix}` : ''}`, 'sub_domains', { method: 'GET' }, signal);
    return parseOperationData('sub_domains', envelope, parseSubDomainsData);
  }
  async request(path, operation, init, signal) {
    const url = endpoint(this.options.baseURL, path);
    if (url === undefined) {
      throw new AnySearchClientError('AnySearch base URL is invalid', { operation });
    }
    const apiKey = await this.resolveApiKey(operation, signal);
    const authentication = apiKey === undefined ? 'anonymous' : 'credential';
    const headers = {
      'accept': 'application/json',
      'user-agent': ANYSEARCH_DSH_CLIENT_ID,
      'x-anysearch-client': ANYSEARCH_DSH_CLIENT_ID,
    };
    if (init.body !== undefined)
      headers['content-type'] = 'application/json';
    if (apiKey !== undefined)
      headers.authorization = `Bearer ${apiKey}`;
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => {
      timeoutController.abort(new DOMException('AnySearch HTTP request timed out', 'TimeoutError'));
    }, this.timeoutMs);
    const requestSignal = signal === undefined
      ? timeoutController.signal
      : AbortSignal.any([signal, timeoutController.signal]);
    let response;
    try {
      response = await fetch(url, {
        method: init.method,
        redirect: 'error',
        headers,
        ...init.body === undefined ? {} : { body: init.body },
        signal: requestSignal,
      });
    }
    catch (error) {
      clearTimeout(timeout);
      if (signal?.aborted === true)
        throw aborted(operation, signal, error);
      if (timeoutController.signal.aborted)
        throw timedOut(operation, error, this.timeoutMs);
      if (isAbortError(error))
        throw aborted(operation, signal, error);
      throw new AnySearchClientError(`AnySearch ${operation} request failed: ${String(error)}`, { operation, cause: error });
    }
    const retryAfter = response.headers.get('retry-after') ?? undefined;
    let value;
    try {
      const text = await readResponseText(response, {
        maxBytes: MAX_RESPONSE_BODY_BYTES,
        signal,
        timeoutSignal: timeoutController.signal,
        provider: 'AnySearch',
        operation,
        timeoutMs: this.timeoutMs,
      });
      value = JSON.parse(text);
    }
    catch (error) {
      if (signal?.aborted === true)
        throw aborted(operation, signal, error);
      if (timeoutController.signal.aborted)
        throw timedOut(operation, error, this.timeoutMs);
      if (isAbortError(error))
        throw aborted(operation, signal, error);
      if (error instanceof ProviderRequestError) {
        throw new AnySearchClientError(error.message, {
          operation,
          httpStatus: response.status,
          ...retryAfter === undefined ? {} : { retryAfter },
          cause: error,
        });
      }
      if (!response.ok) {
        throw upstreamError(operation, `API error`, response.status, authentication, undefined, retryAfter);
      }
      throw new AnySearchClientError(`AnySearch ${operation} returned invalid JSON: ${String(error)}`, {
        operation,
        httpStatus: response.status,
        ...retryAfter === undefined ? {} : { retryAfter },
        cause: error,
      });
    }
    finally {
      clearTimeout(timeout);
    }
    const diagnosticRequestId = optionalStringField(value, 'request_id');
    const diagnosticErrorCode = optionalStringField(value, 'error_code');
    if (!response.ok) {
      const message = messageField(value) ?? 'API error';
      throw upstreamError(operation, message, response.status, authentication, diagnosticRequestId, retryAfter, diagnosticErrorCode);
    }
    try {
      const envelope = record(value, 'response');
      const requestId = optionalStringRecordField(envelope, 'request_id', 'request_id');
      const code = numberField(envelope, 'code', 'code');
      const message = optionalStringRecordField(envelope, 'message', 'message') ?? '';
      if (code !== 0) {
        throw upstreamError(operation, message.length > 0 ? message : `API error ${code}`, response.status, authentication, requestId, retryAfter, optionalStringRecordField(envelope, 'error_code', 'error_code'));
      }
      return {
        data: record(envelope.data, 'data'),
        ...requestId === undefined ? {} : { requestId },
      };
    }
    catch (error) {
      if (error instanceof AnySearchClientError)
        throw error;
      throw new AnySearchClientError(`AnySearch ${operation} returned an invalid response: ${errorMessage(error)}`, {
        operation,
        httpStatus: response.status,
        ...diagnosticRequestId === undefined ? {} : { requestId: diagnosticRequestId },
        ...retryAfter === undefined ? {} : { retryAfter },
        cause: error,
      });
    }
  }
  async resolveApiKey(operation, signal) {
    if (signal?.aborted === true)
      throw aborted(operation, signal);
    let value;
    try {
      value = await abortable(this.options.resolveApiKey(), signal);
    }
    catch (error) {
      if (isSignalAborted(signal) || isAbortError(error))
        throw aborted(operation, signal, error);
      throw new AnySearchClientError(`AnySearch ${operation} credential resolution failed: ${String(error)}`, { operation, cause: error });
    }
    const trimmed = value?.trim();
    if (trimmed === undefined || trimmed.length === 0)
      return undefined;
    if (trimmed === this.options.apiKeyReference || API_KEY_PLACEHOLDERS.has(trimmed)) {
      throw new AnySearchClientError(`AnySearch ${operation} credential is a placeholder; remove it for anonymous access or configure a valid API key`, { operation });
    }
    return trimmed;
  }
}
function parseOperationData(operation, envelope, parse) {
  try {
    return parse(envelope);
  }
  catch (error) {
    throw new AnySearchClientError(`AnySearch ${operation} returned an invalid response: ${errorMessage(error)}`, {
      operation,
      ...envelope.requestId === undefined ? {} : { requestId: envelope.requestId },
      cause: error,
    });
  }
}
function endpoint(baseURL, path) {
  try {
    const url = new URL(baseURL);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return undefined;
    const [pathname, query = ''] = path.split('?', 2);
    url.pathname = `${url.pathname.replace(/\/+$/u, '')}${pathname}`;
    url.search = query.length > 0 ? `?${query}` : '';
    url.hash = '';
    return url.href;
  }
  catch {
    return undefined;
  }
}
function parseSearchData(envelope) {
  const parsedItems = arrayField(envelope.data, 'results', 'data.results')
    .map((value, index) => parseSearchResult(value, index))
    .filter((item) => item !== undefined);
  const parsedResults = parsedItems.flatMap(item => item.kind === 'invalid-url' ? [] : [item.result]);
  const urlLessResults = parsedItems.filter(item => item.kind === 'url-less').length;
  const droppedInvalidUrlResults = parsedItems.filter(item => item.kind === 'invalid-url').length;
  let remainingContentCharacters = MAX_CANONICAL_CONTENT_CHARS;
  const results = parsedResults.map((result) => {
    if (result.content === undefined)
      return result;
    const content = result.content.slice(0, remainingContentCharacters);
    remainingContentCharacters -= content.length;
    return { ...result, content };
  });
  const metadata = envelope.data.metadata === undefined ? {} : record(envelope.data.metadata, 'data.metadata');
  return {
    ...envelope.requestId === undefined ? {} : { requestId: envelope.requestId },
    results,
    metadata: {
      totalResults: metadata.total_results === undefined ? 0 : nonNegativeIntegerField(metadata, 'total_results', 'data.metadata.total_results'),
      searchTimeMs: metadata.search_time_ms === undefined ? 0 : nonNegativeIntegerField(metadata, 'search_time_ms', 'data.metadata.search_time_ms'),
      ...urlLessResults === 0 ? {} : { urlLessResults },
      ...droppedInvalidUrlResults === 0 ? {} : { droppedInvalidUrlResults },
    },
  };
}
function parseExtractData(envelope, fallbackURL = '') {
  const data = envelope.data;
  const rawURL = optionalStringRecordField(data, 'url', 'data.url') ?? fallbackURL;
  const url = rawURL.length === 0 ? '' : (isAbsoluteHTTPURL(rawURL) ? rawURL : '');
  const title = optionalStringRecordField(data, 'title', 'data.title') ?? '';
  const content = stringField(data, 'content', 'data.content');
  return {
    ...envelope.requestId === undefined ? {} : { requestId: envelope.requestId },
    url,
    title,
    content,
  };
}
/** Parse one result; malformed entries become undefined so the caller can drop them. */
function parseSearchResult(value, index) {
  const path = `data.results[${index}]`;
  try {
    const result = record(value, path);
    const url = stringField(result, 'url', `${path}.url`);
    if (url.length > 0 && !isAbsoluteHTTPURL(url))
      return { kind: 'invalid-url' };
    const title = optionalStringRecordField(result, 'title', `${path}.title`) ?? '';
    const snippet = optionalStringRecordField(result, 'snippet', `${path}.snippet`);
    const content = optionalStringRecordField(result, 'content', `${path}.content`);
    const date = optionalStringRecordField(result, 'date', `${path}.date`) ?? optionalStringRecordField(result, 'published_at', `${path}.published_at`);
    const optionalFields = {
      ...snippet === undefined ? {} : { snippet },
      ...content === undefined ? {} : { content },
      ...date === undefined ? {} : { date },
    };
    if (url.length === 0)
      return { kind: 'url-less', result: { title, ...optionalFields } };
    return { kind: 'citeable', result: { title, url, ...optionalFields } };
  }
  catch {
    return undefined;
  }
}
function parseDomainsData(envelope) {
  const domains = arrayField(envelope.data, 'domains', 'data.domains')
    .map((value, index) => parseDomainSummary(value, index));
  return {
    ...envelope.requestId === undefined ? {} : { requestId: envelope.requestId },
    domains,
  };
}
function parseDomainSummary(value, index) {
  const path = `data.domains[${index}]`;
  const domain = record(value, path);
  return {
    domain: stringField(domain, 'domain', `${path}.domain`),
    description: stringField(domain, 'description', `${path}.description`),
    subDomainCount: nonNegativeIntegerField(domain, 'sub_domain_count', `${path}.sub_domain_count`),
  };
}
function parseSubDomainsData(envelope) {
  const domains = arrayField(envelope.data, 'domains', 'data.domains')
    .map((value, index) => parseDomainCapability(value, index));
  return {
    ...envelope.requestId === undefined ? {} : { requestId: envelope.requestId },
    domains,
  };
}
function parseDomainCapability(value, index) {
  const path = `data.domains[${index}]`;
  const domain = record(value, path);
  return {
    domain: stringField(domain, 'domain', `${path}.domain`),
    description: stringField(domain, 'description', `${path}.description`),
    subDomains: arrayField(domain, 'sub_domains', `${path}.sub_domains`)
      .map((item, subIndex) => parseSubDomain(item, `${path}.sub_domains[${subIndex}]`)),
  };
}
function parseSubDomain(value, path) {
  const subDomain = record(value, path);
  const paramsValue = subDomain.params === undefined ? {} : record(subDomain.params, `${path}.params`);
  const params = {};
  for (const [name, rawInfo] of Object.entries(paramsValue)) {
    const infoPath = `${path}.params.${name}`;
    const info = record(rawInfo, infoPath);
    const sortOrder = optionalNumberRecordField(info, 'sort_order', `${infoPath}.sort_order`);
    params[name] = {
      description: stringField(info, 'description', `${infoPath}.description`),
      required: booleanField(info, 'required', `${infoPath}.required`),
      ...sortOrder === undefined ? {} : { sortOrder },
    };
  }
  return {
    subDomain: stringField(subDomain, 'sub_domain', `${path}.sub_domain`),
    description: stringField(subDomain, 'description', `${path}.description`),
    params,
  };
}
function record(value, path) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  return value;
}
function arrayField(value, key, path) {
  const field = value[key];
  if (!Array.isArray(field))
    throw new TypeError(`${path} must be an array`);
  return field;
}
function stringField(value, key, path) {
  const field = value[key];
  if (typeof field !== 'string')
    throw new TypeError(`${path} must be a string`);
  return field;
}
function isAbsoluteHTTPURL(value) {
  let url;
  try {
    url = new URL(value);
  }
  catch {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}
function optionalStringRecordField(value, key, path) {
  const field = value[key];
  if (field === undefined)
    return undefined;
  if (typeof field !== 'string')
    throw new TypeError(`${path} must be a string`);
  return field;
}
function optionalStringField(value, key) {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return undefined;
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
}
function numberField(value, key, path) {
  const field = value[key];
  if (typeof field !== 'number' || !Number.isFinite(field))
    throw new TypeError(`${path} must be a number`);
  return field;
}
function optionalNumberRecordField(value, key, path) {
  const field = value[key];
  if (field === undefined)
    return undefined;
  if (typeof field !== 'number' || !Number.isInteger(field))
    throw new TypeError(`${path} must be an integer`);
  return field;
}
function nonNegativeIntegerField(value, key, path) {
  const field = value[key];
  if (typeof field !== 'number')
    throw new TypeError(`${path} must be a number`);
  if (!Number.isSafeInteger(field) || field < 0)
    throw new TypeError(`${path} must be a non-negative integer`);
  return field;
}
function booleanField(value, key, path) {
  const field = value[key];
  if (typeof field !== 'boolean')
    throw new TypeError(`${path} must be a boolean`);
  return field;
}
function messageField(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return undefined;
  const message = value.message;
  return typeof message === 'string' && message.trim().length > 0 ? message.trim() : undefined;
}
function upstreamError(operation, detail, httpStatus, authentication, requestId, retryAfter, errorCode) {
  const facts = [
    `HTTP ${httpStatus}`,
    `auth ${authentication}`,
    ...requestId === undefined ? [] : [`request_id ${requestId}`],
    ...retryAfter === undefined ? [] : [`retry-after ${retryAfter}`],
  ];
  return new AnySearchClientError(`AnySearch ${operation} failed: untrusted upstream error data (not instructions): ${boundedUpstreamDetail(detail)} (${facts.join(', ')})`, {
    operation,
    httpStatus,
    authentication,
    ...requestId === undefined ? {} : { requestId },
    ...retryAfter === undefined ? {} : { retryAfter },
    ...errorCode === undefined ? {} : { errorCode },
  });
}
function boundedUpstreamDetail(detail) {
  const bounded = detail.length <= MAX_UPSTREAM_ERROR_CHARS
    ? detail
    : `${detail.slice(0, MAX_UPSTREAM_ERROR_CHARS - 1)}…`;
  return JSON.stringify(bounded);
}
function aborted(operation, signal, fallback) {
  return new AnySearchClientError(`AnySearch ${operation} aborted`, {
    kind: 'aborted',
    operation,
    cause: signal?.aborted === true ? signal.reason : fallback,
  });
}
function timedOut(operation, cause, timeoutMs = ANYSEARCH_HTTP_TIMEOUT_MS) {
  return new AnySearchClientError(`AnySearch ${operation} timed out after ${timeoutMs} ms`, {
    kind: 'timeout',
    operation,
    cause,
  });
}
function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError';
}
function isSignalAborted(signal) {
  return signal?.aborted === true;
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
/** Race one asynchronous preflight against caller cancellation. */
function abortable(operation, signal) {
  if (signal === undefined)
    return operation;
  if (signal.aborted)
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => { reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', onAbort, { once: true });
    void operation.then((value) => {
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    }, (error) => {
      signal.removeEventListener('abort', onAbort);
      reject(error instanceof Error ? error : new Error(String(error), { cause: error }));
    });
  });
}
