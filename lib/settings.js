/** Live configuration reading, declarative field metadata, and normalization. */

import { FAILURE_CLASSES } from './errors.js';
import { settingsKeyForProvider } from './catalog.js';
import { DEFAULT_SEARCH_ORDERS } from './roles.js';

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
  qualityMaxEngines: 4,
  qualityRerankEnabled: true,
  qualityExcludedProviders: Object.freeze([]),
  fastPrimaryProvider: '',
  fastMaxFallbacks: 1,
  cleanExtractProviders: Object.freeze(['keenable', 'anysearch', 'exa']),
  officialDocsEnabled: true,
  newsFreshnessEnabled: true,
  chineseSearchOrder: DEFAULT_SEARCH_ORDERS.chineseSearchOrder,
  defaultSearchOrder: DEFAULT_SEARCH_ORDERS.defaultSearchOrder,
  fetchOrder: DEFAULT_SEARCH_ORDERS.fetchOrder,
  cleanFetchOrder: DEFAULT_SEARCH_ORDERS.cleanFetchOrder,
  anysearch: Object.freeze({
    enabled: true,
    searchEnabled: true,
    fetchEnabled: true,
    apiKeyEnv: 'ANYSEARCH_API_KEY',
    baseURL: 'https://api.anysearch.com',
    maxRenderedContentChars: 12_000,
    tag: '',
    zone: 'auto',
    cleanContent: true,
    batchEnabled: true,
  }),
  keenable: Object.freeze({
    enabled: true,
    searchEnabled: true,
    fetchEnabled: true,
    apiKeyEnv: 'KEENABLE_API_KEY',
    baseURL: 'https://api.keenable.ai',
  }),
  exa: Object.freeze({
    enabled: true,
    searchEnabled: true,
    fetchEnabled: true,
    apiKeyEnv: 'EXA_API_KEY',
    baseURL: 'https://api.exa.ai',
  }),
  bing: Object.freeze({
    enabled: true,
    baseURL: 'https://www.bing.com',
    market: '',
  }),
  github: Object.freeze({
    enabled: true,
    searchEnabled: true,
    fetchEnabled: true,
    apiKeyEnv: 'GITHUB_TOKEN',
    baseURL: 'https://api.github.com',
  }),
  tavily: Object.freeze({
    enabled: true,
    searchEnabled: true,
    fetchEnabled: true,
    apiKeyEnv: 'TAVILY_API_KEY',
    baseURL: 'https://api.tavily.com',
    includeAnswer: true,
  }),
  firecrawl: Object.freeze({
    enabled: true,
    searchEnabled: true,
    fetchEnabled: true,
    apiKeyEnv: 'FIRECRAWL_API_KEY',
    baseURL: 'https://api.firecrawl.dev',
  }),
  zhihu: Object.freeze({
    enabled: true,
    searchEnabled: true,
    apiKeyEnv: 'ZHIHU_API_KEY',
    baseURL: 'https://developer.zhihu.com',
    includeMetadata: true,
    searchMode: 'global',
  }),
  http: Object.freeze({ enabled: true }),
  aihot: Object.freeze({
    enabled: true,
    baseURL: 'https://aihot.news',
  }),
  xTools: Object.freeze({
    enabled: false,
    cookieRef: 'X_COOKIE',
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
  fallbackFailureClasses: FAILURE_CLASSES,
});

/**
 * Declarative description of every Config field, in schema order.
 *
 * `key` is the flat Config name; `path` is the nested resolveSettings() shape
 * and also points at the field's default in DEFAULT_SETTINGS. `kind` selects
 * coercion and the schemastery type; `min`/`max`/`step` are Config constraints
 * and `coerce` names the integer resolver used by resolveSettings().
 */
export const SETTINGS_SPEC = Object.freeze([
  {
    key: 'searchMode',
    path: 'searchMode',
    kind: 'enum',
    values: ['fast', 'quality'],
  },
  {
    key: 'fetchMode',
    path: 'fetchMode',
    kind: 'enum',
    values: ['fast', 'clean'],
  },
  { key: 'qualityMaxEngines', path: 'qualityMaxEngines', kind: 'number', coerce: 'positive-integer', min: 1, max: 8, step: 1 },
  { key: 'qualityRerankEnabled', path: 'qualityRerankEnabled', kind: 'boolean' },
  { key: 'qualityExcludedProviders', path: 'qualityExcludedProviders', kind: 'order' },
  { key: 'fastPrimaryProvider', path: 'fastPrimaryProvider', kind: 'string' },
  { key: 'fastMaxFallbacks', path: 'fastMaxFallbacks', kind: 'number', coerce: 'non-negative-integer', min: 0, max: 5, step: 1 },
  { key: 'cleanExtractProviders', path: 'cleanExtractProviders', kind: 'order' },
  { key: 'intentRouting', path: 'intentRouting', kind: 'boolean' },
  {
    key: 'languageRouting',
    path: 'languageRouting',
    kind: 'boolean',
  },
  {
    key: 'officialDocsEnabled',
    path: 'officialDocsEnabled',
    kind: 'boolean',
  },
  {
    key: 'newsFreshnessEnabled',
    path: 'newsFreshnessEnabled',
    kind: 'boolean',
  },
  {
    key: 'chineseSearchOrder',
    path: 'chineseSearchOrder',
    kind: 'order',
  },
  {
    key: 'defaultSearchOrder',
    path: 'defaultSearchOrder',
    kind: 'order',
  },
  { key: 'fetchOrder', path: 'fetchOrder', kind: 'order' },
  {
    key: 'cleanFetchOrder',
    path: 'cleanFetchOrder',
    kind: 'order',
  },
  {
    key: 'anysearchEnabled',
    path: 'anysearch.enabled',
    kind: 'boolean',
  },
  {
    key: 'anysearchApiKeyEnv',
    path: 'anysearch.apiKeyEnv',
    kind: 'string',
    role: 'credential-ref',
  },
  {
    key: 'anysearchBaseURL',
    path: 'anysearch.baseURL',
    kind: 'string',
  },
  { key: 'anysearchSearchEnabled', path: 'anysearch.searchEnabled', kind: 'boolean' },
  { key: 'anysearchFetchEnabled', path: 'anysearch.fetchEnabled', kind: 'boolean' },
  { key: 'anysearchTag', path: 'anysearch.tag', kind: 'string' },
  { key: 'anysearchZone', path: 'anysearch.zone', kind: 'enum', values: ['auto', 'cn', 'intl'] },
  { key: 'anysearchCleanContent', path: 'anysearch.cleanContent', kind: 'boolean' },
  { key: 'anysearchBatchEnabled', path: 'anysearch.batchEnabled', kind: 'boolean' },
  {
    key: 'keenableEnabled',
    path: 'keenable.enabled',
    kind: 'boolean',
  },
  {
    key: 'keenableApiKeyEnv',
    path: 'keenable.apiKeyEnv',
    kind: 'string',
    role: 'credential-ref',
  },
  {
    key: 'keenableBaseURL',
    path: 'keenable.baseURL',
    kind: 'string',
  },
  { key: 'keenableSearchEnabled', path: 'keenable.searchEnabled', kind: 'boolean' },
  { key: 'keenableFetchEnabled', path: 'keenable.fetchEnabled', kind: 'boolean' },
  {
    key: 'exaEnabled',
    path: 'exa.enabled',
    kind: 'boolean',
  },
  {
    key: 'exaApiKeyEnv',
    path: 'exa.apiKeyEnv',
    kind: 'string',
    role: 'credential-ref',
  },
  {
    key: 'exaBaseURL',
    path: 'exa.baseURL',
    kind: 'string',
  },
  { key: 'exaSearchEnabled', path: 'exa.searchEnabled', kind: 'boolean' },
  { key: 'exaFetchEnabled', path: 'exa.fetchEnabled', kind: 'boolean' },
  {
    key: 'bingEnabled',
    path: 'bing.enabled',
    kind: 'boolean',
  },
  {
    key: 'bingBaseURL',
    path: 'bing.baseURL',
    kind: 'string',
  },
  {
    key: 'bingMarket',
    path: 'bing.market',
    kind: 'string',
  },
  {
    key: 'githubEnabled',
    path: 'github.enabled',
    kind: 'boolean',
  },
  {
    key: 'githubApiKeyEnv',
    path: 'github.apiKeyEnv',
    kind: 'string',
    role: 'credential-ref',
  },
  {
    key: 'githubBaseURL',
    path: 'github.baseURL',
    kind: 'string',
  },
  { key: 'githubSearchEnabled', path: 'github.searchEnabled', kind: 'boolean' },
  { key: 'githubFetchEnabled', path: 'github.fetchEnabled', kind: 'boolean' },
  {
    key: 'anysearchMaxRenderedContentChars',
    path: 'anysearch.maxRenderedContentChars',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
  },
  {
    key: 'tavilyEnabled',
    path: 'tavily.enabled',
    kind: 'boolean',
  },
  {
    key: 'tavilyApiKeyEnv',
    path: 'tavily.apiKeyEnv',
    kind: 'string',
    role: 'credential-ref',
  },
  {
    key: 'tavilyBaseURL',
    path: 'tavily.baseURL',
    kind: 'string',
  },
  { key: 'tavilySearchEnabled', path: 'tavily.searchEnabled', kind: 'boolean' },
  { key: 'tavilyFetchEnabled', path: 'tavily.fetchEnabled', kind: 'boolean' },
  {
    key: 'tavilyIncludeAnswer',
    path: 'tavily.includeAnswer',
    kind: 'boolean',
  },
  {
    key: 'firecrawlEnabled',
    path: 'firecrawl.enabled',
    kind: 'boolean',
  },
  {
    key: 'firecrawlApiKeyEnv',
    path: 'firecrawl.apiKeyEnv',
    kind: 'string',
    role: 'credential-ref',
  },
  {
    key: 'firecrawlBaseURL',
    path: 'firecrawl.baseURL',
    kind: 'string',
  },
  { key: 'firecrawlSearchEnabled', path: 'firecrawl.searchEnabled', kind: 'boolean' },
  { key: 'firecrawlFetchEnabled', path: 'firecrawl.fetchEnabled', kind: 'boolean' },
  {
    key: 'zhihuEnabled',
    path: 'zhihu.enabled',
    kind: 'boolean',
  },
  {
    key: 'zhihuApiKeyEnv',
    path: 'zhihu.apiKeyEnv',
    kind: 'string',
    role: 'credential-ref',
  },
  {
    key: 'zhihuBaseURL',
    path: 'zhihu.baseURL',
    kind: 'string',
  },
  { key: 'zhihuSearchEnabled', path: 'zhihu.searchEnabled', kind: 'boolean' },
  { key: 'zhihuSearchMode', path: 'zhihu.searchMode', kind: 'enum', values: ['global', 'site'] },
  {
    key: 'zhihuIncludeMetadata',
    path: 'zhihu.includeMetadata',
    kind: 'boolean',
  },
  { key: 'httpEnabled', path: 'http.enabled', kind: 'boolean' },
  {
    key: 'aihotEnabled',
    path: 'aihot.enabled',
    kind: 'boolean',
  },
  {
    key: 'aihotBaseURL',
    path: 'aihot.baseURL',
    kind: 'string',
  },
  {
    key: 'xToolsEnabled',
    path: 'xTools.enabled',
    kind: 'boolean',
  },
  {
    key: 'xToolsCookieRef',
    path: 'xTools.cookieRef',
    kind: 'string',
    role: 'credential-ref',
  },
  {
    key: 'siliconflowEnabled',
    path: 'siliconflow.enabled',
    kind: 'boolean',
  },
  {
    key: 'siliconflowApiKeyEnv',
    path: 'siliconflow.apiKeyEnv',
    kind: 'string',
    role: 'credential-ref',
  },
  {
    key: 'siliconflowBaseURL',
    path: 'siliconflow.baseURL',
    kind: 'string',
  },
  {
    key: 'siliconflowRerankModel',
    path: 'siliconflow.model',
    kind: 'string',
  },
  {
    key: 'siliconflowEmbeddingsEnabled',
    path: 'siliconflow.embeddingsEnabled',
    kind: 'boolean',
  },
  {
    key: 'siliconflowEmbeddingModel',
    path: 'siliconflow.embeddingModel',
    kind: 'string',
  },
  {
    key: 'semanticDedupThreshold',
    path: 'semanticDedupThreshold',
    kind: 'number',
    coerce: 'number',
    min: 0,
    max: 1,
  },
  {
    key: 'enrichEnabled',
    path: 'enrichEnabled',
    kind: 'boolean',
  },
  {
    key: 'enrichTopN',
    path: 'enrichTopN',
    kind: 'number',
    coerce: 'non-negative-integer',
    min: 0,
    max: 10,
    step: 1,
  },
  {
    key: 'enrichSummaryMinChars',
    path: 'enrichSummaryMinChars',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'enrichSummaryMaxChars',
    path: 'enrichSummaryMaxChars',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'requestTimeoutMs',
    path: 'requestTimeoutMs',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'maxFetchChars',
    path: 'maxFetchChars',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'maxSnippetChars',
    path: 'maxSnippetChars',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'minDirectHtmlChars',
    path: 'minDirectHtmlChars',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'searchCacheTtlMs',
    path: 'searchCacheTtlMs',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'searchCacheMaxEntries',
    path: 'searchCacheMaxEntries',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'fetchCacheTtlMs',
    path: 'fetchCacheTtlMs',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'fetchCacheMaxEntries',
    path: 'fetchCacheMaxEntries',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'fallbackFailureClasses',
    path: 'fallbackFailureClasses',
    kind: 'failure-classes',
    values: FAILURE_CLASSES,
  },
  {
    key: 'breakerFailureThreshold',
    path: 'breakerFailureThreshold',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
  {
    key: 'breakerCooldownMs',
    path: 'breakerCooldownMs',
    kind: 'number',
    coerce: 'positive-integer',
    min: 1,
    step: 1,
  },
]);

/** Accept either a comma/space-separated string or an array. */
export function parseOrder(value, fallback) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\s]+/u) : [];
  const names = raw
    .map((name) => String(name).trim().toLowerCase())
    .filter((name) => name.length > 0);
  return names.length > 0 ? [...new Set(names)] : [...fallback];
}

/**
 * Resolve the fallback failure classes. An explicit array is the allowlist as
 * given (an empty one disables every fallback); a string falls back to the
 * default set unless it names at least one known class, so one typo cannot
 * silently disable all fallback.
 */
export function parseFailureClasses(value, fallback) {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((item) => String(item).trim().toLowerCase())
          .filter((item) => FAILURE_CLASSES.includes(item)),
      ),
    ];
  }
  if (typeof value === 'string') {
    const classes = value
      .split(/[,;\s]+/u)
      .map((item) => item.trim().toLowerCase())
      .filter((item) => FAILURE_CLASSES.includes(item));
    return classes.length > 0 ? [...new Set(classes)] : [...fallback];
  }
  return fallback;
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

/** Return a non-negative integer no greater than max, or the fallback. */
export function nonNegativeInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= max ? number : fallback;
}

/** Read one spec entry's default value from DEFAULT_SETTINGS along its path. */
export function settingDefault(spec) {
  return spec.path.split('.').reduce((value, key) => value[key], DEFAULT_SETTINGS);
}

/** Coerce one raw Config value according to its spec entry. */
function resolveSetting(spec, value) {
  const fallback = settingDefault(spec);
  switch (spec.kind) {
    case 'enum':
      return parseEnum(value, spec.values, fallback);
    case 'order':
      return parseOrder(value, fallback);
    case 'failure-classes':
      return parseFailureClasses(value, fallback);
    case 'boolean':
    case 'string':
      return value ?? fallback;
    case 'number':
      if (spec.coerce === 'non-negative-integer') {
        return nonNegativeInteger(value, fallback, spec.max);
      }
      if (spec.coerce === 'positive-integer') {
        const number = positiveInteger(value, fallback);
        return spec.max !== undefined && number > spec.max ? fallback : number;
      }
      return typeof value === 'number' ? value : fallback;
    default:
      throw new TypeError(`unknown setting kind: ${spec.kind}`);
  }
}

/** Write one value at a nested settings path. */
function assignSetting(target, path, value) {
  const parts = path.split('.');
  const leaf = parts.pop();
  let node = target;
  for (const part of parts) {
    node[part] ??= {};
    node = node[part];
  }
  node[leaf] = value;
}

/** Resolve every field once per operation, dereferencing volatile refs. */
export function resolveSettings(config = {}) {
  const resolved = {};
  for (const spec of SETTINGS_SPEC) {
    assignSetting(resolved, spec.path, resolveSetting(spec, readConfigValue(config[spec.key])));
  }
  return resolved;
}

/** Look up one backend's settings by router name. */
export function providerSettings(settings, name) {
  const value = settings[settingsKeyForProvider(name)];
  return value !== null && typeof value === 'object' ? value : undefined;
}
