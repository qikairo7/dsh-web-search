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
  searchMode: 'quality',
  fetchMode: 'fast',
  intentRouting: true,
  languageRouting: true,
  officialDocsEnabled: true,
  chineseSearchOrder: ['zhihu', 'anysearch', 'tavily', 'firecrawl'],
  defaultSearchOrder: ['anysearch', 'tavily', 'zhihu', 'firecrawl'],
  fetchOrder: ['http', 'tavily', 'firecrawl', 'anysearch'],
  cleanFetchOrder: ['tavily', 'firecrawl', 'http', 'anysearch'],
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
  aihot: Object.freeze({
    enabled: true,
    baseURL: 'https://aihot.news',
  }),
  siliconflow: Object.freeze({
    enabled: true,
    apiKeyEnv: 'SILICONFLOW_API_KEY',
    baseURL: 'https://api.siliconflow.cn/v1',
    model: 'BAAI/bge-reranker-v2-m3',
    embeddingsEnabled: true,
    embeddingModel: 'BAAI/bge-m3',
  }),
  semanticDedupThreshold: 0.95,
  enrichEnabled: true,
  enrichTopN: 5,
  enrichSummaryMinChars: 800,
  enrichSummaryMaxChars: 1_500,
  requestTimeoutMs: 30_000,
  maxFetchChars: 200_000,
  maxSnippetChars: 4_000,
  minDirectHtmlChars: 2_048,
  searchCacheTtlMs: 300_000,
  searchCacheMaxEntries: 200,
  fetchCacheTtlMs: 600_000,
  fetchCacheMaxEntries: 100,
  breakerFailureThreshold: 3,
  breakerCooldownMs: 300_000,
});

/** Accept either a comma/space-separated string or an array. */
export function parseOrder(value, fallback) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\s]+/u) : [];
  const names = raw
    .map((name) => String(name).trim().toLowerCase())
    .filter((name) => name.length > 0);
  return names.length > 0 ? [...new Set(names)] : [...fallback];
}

/** Return one of the allowed values, or the fallback. */
export function parseEnum(value, allowed, fallback) {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
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
    searchMode: parseEnum(read('searchMode'), ['fast', 'quality'], DEFAULT_SETTINGS.searchMode),
    fetchMode: parseEnum(read('fetchMode'), ['fast', 'clean'], DEFAULT_SETTINGS.fetchMode),
    intentRouting: read('intentRouting') ?? DEFAULT_SETTINGS.intentRouting,
    languageRouting: read('languageRouting') ?? DEFAULT_SETTINGS.languageRouting,
    officialDocsEnabled: read('officialDocsEnabled') ?? DEFAULT_SETTINGS.officialDocsEnabled,
    chineseSearchOrder: parseOrder(read('chineseSearchOrder'), DEFAULT_SETTINGS.chineseSearchOrder),
    defaultSearchOrder: parseOrder(read('defaultSearchOrder'), DEFAULT_SETTINGS.defaultSearchOrder),
    fetchOrder: parseOrder(read('fetchOrder'), DEFAULT_SETTINGS.fetchOrder),
    cleanFetchOrder: parseOrder(read('cleanFetchOrder'), DEFAULT_SETTINGS.cleanFetchOrder),
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
    aihot: {
      enabled: read('aihotEnabled') ?? DEFAULT_SETTINGS.aihot.enabled,
      baseURL: read('aihotBaseURL') ?? DEFAULT_SETTINGS.aihot.baseURL,
    },
    siliconflow: {
      enabled: read('siliconflowEnabled') ?? DEFAULT_SETTINGS.siliconflow.enabled,
      apiKeyEnv: read('siliconflowApiKeyEnv') ?? DEFAULT_SETTINGS.siliconflow.apiKeyEnv,
      baseURL: read('siliconflowBaseURL') ?? DEFAULT_SETTINGS.siliconflow.baseURL,
      model: read('siliconflowRerankModel') ?? DEFAULT_SETTINGS.siliconflow.model,
      embeddingsEnabled:
        read('siliconflowEmbeddingsEnabled') ?? DEFAULT_SETTINGS.siliconflow.embeddingsEnabled,
      embeddingModel:
        read('siliconflowEmbeddingModel') ?? DEFAULT_SETTINGS.siliconflow.embeddingModel,
    },
    semanticDedupThreshold:
      typeof read('semanticDedupThreshold') === 'number'
        ? read('semanticDedupThreshold')
        : DEFAULT_SETTINGS.semanticDedupThreshold,
    requestTimeoutMs: positiveInteger(read('requestTimeoutMs'), DEFAULT_SETTINGS.requestTimeoutMs),
    maxFetchChars: positiveInteger(read('maxFetchChars'), DEFAULT_SETTINGS.maxFetchChars),
    maxSnippetChars: positiveInteger(read('maxSnippetChars'), DEFAULT_SETTINGS.maxSnippetChars),
    minDirectHtmlChars: positiveInteger(
      read('minDirectHtmlChars'),
      DEFAULT_SETTINGS.minDirectHtmlChars,
    ),
    searchCacheTtlMs: positiveInteger(read('searchCacheTtlMs'), DEFAULT_SETTINGS.searchCacheTtlMs),
    searchCacheMaxEntries: positiveInteger(
      read('searchCacheMaxEntries'),
      DEFAULT_SETTINGS.searchCacheMaxEntries,
    ),
    fetchCacheTtlMs: positiveInteger(read('fetchCacheTtlMs'), DEFAULT_SETTINGS.fetchCacheTtlMs),
    fetchCacheMaxEntries: positiveInteger(
      read('fetchCacheMaxEntries'),
      DEFAULT_SETTINGS.fetchCacheMaxEntries,
    ),
    breakerFailureThreshold: positiveInteger(
      read('breakerFailureThreshold'),
      DEFAULT_SETTINGS.breakerFailureThreshold,
    ),
    breakerCooldownMs: positiveInteger(
      read('breakerCooldownMs'),
      DEFAULT_SETTINGS.breakerCooldownMs,
    ),
  };
}

/** Look up one backend's settings by router name. */
export function providerSettings(settings, name) {
  const key = name === 'zhihu-site' ? 'zhihu' : name;
  const value = settings[key];
  return value !== null && typeof value === 'object' ? value : undefined;
}
