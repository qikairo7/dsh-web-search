/** Live configuration reading and normalization. */

/** A live configuration reference from the dsh 0.2.x loader. */
export function readConfigValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object' && typeof value.get === 'function') {
    return value.get();
  }
  return value;
}

export const DEFAULT_SETTINGS = Object.freeze({
  chineseSearchOrder: ['zhihu', 'anysearch', 'tavily', 'firecrawl'],
  defaultSearchOrder: ['anysearch', 'tavily', 'zhihu', 'firecrawl'],
  fetchOrder: ['http', 'tavily', 'firecrawl', 'anysearch'],
  anysearch: Object.freeze({
    enabled: true,
    apiKeyEnv: 'ANYSEARCH_API_KEY',
    baseURL: 'https://api.anysearch.com',
  }),
  tavily: Object.freeze({
    enabled: true,
    apiKeyEnv: 'TAVILY_API_KEY',
    baseURL: 'https://api.tavily.com',
    includeAnswer: true,
  }),
  firecrawl: Object.freeze({
    enabled: true,
    apiKeyEnv: 'FIRECRAWL_API_KEY',
    baseURL: 'https://api.firecrawl.dev',
  }),
  zhihu: Object.freeze({
    enabled: true,
    apiKeyEnv: 'ZHIHU_API_KEY',
    baseURL: 'https://developer.zhihu.com',
    includeMetadata: true,
  }),
  http: Object.freeze({ enabled: true }),
  requestTimeoutMs: 60_000,
  maxFetchChars: 200_000,
  maxSnippetChars: 800,
  minDirectHtmlChars: 2_048,
});

/** Accept either a comma/space-separated string or an array. */
export function parseOrder(value, fallback) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\s]+/u) : [];
  const names = raw
    .map((name) => String(name).trim().toLowerCase())
    .filter((name) => name.length > 0);
  return names.length > 0 ? [...new Set(names)] : [...fallback];
}

/** Return a positive integer, or the fallback when the value is invalid. */
export function positiveInteger(value, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

/** Resolve every field once per operation, dereferencing volatile refs. */
export function resolveSettings(config = {}) {
  const read = (key) => readConfigValue(config[key]);
  return {
    chineseSearchOrder: parseOrder(read('chineseSearchOrder'), DEFAULT_SETTINGS.chineseSearchOrder),
    defaultSearchOrder: parseOrder(read('defaultSearchOrder'), DEFAULT_SETTINGS.defaultSearchOrder),
    fetchOrder: parseOrder(read('fetchOrder'), DEFAULT_SETTINGS.fetchOrder),
    anysearch: {
      enabled: read('anysearchEnabled') ?? DEFAULT_SETTINGS.anysearch.enabled,
      apiKeyEnv: read('anysearchApiKeyEnv') ?? DEFAULT_SETTINGS.anysearch.apiKeyEnv,
      baseURL: read('anysearchBaseURL') ?? DEFAULT_SETTINGS.anysearch.baseURL,
    },
    tavily: {
      enabled: read('tavilyEnabled') ?? DEFAULT_SETTINGS.tavily.enabled,
      apiKeyEnv: read('tavilyApiKeyEnv') ?? DEFAULT_SETTINGS.tavily.apiKeyEnv,
      baseURL: read('tavilyBaseURL') ?? DEFAULT_SETTINGS.tavily.baseURL,
      includeAnswer: read('tavilyIncludeAnswer') ?? DEFAULT_SETTINGS.tavily.includeAnswer,
    },
    firecrawl: {
      enabled: read('firecrawlEnabled') ?? DEFAULT_SETTINGS.firecrawl.enabled,
      apiKeyEnv: read('firecrawlApiKeyEnv') ?? DEFAULT_SETTINGS.firecrawl.apiKeyEnv,
      baseURL: read('firecrawlBaseURL') ?? DEFAULT_SETTINGS.firecrawl.baseURL,
    },
    zhihu: {
      enabled: read('zhihuEnabled') ?? DEFAULT_SETTINGS.zhihu.enabled,
      apiKeyEnv: read('zhihuApiKeyEnv') ?? DEFAULT_SETTINGS.zhihu.apiKeyEnv,
      baseURL: read('zhihuBaseURL') ?? DEFAULT_SETTINGS.zhihu.baseURL,
      includeMetadata: read('zhihuIncludeMetadata') ?? DEFAULT_SETTINGS.zhihu.includeMetadata,
    },
    http: {
      enabled: read('httpEnabled') ?? DEFAULT_SETTINGS.http.enabled,
    },
    requestTimeoutMs: positiveInteger(read('requestTimeoutMs'), DEFAULT_SETTINGS.requestTimeoutMs),
    maxFetchChars: positiveInteger(read('maxFetchChars'), DEFAULT_SETTINGS.maxFetchChars),
    maxSnippetChars: positiveInteger(read('maxSnippetChars'), DEFAULT_SETTINGS.maxSnippetChars),
    minDirectHtmlChars: positiveInteger(
      read('minDirectHtmlChars'),
      DEFAULT_SETTINGS.minDirectHtmlChars,
    ),
  };
}

/** Look up one backend's settings by router name. */
export function providerSettings(settings, name) {
  const value = settings[name];
  return value !== null && typeof value === 'object' ? value : undefined;
}
