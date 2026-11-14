/** AnySearch native provider: anonymous search plus cleaned Extract fetch. */

import { isHTTPURL } from '../http.js';
import { webError, toWebError } from '../errors.js';
import { resolveRouting } from '../routing.js';
import { cleanMarkdown } from '../clean.js';
import { summarizeContent } from '../summarize.js';
import { isProviderAvailable, textResult } from './shared.js';
import { AnySearchClient, AnySearchClientError } from './anysearchClient.js';

export const ANYSEARCH_PROVIDER_ID = 'anysearch';

/** Map one AnySearch result into the seam's source vocabulary. */
export function mapAnySearchSource(item, maxChars = 800, query = '') {
  if (item === null || typeof item !== 'object') return undefined;
  const url = typeof item.url === 'string' ? item.url.trim() : '';
  if (!isHTTPURL(url)) return undefined;
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  const snippet = typeof item.snippet === 'string' ? item.snippet.trim() : '';
  const content = typeof item.content === 'string' ? item.content.trim() : '';
  const date = typeof item.date === 'string' ? item.date.trim() : typeof item.published_at === 'string' ? item.published_at.trim() : '';
  const summary = summarizeContent(content || snippet, query, 800, Math.min(maxChars, 1500));
  return {
    url,
    ...(title.length > 0 ? { title } : {}),
    ...(snippet.length > 0 ? { snippet } : {}),
    ...(summary.length > 0 ? { summary } : {}),
    ...(date.length > 0 ? { publishedAt: date } : {}),
  };
}

/** Map AnySearch business error codes onto the seam's vocabulary. */
export function anySearchErrorCode(error) {
  if (error instanceof AnySearchClientError && error.kind === 'aborted') return 'WEB_ABORTED';
  const code = error instanceof AnySearchClientError ? error.errorCode : undefined;
  switch (code) {
    case 'invalid_extract_url':
      return 'WEB_INVALID_URL';
    case 'extract_target_blocked':
      return 'WEB_BLOCKED_URL';
    case 'extract_content_too_large':
      return 'WEB_FETCH_TOO_LARGE';
    case 'extract_unsupported_content':
      return 'WEB_UNSUPPORTED_CONTENT_TYPE';
    case 'extract_timeout':
      return 'WEB_FETCH_TIMEOUT';
    case 'extract_canceled':
      return 'WEB_ABORTED';
    default:
      return 'WEB_PROVIDER_ERROR';
  }
}

/** Wrap AnySearch client failures as seam errors. */
function asWebError(error, operation) {
  if (error instanceof AnySearchClientError) {
    return webError(`AnySearch ${operation} failed: ${error.message}`, anySearchErrorCode(error), {
      cause: error,
    });
  }
  return toWebError(error, 'AnySearch', operation, { fetch: operation === 'fetch' });
}

/** AnySearch-backed search and fetch provider. */
export class AnySearchProvider {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  get id() {
    return ANYSEARCH_PROVIDER_ID;
  }

  get title() {
    return 'AnySearch';
  }

  get description() {
    return {
      en: 'Anonymous-capable web search and cleaned Extract fetch through AnySearch.',
      zh: '通过 AnySearch 提供可匿名使用的网页搜索与正文提取。',
    };
  }

  available() {
    return isProviderAvailable(this.settings().anysearch);
  }

  async ready() {
    return true;
  }

  /** Build a client from current settings so key and endpoint changes apply on the next call. */
  client(settings) {
    const config = settings.anysearch;
    return new AnySearchClient({
      baseURL: config.baseURL,
      apiKeyReference: config.apiKeyEnv,
      timeoutMs: settings.requestTimeoutMs,
      resolveApiKey: () => this.resolveKey(config.apiKeyEnv),
    });
  }

  async search(request, signal) {
    const settings = this.settings();
    const { language } = resolveRouting(request, settings);
    try {
      const result = await this.client(settings).search(
        {
          query: request.query,
          ...(request.maxResults === undefined ? {} : { maxResults: request.maxResults }),
          ...(language === undefined ? {} : { language }),
        },
        signal,
      );
      const sources = result.results
        .map((item) => mapAnySearchSource(item, settings.maxSnippetChars, request.query))
        .filter((item) => item !== undefined);
      return { sources, truncated: false };
    } catch (error) {
      throw asWebError(error, 'search');
    }
  }

  async fetch(request, signal) {
    const settings = this.settings();
    try {
      const result = await this.client(settings).extract({ url: request.url }, signal);
      const content = cleanMarkdown(result.content, result.url.length > 0 ? result.url : request.url);
      if (content.length === 0) throw new Error('extract response has no content');
      return textResult(request.url, content, settings.maxFetchChars);
    } catch (error) {
      throw asWebError(error, 'fetch');
    }
  }
}
