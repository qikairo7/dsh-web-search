/** Web settings page for the dsh-web-search bundle. */

// IIFE keeps this bundle's declarations out of the classic-script global lexical scope shared by sibling bundles.
(() => {
/** Split one pasted key box into individual keys; comma, ideographic comma and whitespace separate. */
const splitKeyInput = (value) => String(value ?? '').split(/[\s,，]+/u).filter((key) => key.length > 0);

/**
 * Apply a key-write plan. Refuses the whole batch on overflow or an empty selection before
 * writing anything; otherwise writes each key in order and stops on the first failure.
 * Returns `overflow`, `empty`, `failed` or `saved`.
 */
const applyKeyPlan = async (plan, setCredential) => {
  if (plan.overflow) return 'overflow';
  if (plan.writes.length === 0) return 'empty';
  for (const write of plan.writes) {
    const result = await setCredential(write.ref, write.value);
    if (result?.ok !== true) return 'failed';
  }
  return 'saved';
};

/**
 * Gate a key-write plan before any save work starts. Overflow or empty plans are refused
 * without raising busy, so invalid input never shows the saving state; a valid plan raises
 * busy and returns true. The caller lowers busy when the save finishes.
 */
const beginKeySave = (plan, setBusy) => {
  if (plan.overflow || plan.writes.length === 0) return false;
  setBusy(true);
  return true;
};

/**
 * Run one key save through the settings page path. Invalid plans are refused before any state
 * change so bad input never flashes the saving state (#117); an accepted plan writes its keys and
 * always lowers busy when done. Results are reported through the `onRefused` / `onSaved` /
 * `onFailed` callbacks.
 */
const saveKey = async ({ plan, setBusy, setCredential, onRefused, onSaved, onFailed }) => {
  if (!beginKeySave(plan, setBusy)) {
    onRefused(plan.overflow ? 'tooManyKeys' : 'enterKey');
    return;
  }
  const status = await applyKeyPlan(plan, setCredential);
  if (status === 'saved') {
    await onSaved();
  } else {
    onFailed();
  }
  setBusy(false);
};

const MAX_KEY_REFS = 8;

/**
 * Turn a verification failure body into readable, actionable Chinese. The
 * health route reports an internal `code` plus a message such as
 * "WEB_PROVIDER_ERROR: GitHub search failed: GitHub search failed (HTTP 401):
 * Bad credentials"; this drops the internal code, collapses a repeated
 * "<label>: <label>" prefix, and maps a known HTTP status to a hint. The
 * thrown WebError keeps its `cause` chain on the server; only the shown text
 * changes.
 * @param {{ code?: string, message?: string }} data - failed health response.
 * @returns {string} display text without an internal code or duplicated prefix.
 */
const humanizeVerifyError = (data) => {
  const code = typeof data?.code === 'string' ? data.code : '';
  const message = typeof data?.message === 'string' ? data.message : '';
  const raw = message.length > 0 ? message : code;
  const stripped = raw.replace(/^[A-Z][A-Z0-9_]*:\s*/u, '').trim();
  const status = (
    /\(\s*HTTP\s+(\d{3})\s*\)/iu.exec(stripped)
    || /\bHTTP\s+(\d{3})\b/iu.exec(stripped)
    || /(?:status|code)\s*[:=]?\s*(\d{3})\b/iu.exec(stripped)
    || []
  )[1] ?? '';
  if (status === '401' || status === '403') return `PAT 无效或已过期（HTTP ${status}），请重新生成后保存`;
  if (status === '429') return `触发限流（HTTP ${status}），请稍后重试`;
  if (status.length === 3 && Number(status) >= 500) return `Provider 暂时不可用（HTTP ${status}），请稍后重试`;
  return stripped.replace(/^([^:]{2,60}):\s*\1:\s*/u, '$1: ');
};

/**
 * Tighten a saved-key preview to its last four characters behind a fixed mask,
 * so a stored PAT never shows more than its tail (e.g. "••••4qWU").
 * @param {string} masked - provider-supplied masked preview.
 * @returns {string} bullets plus at most the last four characters.
 */
const maskSavedKey = (masked) => {
  const value = typeof masked === 'string' ? masked : '';
  if (value.length === 0) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
};

/** The primary reference plus its numbered siblings, e.g. KEY, KEY_2 … KEY_8. */
const keyRefsFor = (reference) => [
  reference,
  ...Array.from({ length: MAX_KEY_REFS - 1 }, (_, index) => `${reference}_${index + 2}`),
];

/**
 * The settings page's field table: one row per `SETTINGS_SPEC` entry, saying which card
 * the field belongs to, whether it sits on the card face or behind a folded group, and
 * which host control renders it. `lib/settings.js` owns kind, bounds and enum members;
 * `test/client-settings-table.test.js` reconciles the two tables so this one cannot
 * drift. Values and defaults are never copied here: the page reads them from the host's
 * configuration snapshot.
 */
const SETTINGS_UI = [
  { key: 'searchMode', card: 'search', group: null, level: 'common', kind: 'enum', control: 'menu', options: ['fast', 'quality'] },
  { key: 'fetchMode', card: 'fetch', group: null, level: 'common', kind: 'enum', control: 'menu', options: ['fast', 'clean'] },
  { key: 'qualityMaxEngines', card: 'search', group: 'quality', level: 'advanced', kind: 'number', control: 'number', min: 1, max: 8 },
  { key: 'qualityRerankEnabled', card: 'search', group: null, level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'qualityExcludedProviders', card: 'search', group: 'quality', level: 'advanced', kind: 'order', control: 'text' },
  { key: 'fastPrimaryProvider', card: 'search', group: 'quality', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'fastMaxFallbacks', card: 'search', group: 'quality', level: 'advanced', kind: 'number', control: 'number', min: 0, max: 5 },
  { key: 'cleanExtractProviders', card: 'fetch', group: 'enrich', level: 'advanced', kind: 'order', control: 'text' },
  { key: 'intentRouting', card: 'search', group: null, level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'languageRouting', card: 'fetch', group: null, level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'officialDocsEnabled', card: 'search', group: null, level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'newsFreshnessEnabled', card: 'search', group: null, level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'chineseSearchOrder', card: 'routing', group: 'orders', level: 'advanced', kind: 'order', control: 'text' },
  { key: 'defaultSearchOrder', card: 'routing', group: 'orders', level: 'advanced', kind: 'order', control: 'text' },
  { key: 'fetchOrder', card: 'routing', group: 'orders', level: 'advanced', kind: 'order', control: 'text' },
  { key: 'cleanFetchOrder', card: 'routing', group: 'orders', level: 'advanced', kind: 'order', control: 'text' },
  { key: 'anysearchEnabled', card: 'backends', group: 'backend:anysearch', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'anysearchApiKeyEnv', card: 'backends', group: 'backend:anysearch', level: 'common', kind: 'string', control: 'text' },
  { key: 'anysearchBaseURL', card: 'backends', group: 'backend:anysearch', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'anysearchSearchEnabled', card: 'backends', group: 'backend:anysearch', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'anysearchFetchEnabled', card: 'backends', group: 'backend:anysearch', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'anysearchTag', card: 'backends', group: 'backend:anysearch', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'anysearchZone', card: 'backends', group: 'backend:anysearch', level: 'common', kind: 'enum', control: 'menu', options: ['auto', 'cn', 'intl'] },
  { key: 'anysearchCleanContent', card: 'backends', group: 'backend:anysearch', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'anysearchBatchEnabled', card: 'backends', group: 'backend:anysearch', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'keenableEnabled', card: 'backends', group: 'backend:keenable', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'keenableApiKeyEnv', card: 'backends', group: 'backend:keenable', level: 'common', kind: 'string', control: 'text' },
  { key: 'keenableBaseURL', card: 'backends', group: 'backend:keenable', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'keenableSearchEnabled', card: 'backends', group: 'backend:keenable', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'keenableFetchEnabled', card: 'backends', group: 'backend:keenable', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'exaEnabled', card: 'backends', group: 'backend:exa', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'exaApiKeyEnv', card: 'backends', group: 'backend:exa', level: 'common', kind: 'string', control: 'text' },
  { key: 'exaBaseURL', card: 'backends', group: 'backend:exa', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'exaSearchEnabled', card: 'backends', group: 'backend:exa', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'exaFetchEnabled', card: 'backends', group: 'backend:exa', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'bingEnabled', card: 'backends', group: 'backend:bing', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'bingBaseURL', card: 'backends', group: 'backend:bing', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'bingMarket', card: 'backends', group: 'backend:bing', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'githubEnabled', card: 'backends', group: 'backend:github', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'githubApiKeyEnv', card: 'backends', group: 'backend:github', level: 'common', kind: 'string', control: 'text' },
  { key: 'githubBaseURL', card: 'backends', group: 'backend:github', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'githubSearchEnabled', card: 'backends', group: 'backend:github', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'githubFetchEnabled', card: 'backends', group: 'backend:github', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'anysearchMaxRenderedContentChars', card: 'backends', group: 'backend:anysearch', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'tavilyEnabled', card: 'backends', group: 'backend:tavily', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'tavilyApiKeyEnv', card: 'backends', group: 'backend:tavily', level: 'common', kind: 'string', control: 'text' },
  { key: 'tavilyBaseURL', card: 'backends', group: 'backend:tavily', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'tavilySearchEnabled', card: 'backends', group: 'backend:tavily', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'tavilyFetchEnabled', card: 'backends', group: 'backend:tavily', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'tavilyIncludeAnswer', card: 'backends', group: 'backend:tavily', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'firecrawlEnabled', card: 'backends', group: 'backend:firecrawl', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'firecrawlApiKeyEnv', card: 'backends', group: 'backend:firecrawl', level: 'common', kind: 'string', control: 'text' },
  { key: 'firecrawlBaseURL', card: 'backends', group: 'backend:firecrawl', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'firecrawlSearchEnabled', card: 'backends', group: 'backend:firecrawl', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'firecrawlFetchEnabled', card: 'backends', group: 'backend:firecrawl', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'zhihuEnabled', card: 'backends', group: 'backend:zhihu', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'zhihuApiKeyEnv', card: 'backends', group: 'backend:zhihu', level: 'common', kind: 'string', control: 'text' },
  { key: 'zhihuBaseURL', card: 'backends', group: 'backend:zhihu', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'zhihuSearchEnabled', card: 'backends', group: 'backend:zhihu', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'zhihuSearchMode', card: 'backends', group: 'backend:zhihu', level: 'common', kind: 'enum', control: 'menu', options: ['global', 'site'] },
  { key: 'zhihuIncludeMetadata', card: 'backends', group: 'backend:zhihu', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'httpEnabled', card: 'backends', group: 'backend:http', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'aihotEnabled', card: 'backends', group: 'backend:aihot', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'aihotBaseURL', card: 'backends', group: 'backend:aihot', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'xToolsEnabled', card: 'backends', group: 'backend:x', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'xToolsCookieRef', card: 'backends', group: 'backend:x', level: 'common', kind: 'string', control: 'text' },
  { key: 'siliconflowEnabled', card: 'backends', group: 'backend:siliconflow', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'siliconflowApiKeyEnv', card: 'backends', group: 'backend:siliconflow', level: 'common', kind: 'string', control: 'text' },
  { key: 'siliconflowBaseURL', card: 'backends', group: 'backend:siliconflow', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'siliconflowRerankModel', card: 'backends', group: 'backend:siliconflow', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'siliconflowEmbeddingsEnabled', card: 'backends', group: 'backend:siliconflow', level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'siliconflowEmbeddingModel', card: 'backends', group: 'backend:siliconflow', level: 'advanced', kind: 'string', control: 'text' },
  { key: 'semanticDedupThreshold', card: 'search', group: 'quality', level: 'advanced', kind: 'number', control: 'number', min: 0, max: 1 },
  { key: 'enrichEnabled', card: 'fetch', group: null, level: 'common', kind: 'boolean', control: 'switch' },
  { key: 'enrichTopN', card: 'fetch', group: 'enrich', level: 'advanced', kind: 'number', control: 'number', min: 0, max: 10 },
  { key: 'enrichSummaryMinChars', card: 'fetch', group: 'enrich', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'enrichSummaryMaxChars', card: 'fetch', group: 'enrich', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'requestTimeoutMs', card: 'routing', group: 'limits', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'maxFetchChars', card: 'routing', group: 'limits', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'maxSnippetChars', card: 'routing', group: 'limits', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'minDirectHtmlChars', card: 'routing', group: 'limits', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'searchCacheTtlMs', card: 'routing', group: 'limits', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'searchCacheMaxEntries', card: 'routing', group: 'limits', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'fetchCacheTtlMs', card: 'routing', group: 'limits', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'fetchCacheMaxEntries', card: 'routing', group: 'limits', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'fallbackFailureClasses', card: 'routing', group: 'fallback', level: 'advanced', kind: 'failure-classes', control: 'checkgroup', options: ['quota', 'auth', 'bot-wall', 'transient', 'invalid-response', 'unknown'] },
  { key: 'breakerFailureThreshold', card: 'routing', group: 'fallback', level: 'advanced', kind: 'number', control: 'number', min: 1 },
  { key: 'breakerCooldownMs', card: 'routing', group: 'fallback', level: 'advanced', kind: 'number', control: 'number', min: 1 },
];

/**
 * One row per backend group of the backends card; the field table names these groups
 * `backend:<id>`. `needsKey` drives the credential controls, `quota` the usage line,
 * `canVerify` the test button, and `special` the one extra control a backend has.
 *
 * `keyKind` says how the backend treats its credential, read off the provider code
 * rather than guessed: `required` means the provider refuses to run without it
 * (`requireKey` in `lib/providers/`), `optional` means it runs anonymously but a
 * key raises the allowance or the quota tier (`anysearch`, `keenable`, `github`),
 * and `none` means it has no credential at all (`bing`, `aihot`, `http`).
 */
const BACKENDS = [
  { id: 'anysearch', labelKey: 'backendAnysearch', descKey: 'backendAnysearchDesc', toggleKey: 'anysearchEnabled', refKey: 'anysearchApiKeyEnv', needsKey: true, keyKind: 'optional', quota: false, canVerify: true, special: 'zone' },
  { id: 'keenable', labelKey: 'backendKeenable', descKey: 'backendKeenableDesc', toggleKey: 'keenableEnabled', refKey: 'keenableApiKeyEnv', needsKey: true, keyKind: 'optional', quota: true, canVerify: true, special: null },
  { id: 'exa', labelKey: 'backendExa', descKey: 'backendExaDesc', toggleKey: 'exaEnabled', refKey: 'exaApiKeyEnv', needsKey: true, keyKind: 'required', quota: false, canVerify: true, special: null },
  { id: 'bing', labelKey: 'backendBing', descKey: 'backendBingDesc', toggleKey: 'bingEnabled', refKey: null, needsKey: false, keyKind: 'none', quota: false, canVerify: true, special: null },
  { id: 'github', labelKey: 'backendGithub', descKey: 'backendGithubDesc', toggleKey: 'githubEnabled', refKey: 'githubApiKeyEnv', needsKey: true, keyKind: 'optional', quota: true, canVerify: true, special: null },
  { id: 'tavily', labelKey: 'backendTavily', descKey: 'backendTavilyDesc', toggleKey: 'tavilyEnabled', refKey: 'tavilyApiKeyEnv', needsKey: true, keyKind: 'required', quota: true, canVerify: true, special: null },
  { id: 'firecrawl', labelKey: 'backendFirecrawl', descKey: 'backendFirecrawlDesc', toggleKey: 'firecrawlEnabled', refKey: 'firecrawlApiKeyEnv', needsKey: true, keyKind: 'required', quota: true, canVerify: true, special: null },
  { id: 'zhihu', labelKey: 'backendZhihu', descKey: 'backendZhihuDesc', toggleKey: 'zhihuEnabled', refKey: 'zhihuApiKeyEnv', needsKey: true, keyKind: 'required', quota: true, canVerify: true, special: 'searchMode' },
  { id: 'aihot', labelKey: 'backendAihot', descKey: 'backendAihotDesc', toggleKey: 'aihotEnabled', refKey: null, needsKey: false, keyKind: 'none', quota: false, canVerify: true, special: null },
  { id: 'http', labelKey: 'backendHttp', descKey: 'backendHttpDesc', toggleKey: 'httpEnabled', refKey: null, needsKey: false, keyKind: 'none', quota: false, canVerify: false, special: null },
  { id: 'x', labelKey: 'backendX', descKey: 'backendXDesc', toggleKey: 'xToolsEnabled', refKey: 'xToolsCookieRef', needsKey: true, keyKind: 'required', quota: false, canVerify: true, special: 'cookie' },
  { id: 'siliconflow', labelKey: 'backendSiliconflow', descKey: 'backendSiliconflowDesc', toggleKey: 'siliconflowEnabled', refKey: 'siliconflowApiKeyEnv', needsKey: true, keyKind: 'required', quota: true, canVerify: false, special: 'models' },
];

/** The page's four task cards, in render order. */
const CARDS = [
  { id: 'search', titleKey: 'cardSearch', descKey: 'cardSearchDesc' },
  { id: 'fetch', titleKey: 'cardFetch', descKey: 'cardFetchDesc' },
  { id: 'backends', titleKey: 'cardBackends', descKey: 'cardBackendsDesc' },
  { id: 'routing', titleKey: 'cardRouting', descKey: 'cardRoutingDesc' },
];

window.__ModuleLoader__.load({
  id: '@qikairo7/dsh-web-search',
  // Pure helpers exposed for unit tests; the host reads only `id` and `factory`.
  splitKeyInput,
  applyKeyPlan,
  beginKeySave,
  saveKey,
  humanizeVerifyError,
  maskSavedKey,
  SETTINGS_UI,
  BACKENDS,
  CARDS,
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const UI = require('@deepseek-ai/dsh-client-ui-primitives');
    const NS = 'dshWebSearchSettings';
    const PACKAGE = '@qikairo7/dsh-web-search';
    const SETTINGS_NS = 'web-search-router';

    const ROWS_BY_KEY = new Map(SETTINGS_UI.map((row) => [row.key, row]));
    const BACKENDS_BY_ID = new Map(BACKENDS.map((backend) => [backend.id, backend]));

    const capital = (value) => value.charAt(0).toUpperCase() + value.slice(1);
    const fieldLabelKey = (key) => `f${capital(key)}`;
    const fieldHintKey = (key) => `h${capital(key)}`;
    const optionLabelKey = (value) => `opt${capital(value)}`;
    const failureClassKey = (value) => `fc${value.split('-').map(capital).join('')}`;
    const groupTitleKey = (group) => `group${capital(group)}`;

    const en = {
      title: 'Web search router',
      intro: 'Choose how search and fetch pick backends, which credentials each one uses, and where fallback goes. Saving writes only what you changed.',
      loading: 'Loading settings…',
      unavailable: 'The host does not serve this plugin\u2019s settings right now.',
      credentialsFailed: 'The credential status could not be read, so the key badges may be stale.',
      readOnly: 'This deployment stores settings read-only.',
      save: 'Save',
      saving: 'Saving…',
      saveFailed: 'The host refused the save. Fix the marked field and try again.',
      cardSearch: 'Search',
      cardSearchDesc: 'How a search picks its backends, and what runs after the merge.',
      cardFetch: 'Fetch',
      cardFetchDesc: 'How fetching a single URL picks its extractor, and what gets added to the result.',
      cardBackends: 'Backends and credentials',
      cardBackendsDesc: 'Turn backends on, pair each with credentials, and see which ones are ready.',
      cardRouting: 'Routing order and fallback',
      cardRoutingDesc: 'Which backend answers first, when to try the next one, and the limits every request lives under.',
      groupQuality: 'Quality parameters',
      groupEnrich: 'Evidence enrichment',
      groupOrders: 'Order tables',
      groupLimits: 'Limits and caches',
      groupFallback: 'Fallback and breaker',
      optFast: 'Fast',
      optQuality: 'Quality',
      optClean: 'Clean',
      optAuto: 'Auto',
      optCn: 'China',
      optIntl: 'International',
      optGlobal: 'Whole site',
      optSite: 'Site only',
      backendAnysearch: 'AnySearch', backendAnysearchDesc: 'Free search and fetch pool.',
      backendKeenable: 'Keenable', backendKeenableDesc: 'Free pool with a monthly quota.',
      backendExa: 'Exa', backendExaDesc: 'Neural search with its own reader.',
      backendBing: 'Bing', backendBingDesc: 'The keyless search floor.',
      backendGithub: 'GitHub', backendGithubDesc: 'Code and issue search through the official API.',
      backendTavily: 'Tavily', backendTavilyDesc: 'Paid search fallback, also used for the docs and news supplements.',
      backendFirecrawl: 'Firecrawl', backendFirecrawlDesc: 'Paid fetch fallback.',
      backendZhihu: 'Zhihu', backendZhihuDesc: 'Chinese community search.',
      backendAihot: 'AIHOT', backendAihotDesc: 'AI news source.',
      backendHttp: 'Direct HTTP', backendHttpDesc: 'Fetches a URL without an extractor.',
      backendX: 'X search', backendXDesc: 'Read-only post search.',
      backendSiliconflow: 'SiliconFlow', backendSiliconflowDesc: 'BGE rerank and embeddings.',
      fSearchMode: 'Search mode', hSearchMode: 'Quality merges free sources, reranks, and enriches the top five. Fast walks one backend at a time.',
      fFetchMode: 'Fetch mode', hFetchMode: 'Fast prefers a direct HTTP fetch. Clean prefers the extraction engines.',
      fQualityMaxEngines: 'Parallel engines', hQualityMaxEngines: 'How many engines quality mode queries at once (1-8).',
      fQualityRerankEnabled: 'Quality rerank', hQualityRerankEnabled: 'Rerank the merged results with BGE.',
      fQualityExcludedProviders: 'Excluded from quality', hQualityExcludedProviders: 'Comma-separated backend ids such as tavily,firecrawl. Empty excludes nothing.',
      fFastPrimaryProvider: 'Fast primary backend', hFastPrimaryProvider: 'Backend id, for example keenable. Empty follows the routing table.',
      fFastMaxFallbacks: 'Fast fallbacks', hFastMaxFallbacks: 'How many more backends to try after the first one fails (0-5).',
      fCleanExtractProviders: 'Clean extraction engines', hCleanExtractProviders: 'Comma-separated backend ids, in preference order.',
      fIntentRouting: 'Intent routing', hIntentRouting: 'Use the role-table order when a technical, news or Chinese-community route matches.',
      fLanguageRouting: 'Language routing', hLanguageRouting: 'Detect the query language and pass it to Tavily and AnySearch.',
      fOfficialDocsEnabled: 'Official docs supplement', hOfficialDocsEnabled: 'Run one restricted search when no official domain was hit.',
      fNewsFreshnessEnabled: 'News freshness supplement', hNewsFreshnessEnabled: 'Run one news search when free results are too old.',
      fChineseSearchOrder: 'Chinese query order', hChineseSearchOrder: 'Comma-separated backend ids for queries with Han characters.',
      fDefaultSearchOrder: 'Default search order', hDefaultSearchOrder: 'Comma-separated backend ids used when no intent route matched.',
      fFetchOrder: 'Fast fetch order', hFetchOrder: 'Comma-separated backend ids, in fallback order.',
      fCleanFetchOrder: 'Clean fetch order', hCleanFetchOrder: 'Comma-separated backend ids, in fallback order.',
      fAnysearchEnabled: 'Enable AnySearch', hAnysearchEnabled: 'Free pool that serves both search and fetch.',
      fAnysearchApiKeyEnv: 'Credential reference', hAnysearchApiKeyEnv: 'For example ANYSEARCH_API_KEY. The key itself goes in the key boxes below.',
      fAnysearchBaseURL: 'API base URL', hAnysearchBaseURL: 'Empty uses the default endpoint.',
      fAnysearchSearchEnabled: 'AnySearch search', hAnysearchSearchEnabled: 'Off removes it from search routing.',
      fAnysearchFetchEnabled: 'AnySearch fetch', hAnysearchFetchEnabled: 'Off removes it from fetch routing.',
      fAnysearchTag: 'Vertical tag', hAnysearchTag: 'Empty runs a general search.',
      fAnysearchZone: 'Search zone', hAnysearchZone: 'Auto lets the service decide; the other two pin the region.',
      fAnysearchCleanContent: 'Clean content', hAnysearchCleanContent: 'Whether a fetch cleans the returned body.',
      fAnysearchBatchEnabled: 'Batch search tool', hAnysearchBatchEnabled: 'Whether to register anysearch_batch_search.',
      fAnysearchMaxRenderedContentChars: 'Batch content cap', hAnysearchMaxRenderedContentChars: 'Characters of body text shown to the model per call.',
      fKeenableEnabled: 'Enable Keenable', hKeenableEnabled: 'Free pool with its own monthly quota.',
      fKeenableApiKeyEnv: 'Credential reference', hKeenableApiKeyEnv: 'For example KEENABLE_API_KEY. The key itself goes in the key boxes below.',
      fKeenableBaseURL: 'API base URL', hKeenableBaseURL: 'Empty uses the default endpoint.',
      fKeenableSearchEnabled: 'Keenable search', hKeenableSearchEnabled: 'Off removes it from search routing.',
      fKeenableFetchEnabled: 'Keenable fetch', hKeenableFetchEnabled: 'Off removes it from fetch routing.',
      fExaEnabled: 'Enable Exa', hExaEnabled: 'Neural search plus its own reader.',
      fExaApiKeyEnv: 'Credential reference', hExaApiKeyEnv: 'For example EXA_API_KEY. The key itself goes in the key boxes below.',
      fExaBaseURL: 'API base URL', hExaBaseURL: 'Empty uses the default endpoint.',
      fExaSearchEnabled: 'Exa search', hExaSearchEnabled: 'Off removes it from search routing.',
      fExaFetchEnabled: 'Exa fetch', hExaFetchEnabled: 'Off removes it from fetch routing.',
      fBingEnabled: 'Enable Bing', hBingEnabled: 'The keyless search floor. It needs no credentials.',
      fBingBaseURL: 'SERP base URL', hBingBaseURL: 'Empty uses the default endpoint.',
      fBingMarket: 'Market code', hBingMarket: 'Sent as mkt when set. Empty lets Bing localize on its own.',
      fGithubEnabled: 'Enable GitHub', hGithubEnabled: 'Code and issue search through the official API.',
      fGithubApiKeyEnv: 'Credential reference', hGithubApiKeyEnv: 'Optional: anonymous requests work too. The token itself goes in the key boxes below.',
      fGithubBaseURL: 'API base URL', hGithubBaseURL: 'Empty uses the default endpoint.',
      fGithubSearchEnabled: 'GitHub search', hGithubSearchEnabled: 'Off removes it from search routing.',
      fGithubFetchEnabled: 'GitHub fetch', hGithubFetchEnabled: 'Off removes it from fetch routing.',
      fTavilyEnabled: 'Enable Tavily', hTavilyEnabled: 'Paid backend used as the last search fallback.',
      fTavilyApiKeyEnv: 'Credential reference', hTavilyApiKeyEnv: 'For example TAVILY_API_KEY. The key itself goes in the key boxes below.',
      fTavilyBaseURL: 'API base URL', hTavilyBaseURL: 'Empty uses the default endpoint.',
      fTavilySearchEnabled: 'Tavily search', hTavilySearchEnabled: 'Off removes it from search routing.',
      fTavilyFetchEnabled: 'Tavily fetch', hTavilyFetchEnabled: 'Off removes it from fetch routing.',
      fTavilyIncludeAnswer: 'Include the Tavily answer', hTavilyIncludeAnswer: 'Merge the Tavily answer into the web_search body.',
      fFirecrawlEnabled: 'Enable Firecrawl', hFirecrawlEnabled: 'Paid backend used as the last fetch fallback.',
      fFirecrawlApiKeyEnv: 'Credential reference', hFirecrawlApiKeyEnv: 'For example FIRECRAWL_API_KEY. The key itself goes in the key boxes below.',
      fFirecrawlBaseURL: 'API base URL', hFirecrawlBaseURL: 'Empty uses the default endpoint.',
      fFirecrawlSearchEnabled: 'Firecrawl search', hFirecrawlSearchEnabled: 'Off removes it from search routing.',
      fFirecrawlFetchEnabled: 'Firecrawl fetch', hFirecrawlFetchEnabled: 'Off removes it from fetch routing.',
      fZhihuEnabled: 'Enable Zhihu', hZhihuEnabled: 'Chinese community search through the developer API.',
      fZhihuApiKeyEnv: 'Credential reference', hZhihuApiKeyEnv: 'The Access Secret reference, for example ZHIHU_API_KEY. The secret itself goes in the key boxes below.',
      fZhihuBaseURL: 'API base URL', hZhihuBaseURL: 'Empty uses the default endpoint.',
      fZhihuSearchEnabled: 'Zhihu search', hZhihuSearchEnabled: 'Off removes it from search routing.',
      fZhihuSearchMode: 'Search scope', hZhihuSearchMode: 'Whole site searches all of Zhihu; site only searches inside the query\u2019s own site.',
      fZhihuIncludeMetadata: 'Include metadata', hZhihuIncludeMetadata: 'Add the author, upvote and comment counts to the summary.',
      fHttpEnabled: 'Enable direct HTTP fetch', hHttpEnabled: 'Fetches a URL without a third-party extractor. It needs no credentials.',
      fAihotEnabled: 'Enable AIHOT', hAihotEnabled: 'An AI news source that needs no credentials.',
      fAihotBaseURL: 'API base URL', hAihotBaseURL: 'Empty uses the default endpoint.',
      fXToolsEnabled: 'Enable X search', hXToolsEnabled: 'Read-only post search. Off by default.',
      fXToolsCookieRef: 'Cookie reference', hXToolsCookieRef: 'The browser cookie reference, for example X_COOKIE. The cookie itself goes in the key box below.',
      fSiliconflowEnabled: 'Enable SiliconFlow rerank', hSiliconflowEnabled: 'BGE rerank and embeddings for quality mode.',
      fSiliconflowApiKeyEnv: 'Credential reference', hSiliconflowApiKeyEnv: 'For example SILICONFLOW_API_KEY. The key itself goes in the key boxes below.',
      fSiliconflowBaseURL: 'API base URL', hSiliconflowBaseURL: 'Empty uses the default endpoint.',
      fSiliconflowRerankModel: 'Rerank model', hSiliconflowRerankModel: 'The model id quality mode reranks with.',
      fSiliconflowEmbeddingsEnabled: 'Enable semantic dedup', hSiliconflowEmbeddingsEnabled: 'Drop near-duplicate results using their embeddings.',
      fSiliconflowEmbeddingModel: 'Embedding model', hSiliconflowEmbeddingModel: 'The model id semantic dedup embeds with.',
      fSemanticDedupThreshold: 'Semantic dedup threshold', hSemanticDedupThreshold: 'Cosine similarity above which two results count as one (0-1). Higher keeps more.',
      fEnrichEnabled: 'Evidence enrichment', hEnrichEnabled: 'Fetch the first few results and regenerate their summaries.',
      fEnrichTopN: 'Enriched results', hEnrichTopN: 'How many of the first results get enriched (0-10).',
      fEnrichSummaryMinChars: 'Minimum summary length', hEnrichSummaryMinChars: 'The shortest summary enrichment may write.',
      fEnrichSummaryMaxChars: 'Maximum summary length', hEnrichSummaryMaxChars: 'The longest summary enrichment may write.',
      fRequestTimeoutMs: 'Request timeout (ms)', hRequestTimeoutMs: 'How long one backend call may take.',
      fMaxFetchChars: 'Fetch body limit', hMaxFetchChars: 'The most characters web_fetch returns.',
      fMaxSnippetChars: 'Snippet limit', hMaxSnippetChars: 'The most characters one search summary may carry.',
      fMinDirectHtmlChars: 'SPA shell threshold', hMinDirectHtmlChars: 'Direct HTML shorter than this counts as an app shell, not a page.',
      fSearchCacheTtlMs: 'Search cache TTL (ms)', hSearchCacheTtlMs: 'How long a search answer stays cached.',
      fSearchCacheMaxEntries: 'Search cache entries', hSearchCacheMaxEntries: 'How many search answers the cache keeps.',
      fFetchCacheTtlMs: 'Fetch cache TTL (ms)', hFetchCacheTtlMs: 'How long a fetched page stays cached.',
      fFetchCacheMaxEntries: 'Fetch cache entries', hFetchCacheMaxEntries: 'How many fetched pages the cache keeps.',
      fFallbackFailureClasses: 'Failure classes that fall back', hFallbackFailureClasses: 'Leave all unchecked to stop on any failure instead of trying the next backend.',
      fBreakerFailureThreshold: 'Breaker threshold', hBreakerFailureThreshold: 'Consecutive failures before a backend starts cooling down.',
      fBreakerCooldownMs: 'Breaker cooldown (ms)', hBreakerCooldownMs: 'How long a backend stays out after it trips.',
      credentialHint: 'The reference names an environment key or a stored credential. The key itself is written below, never shown back.',
      keySlot: 'Key {n}',
      keyHint: 'Written to the host credential store. A stored key never comes back, so this box starts empty.',
      cookieSlot: 'Cookie',
      configured: 'Configured',
      notConfigured: 'Not configured',
      addKey: 'Add key',
      removeKey: 'Remove',
      clearKeys: 'Clear all keys',
      confirmClear: 'Click again to clear',
      saveKey: 'Save key',
      savedKey: 'Saved a key for {name}.',
      clearedKey: 'Cleared the keys for {name}.',
      cookieSaved: 'Cookie imported.',
      oneKeyPerBox: 'One key per box. Use Add key for another one.',
      enterKey: 'Type a key first.',
      keySaveFailed: 'The key could not be saved. Try again.',
      verify: 'Verify',
      verifying: 'Verifying…',
      verifyOk: 'Ready in {ms} ms, {count} results.',
      verifyFailed: 'Verify failed: {reason}',
      verifyFailedNoDetail: 'Verify failed. Check the network and try again.',
      quotaUnsupported: 'Usage is not available for this backend.',
      quotaLoading: 'Read usage',
      quotaLabel: 'Usage: {text}',
      quotaFailed: 'Usage could not be read: {reason}',
      quotaFailedNoDetail: 'Usage could not be read.',
      loadModels: 'Load models',
      modelsLoading: 'Loading models…',
      modelsLoaded: '{count} models loaded.',
      modelsFailed: 'Models could not be loaded: {reason}',
      modelsFailedNoDetail: 'Models could not be loaded.',
      pickModel: 'Pick a model',
      backendConfigured: 'Configured',
      backendMissingKey: 'Missing credentials',
      backendAnonymous: 'Works anonymously',
      backendKeyless: 'No key needed',
      backendOff: 'Off',
      backendUnverified: 'Not verified',
      backendVerified: 'Verified',
      enableBackend: 'Enable {name}',
      fcQuota: 'quota: 402/429 rate limit', fcAuth: 'auth: 401/403', fcBotWall: 'bot wall: target blocked us',
      fcTransient: 'transient: timeouts and 5xx', fcInvalidResponse: 'invalid response: broken or empty',
      fcUnknown: 'unknown: any other recoverable failure',
      numberInvalid: 'Enter a number.',
      numberRangeInvalid: 'Enter a number between {min} and {max}.',
      unsaved: 'Not saved',
      undo: 'Undo',
      advanced: 'Advanced settings',
      expandGroup: 'Show {name}',
      collapseGroup: 'Hide {name}',
    };

    const zh = {
      title: '网页搜索路由器',
      intro: '设置搜索与抓取各走哪些后端、各自用哪份凭据、失败后往哪退。保存只写入你改过的项。',
      loading: '正在读取设置…',
      unavailable: '宿主当前没有提供这个插件的设置域。',
      credentialsFailed: '凭据状态读取失败，密钥的配置标记可能不准。',
      readOnly: '当前部署以只读方式保存设置。',
      save: '保存',
      saving: '保存中…',
      saveFailed: '宿主拒绝了这次保存。改掉标记的字段后重试。',
      cardSearch: '搜索',
      cardSearchDesc: '搜索选哪些后端，合并之后还做什么。',
      cardFetch: '抓取',
      cardFetchDesc: '抓一个 URL 时用哪个抽取引擎，结果里加什么。',
      cardBackends: '后端与凭据',
      cardBackendsDesc: '开关后端、配上凭据，并看清谁已经就绪。',
      cardRouting: '路由顺序与回退',
      cardRoutingDesc: '谁先答、什么时候换下一家，以及每次请求的限额。',
      groupQuality: '质量参数',
      groupEnrich: '证据增强',
      groupOrders: '顺序表',
      groupLimits: '限额与缓存',
      groupFallback: '回退与熔断',
      optFast: '快速',
      optQuality: '质量',
      optClean: '干净',
      optAuto: '自动',
      optCn: '中文区',
      optIntl: '国际区',
      optGlobal: '全网',
      optSite: '站内',
      backendAnysearch: 'AnySearch', backendAnysearchDesc: '免费搜索与抓取池。',
      backendKeenable: 'Keenable', backendKeenableDesc: '带月度额度的免费池。',
      backendExa: 'Exa', backendExaDesc: '神经搜索加自带 reader。',
      backendBing: 'Bing', backendBingDesc: '免 Key 的搜索保底。',
      backendGithub: 'GitHub', backendGithubDesc: '通过官方 API 搜索代码与 issue。',
      backendTavily: 'Tavily', backendTavilyDesc: '付费搜索兜底，官方文档与新闻补充也用它。',
      backendFirecrawl: 'Firecrawl', backendFirecrawlDesc: '付费抓取兜底。',
      backendZhihu: '知乎', backendZhihuDesc: '中文社区搜索。',
      backendAihot: 'AIHOT', backendAihotDesc: 'AI 新闻源。',
      backendHttp: '直连 HTTP', backendHttpDesc: '不经抽取器直接抓页面。',
      backendX: 'X 搜索', backendXDesc: '只读推文搜索。',
      backendSiliconflow: 'SiliconFlow', backendSiliconflowDesc: 'BGE 重排与向量。',
      fSearchMode: '搜索模式', hSearchMode: '质量模式合并免费源后重排，并增强前五条证据；快速模式单后端按顺序。',
      fFetchMode: '抓取模式', hFetchMode: '快速优先直连 HTTP；干净优先正文抽取引擎。',
      fQualityMaxEngines: '并行引擎数', hQualityMaxEngines: '质量模式一次并行查询几个引擎（1-8）。',
      fQualityRerankEnabled: '质量重排', hQualityRerankEnabled: '用 BGE 重排合并后的结果。',
      fQualityExcludedProviders: '质量模式排除的后端', hQualityExcludedProviders: '逗号分隔的后端 id，例如 tavily,firecrawl；留空不排除。',
      fFastPrimaryProvider: '快速模式首选后端', hFastPrimaryProvider: '后端 id，例如 keenable；留空按路由表。',
      fFastMaxFallbacks: '快速模式回退家数', hFastMaxFallbacks: '首选失败后再试几家（0-5）。',
      fCleanExtractProviders: '干净抓取抽取引擎', hCleanExtractProviders: '逗号分隔的后端 id，按优先顺序。',
      fIntentRouting: '意图路由', hIntentRouting: '命中技术、新闻或中文社区路由时改用角色表顺序。',
      fLanguageRouting: '语言路由', hLanguageRouting: '检测查询语言并传给 Tavily 与 AnySearch。',
      fOfficialDocsEnabled: '官方文档补充', hOfficialDocsEnabled: '结果未命中官方域时补一次受限搜索。',
      fNewsFreshnessEnabled: '新闻时效补充', hNewsFreshnessEnabled: '新闻查询的免费结果太旧时补一次新闻搜索。',
      fChineseSearchOrder: '含中文查询的搜索顺序', hChineseSearchOrder: '逗号分隔的后端 id，用于含汉字的查询。',
      fDefaultSearchOrder: '默认搜索顺序', hDefaultSearchOrder: '逗号分隔的后端 id，未命中意图路由时使用。',
      fFetchOrder: '快速抓取顺序', hFetchOrder: '逗号分隔的后端 id，按回退顺序。',
      fCleanFetchOrder: '干净抓取顺序', hCleanFetchOrder: '逗号分隔的后端 id，按回退顺序。',
      fAnysearchEnabled: '启用 AnySearch', hAnysearchEnabled: '免费额度池，搜索与抓取都能用。',
      fAnysearchApiKeyEnv: '凭据引用名', hAnysearchApiKeyEnv: '例如 ANYSEARCH_API_KEY。Key 本体写在下面的密钥框里。',
      fAnysearchBaseURL: 'API 地址', hAnysearchBaseURL: '留空用默认地址。',
      fAnysearchSearchEnabled: 'AnySearch 搜索', hAnysearchSearchEnabled: '关掉后不参与搜索路由。',
      fAnysearchFetchEnabled: 'AnySearch 抓取', hAnysearchFetchEnabled: '关掉后不参与抓取路由。',
      fAnysearchTag: '垂直领域 tag', hAnysearchTag: '留空走通用搜索。',
      fAnysearchZone: '搜索区域', hAnysearchZone: '自动由服务端判断；另外两个把区域钉死。',
      fAnysearchCleanContent: '正文清洗', hAnysearchCleanContent: '抓取时是否清洗返回的正文。',
      fAnysearchBatchEnabled: '批量搜索工具', hAnysearchBatchEnabled: '是否注册 anysearch_batch_search。',
      fAnysearchMaxRenderedContentChars: '批量正文上限', hAnysearchMaxRenderedContentChars: '单次向模型展示的正文字符数。',
      fKeenableEnabled: '启用 Keenable', hKeenableEnabled: '带月度额度的免费池。',
      fKeenableApiKeyEnv: '凭据引用名', hKeenableApiKeyEnv: '例如 KEENABLE_API_KEY。Key 本体写在下面的密钥框里。',
      fKeenableBaseURL: 'API 地址', hKeenableBaseURL: '留空用默认地址。',
      fKeenableSearchEnabled: 'Keenable 搜索', hKeenableSearchEnabled: '关掉后不参与搜索路由。',
      fKeenableFetchEnabled: 'Keenable 抓取', hKeenableFetchEnabled: '关掉后不参与抓取路由。',
      fExaEnabled: '启用 Exa', hExaEnabled: '神经搜索加自带 reader。',
      fExaApiKeyEnv: '凭据引用名', hExaApiKeyEnv: '例如 EXA_API_KEY。Key 本体写在下面的密钥框里。',
      fExaBaseURL: 'API 地址', hExaBaseURL: '留空用默认地址。',
      fExaSearchEnabled: 'Exa 搜索', hExaSearchEnabled: '关掉后不参与搜索路由。',
      fExaFetchEnabled: 'Exa 抓取', hExaFetchEnabled: '关掉后不参与抓取路由。',
      fBingEnabled: '启用 Bing', hBingEnabled: '免 Key 的搜索保底，不需要任何凭据。',
      fBingBaseURL: 'SERP 地址', hBingBaseURL: '留空用默认地址。',
      fBingMarket: '市场代码', hBingMarket: '非空时作为 mkt 发送；留空由 Bing 自行本地化。',
      fGithubEnabled: '启用 GitHub', hGithubEnabled: '通过官方 API 搜索代码与 issue。',
      fGithubApiKeyEnv: '凭据引用名', hGithubApiKeyEnv: '可选，匿名请求也能用。Token 本体写在下面的密钥框里。',
      fGithubBaseURL: 'API 地址', hGithubBaseURL: '留空用默认地址。',
      fGithubSearchEnabled: 'GitHub 搜索', hGithubSearchEnabled: '关掉后不参与搜索路由。',
      fGithubFetchEnabled: 'GitHub 抓取', hGithubFetchEnabled: '关掉后不参与抓取路由。',
      fTavilyEnabled: '启用 Tavily', hTavilyEnabled: '付费后端，作为搜索的最后一层兜底。',
      fTavilyApiKeyEnv: '凭据引用名', hTavilyApiKeyEnv: '例如 TAVILY_API_KEY。Key 本体写在下面的密钥框里。',
      fTavilyBaseURL: 'API 地址', hTavilyBaseURL: '留空用默认地址。',
      fTavilySearchEnabled: 'Tavily 搜索', hTavilySearchEnabled: '关掉后不参与搜索路由。',
      fTavilyFetchEnabled: 'Tavily 抓取', hTavilyFetchEnabled: '关掉后不参与抓取路由。',
      fTavilyIncludeAnswer: '并入 Tavily 答案', hTavilyIncludeAnswer: '把 Tavily 的答案并进 web_search 正文。',
      fFirecrawlEnabled: '启用 Firecrawl', hFirecrawlEnabled: '付费后端，作为抓取的最后一层兜底。',
      fFirecrawlApiKeyEnv: '凭据引用名', hFirecrawlApiKeyEnv: '例如 FIRECRAWL_API_KEY。Key 本体写在下面的密钥框里。',
      fFirecrawlBaseURL: 'API 地址', hFirecrawlBaseURL: '留空用默认地址。',
      fFirecrawlSearchEnabled: 'Firecrawl 搜索', hFirecrawlSearchEnabled: '关掉后不参与搜索路由。',
      fFirecrawlFetchEnabled: 'Firecrawl 抓取', hFirecrawlFetchEnabled: '关掉后不参与抓取路由。',
      fZhihuEnabled: '启用知乎', hZhihuEnabled: '通过开发者 API 搜索中文社区内容。',
      fZhihuApiKeyEnv: '凭据引用名', hZhihuApiKeyEnv: '填 Access Secret 的引用名，例如 ZHIHU_API_KEY。Secret 本体写在下面的密钥框里。',
      fZhihuBaseURL: 'API 地址', hZhihuBaseURL: '留空用默认地址。',
      fZhihuSearchEnabled: '知乎搜索', hZhihuSearchEnabled: '关掉后不参与搜索路由。',
      fZhihuSearchMode: '搜索范围', hZhihuSearchMode: '全网搜整个知乎；站内只搜查询自带的站点。',
      fZhihuIncludeMetadata: '带元数据', hZhihuIncludeMetadata: '摘要里加作者、赞同与评论数。',
      fHttpEnabled: '启用直连 HTTP 抓取', hHttpEnabled: '不经第三方抽取器直接抓页面，不需要凭据。',
      fAihotEnabled: '启用 AIHOT', hAihotEnabled: 'AI 新闻源，不需要凭据。',
      fAihotBaseURL: 'API 地址', hAihotBaseURL: '留空用默认地址。',
      fXToolsEnabled: '启用 X 搜索', hXToolsEnabled: '只读推文搜索，默认关闭。',
      fXToolsCookieRef: 'Cookie 引用名', hXToolsCookieRef: '填浏览器导出的 Cookie 引用名，例如 X_COOKIE。Cookie 本体写在下面的密钥框里。',
      fSiliconflowEnabled: '启用 SiliconFlow 重排', hSiliconflowEnabled: '质量模式的 BGE 重排与向量。',
      fSiliconflowApiKeyEnv: '凭据引用名', hSiliconflowApiKeyEnv: '例如 SILICONFLOW_API_KEY。Key 本体写在下面的密钥框里。',
      fSiliconflowBaseURL: 'API 地址', hSiliconflowBaseURL: '留空用默认地址。',
      fSiliconflowRerankModel: '重排模型', hSiliconflowRerankModel: '质量模式重排用的模型 id。',
      fSiliconflowEmbeddingsEnabled: '启用语义去重', hSiliconflowEmbeddingsEnabled: '用向量把近乎重复的结果去掉。',
      fSiliconflowEmbeddingModel: 'Embedding 模型', hSiliconflowEmbeddingModel: '语义去重用的模型 id。',
      fSemanticDedupThreshold: '语义去重阈值', hSemanticDedupThreshold: '余弦相似度超过这条线算重复（0-1），越大留得越多。',
      fEnrichEnabled: '证据增强', hEnrichEnabled: '抓取前几条结果正文并重新生成摘要。',
      fEnrichTopN: '增强条数', hEnrichTopN: '参与增强的前几条结果（0-10）。',
      fEnrichSummaryMinChars: '摘要最小字符数', hEnrichSummaryMinChars: '增强摘要能写的最短长度。',
      fEnrichSummaryMaxChars: '摘要最大字符数', hEnrichSummaryMaxChars: '增强摘要能写的最长长度。',
      fRequestTimeoutMs: '请求超时（毫秒）', hRequestTimeoutMs: '单次后端调用最多等多久。',
      fMaxFetchChars: '抓取正文上限', hMaxFetchChars: 'web_fetch 最多返回多少字符。',
      fMaxSnippetChars: '摘要上限', hMaxSnippetChars: '每条搜索摘要最多多少字符。',
      fMinDirectHtmlChars: 'SPA 空壳阈值', hMinDirectHtmlChars: '直连 HTML 短于这个字符数就当作应用空壳，不是正文页。',
      fSearchCacheTtlMs: '搜索缓存 TTL（毫秒）', hSearchCacheTtlMs: '一条搜索答案缓存多久。',
      fSearchCacheMaxEntries: '搜索缓存条数', hSearchCacheMaxEntries: '缓存最多留几条搜索答案。',
      fFetchCacheTtlMs: '抓取缓存 TTL（毫秒）', hFetchCacheTtlMs: '抓下来的页面缓存多久。',
      fFetchCacheMaxEntries: '抓取缓存条数', hFetchCacheMaxEntries: '缓存最多留几个抓取的页面。',
      fFallbackFailureClasses: '允许回退的失败类别', hFallbackFailureClasses: '全不选表示任何失败都直接中止，不换下一家。',
      fBreakerFailureThreshold: '熔断阈值', hBreakerFailureThreshold: '连续失败多少次后开始冷却。',
      fBreakerCooldownMs: '冷却时长（毫秒）', hBreakerCooldownMs: '熔断后这个后端停多久。',
      credentialHint: '引用名指向环境变量或凭据库里的一条凭据。Key 本体在下面写入，不会回显。',
      keySlot: 'Key {n}',
      keyHint: '写入宿主的凭据库。已存的 Key 不会回显，所以这个框总是空的。',
      cookieSlot: 'Cookie',
      configured: '已配置',
      notConfigured: '未配置',
      addKey: '添加 Key',
      removeKey: '移除',
      clearKeys: '清除全部 Key',
      confirmClear: '再点一次确认清除',
      saveKey: '保存 Key',
      savedKey: '已保存 {name} 的 Key。',
      clearedKey: '已清除 {name} 的 Key。',
      cookieSaved: '已导入 Cookie。',
      oneKeyPerBox: '一个框只写一个 Key。多加一个 Key 用「添加 Key」。',
      enterKey: '先填一个 Key。',
      keySaveFailed: 'Key 没有存进去，请重试。',
      verify: '验证',
      verifying: '验证中…',
      verifyOk: '{ms} 毫秒就绪，{count} 条结果。',
      verifyFailed: '验证失败：{reason}',
      verifyFailedNoDetail: '验证失败，请检查网络后重试。',
      quotaUnsupported: '这个后端查不到剩余额度。',
      quotaLoading: '查额度',
      quotaLabel: '剩余额度：{text}',
      quotaFailed: '额度读取失败：{reason}',
      quotaFailedNoDetail: '额度读取失败。',
      loadModels: '拉取模型',
      modelsLoading: '正在拉取模型…',
      modelsLoaded: '拉到 {count} 个模型。',
      modelsFailed: '模型拉取失败：{reason}',
      modelsFailedNoDetail: '模型拉取失败。',
      pickModel: '选一个模型',
      backendConfigured: '已配置',
      backendMissingKey: '缺凭据',
      backendAnonymous: '匿名可用',
      backendKeyless: '免 Key',
      backendOff: '已关闭',
      backendUnverified: '未验证',
      backendVerified: '已验证',
      enableBackend: '启用 {name}',
      fcQuota: 'quota：402/429 配额限流', fcAuth: 'auth：401/403 鉴权',
      fcBotWall: 'bot-wall：目标站点拦截', fcTransient: 'transient：超时与服务端错误',
      fcInvalidResponse: 'invalid-response：坏响应或空内容', fcUnknown: 'unknown：其余可恢复失败',
      numberInvalid: '填一个数字。',
      numberRangeInvalid: '填 {min} 到 {max} 之间的数字。',
      unsaved: '未保存',
      undo: '撤销',
      advanced: '高级设置',
      expandGroup: '展开 {name}',
      collapseGroup: '收起 {name}',
    };

/**
     * Build a human-readable reason from a management-route error body so the
     * settings page shows the server's real `code`/`message` (for example
     * `forbidden: same-origin request required`) instead of a generic failure.
     * @param {unknown} data - parsed JSON response body, possibly `{ ok:false, code, message }`.
     * @returns {string} reason text, or '' when the body carries neither field.
     */
    function serverReason(data) {
      if (data === null || typeof data !== 'object') return '';
      const code = typeof data.code === 'string' ? data.code : '';
      const message = typeof data.message === 'string' ? data.message : '';
      if (code && message) return `${code}: ${message}`;
      return message || code;
    }

    async function safeCall(call) {
      try {
        const result = await call();
        return result ?? { ok: false };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    }

    function isOk(result) {
      return result?.ok === true;
    }

    /** The model list each SiliconFlow model field picks from. */
    const MODEL_KIND = { siliconflowRerankModel: 'rerank', siliconflowEmbeddingModel: 'embedding' };

    /** Read one stored value as the draft text its control renders. */
    const formatField = (row, value) => {
      if (row.control === 'switch') return value === true;
      if (row.control === 'checkgroup') return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
      if (row.control === 'menu') return typeof value === 'string' && value.length > 0 ? value : (row.options?.[0] ?? '');
      if (row.kind === 'number') return typeof value === 'number' ? String(value) : '';
      return typeof value === 'string' ? value : '';
    };

    /**
     * Turn one staged draft into the write a save performs. A number outside the
     * spec's bounds is invalid: the host would refuse it, and the control says so
     * before the write instead of after it.
     * @param {object} row - the field table row.
     * @param {unknown} draft - the staged value.
     * @returns {{ kind: 'set', value: unknown } | { kind: 'unset' } | { kind: 'invalid' }}
     */
    const planField = (row, draft) => {
      if (row.control === 'switch') return { kind: 'set', value: draft === true };
      if (row.control === 'checkgroup') return { kind: 'set', value: Array.isArray(draft) ? draft : [] };
      if (row.control === 'menu') return { kind: 'set', value: String(draft) };
      const text = typeof draft === 'string' ? draft.trim() : '';
      if (row.kind === 'number') {
        if (text === '') return { kind: 'unset' };
        const value = Number(text);
        if (!Number.isFinite(value)) return { kind: 'invalid' };
        if (row.min !== undefined && value < row.min) return { kind: 'invalid' };
        if (row.max !== undefined && value > row.max) return { kind: 'invalid' };
        return { kind: 'set', value };
      }
      return text === '' ? { kind: 'unset' } : { kind: 'set', value: text };
    };

    /**
     * Stage edits over one host configuration form. The form owns the stored value,
     * the revision a save fences itself with, and the write; the draft owns what the
     * user typed and only becomes a write when they save. Leaving the page drops the
     * drafts, so nothing half-edited is ever stored.
     * @param {object} scope - `ctx.configForms.get(SETTINGS_NS)`.
     * @returns the draft the page renders and saves.
     */
    function createDraft(scope) {
      const staged = new Map();
      const listeners = new Set();
      let baselineRevision;
      let saving = false;
      let failed = false;
      const announce = () => { for (const listener of listeners) listener(); };
      return {
        subscribe(listener) {
          listeners.add(listener);
          return () => { listeners.delete(listener); };
        },
        snapshot() {
          return scope.getSnapshot();
        },
        field(key) {
          const row = ROWS_BY_KEY.get(key);
          const stored = formatField(row, scope.getSnapshot().value?.[key]);
          if (!staged.has(key)) return { value: stored, draft: false, invalid: false, stored };
          const value = staged.get(key);
          return { value, draft: true, invalid: planField(row, value).kind === 'invalid', stored };
        },
        shell() {
          const snapshot = scope.getSnapshot();
          let invalid = false;
          for (const [key, value] of staged) {
            if (planField(ROWS_BY_KEY.get(key), value).kind === 'invalid') invalid = true;
          }
          return {
            available: snapshot.status === 'ready',
            writable: snapshot.writable === true,
            dirty: staged.size > 0,
            invalid,
            saving,
            failed,
          };
        },
        edit(key, value) {
          baselineRevision ??= scope.getSnapshot().revision;
          staged.set(key, value);
          failed = false;
          announce();
        },
        undo(key) {
          if (!staged.delete(key)) return;
          if (staged.size === 0) baselineRevision = undefined;
          announce();
        },
        discard() {
          if (staged.size === 0 && !failed) return;
          staged.clear();
          baselineRevision = undefined;
          failed = false;
          announce();
        },
        async save() {
          const shell = this.shell();
          if (saving || !shell.available || !shell.writable || shell.invalid) return;
          const operations = [];
          for (const [key, value] of staged) {
            const planned = planField(ROWS_BY_KEY.get(key), value);
            if (planned.kind === 'invalid') return;
            operations.push(planned.kind === 'unset'
              ? { op: 'unset', path: [key] }
              : { op: 'set', path: [key], value: planned.value });
          }
          if (operations.length === 0) {
            staged.clear();
            announce();
            return;
          }
          saving = true;
          failed = false;
          announce();
          try {
            const accepted = await scope.mutate(operations, baselineRevision);
            if (accepted === true) {
              staged.clear();
              baselineRevision = undefined;
            } else {
              failed = true;
            }
          } catch {
            failed = true;
          } finally {
            saving = false;
            announce();
          }
        },
      };
    }

    /** One backend's credential reference, read from its own setting; '' when the user cleared it. */
    const referenceOf = (backend, draft) => (backend.refKey === null
      ? ''
      : String(draft.field(backend.refKey).value ?? '').trim());

    /** How many key boxes one backend shows: its configured keys plus the ones the user added, at least one. */
    const slotCount = (backend, reference, credentials, extra) => {
      if (reference === '') return 0;
      const configured = keyRefsFor(reference).filter((candidate) => credentials[candidate]?.configured === true).length;
      return Math.min(MAX_KEY_REFS, Math.max(1, configured) + (extra[backend.id] ?? 0));
    };

    /**
     * The page: four task cards over one host configuration form, with the credential
     * controls each backend owns. Reads ride the form's snapshot, writes ride its
     * atomic mutation, and credentials ride the host credential store.
     */
    function SettingsPage(props) {
      const { t } = props;
      const ctx = props.ctx;
      const [scope] = React.useState(() => ctx.configForms.get(SETTINGS_NS));
      const [draft] = React.useState(() => createDraft(scope));
      const [, setVersion] = React.useState(0);
      const [credentials, setCredentials] = React.useState({});
      const [credentialsError, setCredentialsError] = React.useState(false);
      const [keyTexts, setKeyTexts] = React.useState({});
      const [extraSlots, setExtraSlots] = React.useState({});
      const [expanded, setExpanded] = React.useState({});
      const [advancedOpen, setAdvancedOpen] = React.useState({});
      const [openGroups, setOpenGroups] = React.useState({});
      const [openMenu, setOpenMenu] = React.useState(null);
      const [messages, setMessages] = React.useState({});
      const [verifyPassed, setVerifyPassed] = React.useState({});
      const [verifyFailed, setVerifyFailed] = React.useState({});
      const [quotas, setQuotas] = React.useState({});
      const [models, setModels] = React.useState({ rerank: [], embedding: [] });
      const [modelMessage, setModelMessage] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [clearArmed, setClearArmed] = React.useState(null);
      const bump = () => setVersion((value) => value + 1);
      const note = (id, text, error = false) => setMessages((current) => ({ ...current, [id]: { text, error } }));

      const readCredentials = React.useCallback(async () => {
        const refs = BACKENDS.flatMap((backend) => {
          const reference = referenceOf(backend, draft);
          return reference === '' ? [] : keyRefsFor(reference);
        });
        const found = {};
        let anyBatchFailed = false;
        for (let i = 0; i < refs.length; i += 60) {
          const batch = refs.slice(i, i + 60);
          const batchResult = await safeCall(() => ctx.remote.credentials.describe(batch));
          if (isOk(batchResult)) Object.assign(found, batchResult.value);
          else anyBatchFailed = true;
        }
        setCredentials(found);
        setCredentialsError(anyBatchFailed);
      }, [ctx, draft]);

      const referenceSignature = BACKENDS.map((backend) => referenceOf(backend, draft)).join('|');

      React.useEffect(() => {
        const offDraft = draft.subscribe(bump);
        const offScope = scope.subscribe(bump);
        return () => {
          offDraft();
          offScope();
        };
      }, [draft, scope]);

      React.useEffect(() => {
        if (draft.snapshot().status !== 'ready') return;
        void readCredentials();
      }, [referenceSignature, readCredentials]);

      const readOnly = draft.snapshot().writable !== true;

      const verify = async (backend) => {
        setBusy(true);
        note(backend.id, t('verifying'));
        try {
          const response = await fetch('/dsh-web-search/health', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ providerId: backend.id, capability: 'search' }),
          });
          const data = await response.json();
          if (data?.ok === true) {
            setVerifyPassed((current) => ({ ...current, [backend.id]: true }));
            setVerifyFailed((current) => ({ ...current, [backend.id]: false }));
            note(backend.id, t('verifyOk', {
              ms: data.latencyMs === undefined ? '—' : data.latencyMs,
              count: data.count === undefined ? 0 : data.count,
            }));
          } else {
            const reason = humanizeVerifyError(data);
            setVerifyPassed((current) => ({ ...current, [backend.id]: false }));
            setVerifyFailed((current) => ({ ...current, [backend.id]: true }));
            note(backend.id, reason ? t('verifyFailed', { reason }) : t('verifyFailedNoDetail'), true);
          }
        } catch {
          note(backend.id, t('verifyFailedNoDetail'), true);
        } finally {
          setBusy(false);
        }
      };

      const readQuota = async (backend) => {
        setBusy(true);
        try {
          const response = await fetch('/dsh-web-search/quotas', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ providerIds: [backend.id] }),
          });
          const data = await response.json();
          if (data?.ok !== true) {
            const reason = serverReason(data);
            note(backend.id, reason ? t('quotaFailed', { reason }) : t('quotaFailedNoDetail'), true);
            return;
          }
          const entry = data.providers?.[backend.id];
          const text = entry?.ok === true && entry.remaining !== undefined
            ? String(entry.remaining)
            : t('quotaUnsupported');
          setQuotas((current) => ({ ...current, [backend.id]: text }));
        } catch (error) {
          const reason = error instanceof Error ? error.message : '';
          note(backend.id, reason ? t('quotaFailed', { reason }) : t('quotaFailedNoDetail'), true);
        } finally {
          setBusy(false);
        }
      };

      const loadModels = async () => {
        setBusy(true);
        setModelMessage(t('modelsLoading'));
        try {
          const next = { rerank: [], embedding: [] };
          for (const kind of ['rerank', 'embedding']) {
            const response = await fetch('/dsh-web-search/models', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ kind }),
            });
            const data = await response.json();
            if (data?.ok !== true) {
              const reason = serverReason(data);
              setModelMessage(reason ? t('modelsFailed', { reason }) : t('modelsFailedNoDetail'));
              return;
            }
            next[kind] = Array.isArray(data.models) ? data.models : [];
          }
          setModels(next);
          setModelMessage(t('modelsLoaded', { count: next.rerank.length + next.embedding.length }));
        } catch (error) {
          const reason = error instanceof Error ? error.message : '';
          setModelMessage(reason ? t('modelsFailed', { reason }) : t('modelsFailedNoDetail'));
        } finally {
          setBusy(false);
        }
      };

      const saveKeys = async (backend) => {
        const reference = referenceOf(backend, draft);
        if (reference === '') {
          note(backend.id, t('enterKey'), true);
          return;
        }
        if (backend.special === 'cookie') {
          const value = String(keyTexts[`${backend.id}:1`] ?? '').trim();
          if (value === '') {
            note(backend.id, t('enterKey'), true);
            return;
          }
          setBusy(true);
          const result = await safeCall(() => ctx.remote.credentials.set(reference, value));
          if (isOk(result)) {
            setKeyTexts((current) => ({ ...current, [`${backend.id}:1`]: '' }));
            note(backend.id, t('cookieSaved'));
            await readCredentials();
          } else {
            note(backend.id, t('keySaveFailed'), true);
          }
          setBusy(false);
          return;
        }
        const slots = keyRefsFor(reference);
        const writes = [];
        for (let index = 0; index < slots.length; index += 1) {
          const keys = splitKeyInput(keyTexts[`${backend.id}:${index + 1}`] ?? '');
          if (keys.length === 0) continue;
          if (keys.length > 1) {
            note(backend.id, t('oneKeyPerBox'), true);
            return;
          }
          writes.push({ ref: slots[index], value: keys[0] });
        }
        await saveKey({
          plan: { overflow: false, writes },
          setBusy,
          setCredential: (target, value) => safeCall(() => ctx.remote.credentials.set(target, value)),
          onRefused: () => note(backend.id, t('enterKey'), true),
          onSaved: async () => {
            setKeyTexts((current) => {
              const next = { ...current };
              for (const key of Object.keys(next)) {
                if (key.startsWith(`${backend.id}:`)) next[key] = '';
              }
              return next;
            });
            note(backend.id, t('savedKey', { name: t(backend.labelKey) }));
            await readCredentials();
          },
          onFailed: () => note(backend.id, t('keySaveFailed'), true),
        });
      };

      const removeKey = async (backend, slot) => {
        const reference = referenceOf(backend, draft);
        const candidate = keyRefsFor(reference)[slot - 1];
        const configured = reference !== '' && credentials[candidate]?.configured === true;
        if (!configured) {
          setExtraSlots((current) => ({
            ...current,
            [backend.id]: Math.max(0, (current[backend.id] ?? 0) - 1),
          }));
          setKeyTexts((current) => ({ ...current, [`${backend.id}:${slot}`]: '' }));
          return;
        }
        setBusy(true);
        const result = await safeCall(() => ctx.remote.credentials.unset(candidate));
        if (isOk(result)) {
          note(backend.id, t('clearedKey', { name: t(backend.labelKey) }));
          await readCredentials();
        } else {
          note(backend.id, t('keySaveFailed'), true);
        }
        setBusy(false);
      };

      const clearKeys = async (backend) => {
        if (clearArmed !== backend.id) {
          setClearArmed(backend.id);
          return;
        }
        setClearArmed(null);
        const reference = referenceOf(backend, draft);
        setBusy(true);
        let failed = false;
        for (const candidate of keyRefsFor(reference)) {
          if (credentials[candidate]?.configured !== true) continue;
          const result = await safeCall(() => ctx.remote.credentials.unset(candidate));
          if (!isOk(result)) {
            failed = true;
            break;
          }
        }
        if (failed) note(backend.id, t('keySaveFailed'), true);
        else {
          note(backend.id, t('clearedKey', { name: t(backend.labelKey) }));
          await readCredentials();
        }
        setBusy(false);
      };

      const disabled = readOnly || busy;

      /**
       * The `data-field` anchor around one settings control; every field renders exactly
       * one. A control that draws its own label or hint (SettingsValueField does both)
       * passes `head`/`hint` false so the copy appears once.
       */
      const fieldAnchor = (row, children, head, hint) => h('div', { key: row.key, 'data-field': row.key },
        head ? h('span', null, t(fieldLabelKey(row.key))) : null,
        children,
        hint ? h('p', { id: `${row.key}-hint` }, t(fieldHintKey(row.key))) : null);

      const valueField = (row) => {
        const state = draft.field(row.key);
        const kind = MODEL_KIND[row.key];
        const candidates = kind === undefined ? [] : models[kind];
        const bounds = row.min !== undefined && row.max !== undefined;
        return fieldAnchor(row, [
          h(UI.SettingsValueField, {
            key: 'value',
            id: `dsh-web-search-${row.key}`,
            label: t(fieldLabelKey(row.key)),
            hint: t(fieldHintKey(row.key)),
            text: String(state.value ?? ''),
            overridden: state.draft,
            overriddenLabel: t('unsaved'),
            resetLabel: t('undo'),
            invalid: state.invalid,
            invalidLabel: bounds
              ? t('numberRangeInvalid', { min: row.min, max: row.max })
              : t('numberInvalid'),
            numeric: row.kind === 'number',
            disabled,
            onEdit: (text) => draft.edit(row.key, text),
            onReset: () => draft.undo(row.key),
          }),
          candidates.length === 0 ? null : h(UI.Menu, {
            key: 'models',
            open: openMenu === row.key,
            items: candidates.map((id) => ({ id, label: id })),
            selectedId: String(state.value ?? ''),
            onSelect: (id) => {
              draft.edit(row.key, id);
              setOpenMenu(null);
            },
            onClose: () => setOpenMenu(null),
            anchor: h(UI.Button, {
              variant: 'outline',
              size: 'sm',
              onClick: () => setOpenMenu(openMenu === row.key ? null : row.key),
            }, t('pickModel')),
          }),
        ], false, false);
      };

      const menuField = (row) => {
        const state = draft.field(row.key);
        const open = openMenu === row.key;
        const label = t(fieldLabelKey(row.key));
        return fieldAnchor(row, h(UI.Menu, {
          open,
          items: (row.options ?? []).map((option) => ({ id: option, label: t(optionLabelKey(option)) })),
          selectedId: String(state.value ?? ''),
          onSelect: (id) => {
            draft.edit(row.key, id);
            setOpenMenu(null);
          },
          onClose: () => setOpenMenu(null),
          anchor: h(UI.Button, {
            variant: 'outline',
            size: 'sm',
            disabled,
            onClick: () => setOpenMenu(open ? null : row.key),
          }, `${t(fieldLabelKey(row.key))}: ${t(optionLabelKey(String(state.value ?? '')))}`),
        }), false, true);
      };

      const switchField = (row) => {
        const state = draft.field(row.key);
        return fieldAnchor(row, h(UI.Switch, {
          checked: state.value === true,
          label: t(fieldLabelKey(row.key)),
          describedBy: `${row.key}-hint`,
          disabled,
          onChange: (next) => draft.edit(row.key, next),
        }), true, true);
      };

      const checkGroupField = (row) => {
        const state = draft.field(row.key);
        const selected = new Set(Array.isArray(state.value) ? state.value : []);
        const options = row.options ?? [];
        return fieldAnchor(row, h('div', null, ...options.map((option) => h(UI.Checkbox, {
          key: option,
          checked: selected.has(option),
          label: t(failureClassKey(option)),
          disabled,
          onChange: (next) => {
            const wanted = new Set(selected);
            if (next) wanted.add(option);
            else wanted.delete(option);
            draft.edit(row.key, options.filter((item) => wanted.has(item)));
          },
        }))), true, true);
      };

      const fieldNode = (row) => {
        if (row.control === 'switch') return switchField(row);
        if (row.control === 'menu') return menuField(row);
        if (row.control === 'checkgroup') return checkGroupField(row);
        return valueField(row);
      };

      const groupBody = (rowsInGroup) => h('div', { hidden: openGroups[rowsInGroup[0].group] !== true },
        ...rowsInGroup.map(fieldNode));

      /** One backend's header (status, enable switch) and body (fields, keys, actions). */
      const backendGroup = (backend) => {
        const rowsOfBackend = SETTINGS_UI.filter((row) => row.group === `backend:${backend.id}`);
        const name = t(backend.labelKey);
        const open = expanded[backend.id] === true;
        const shown = rowsOfBackend.filter((row) => row.level === 'common');
        const advanced = rowsOfBackend.filter((row) => row.level !== 'common');
        const reference = referenceOf(backend, draft);
        const slots = slotCount(backend, reference, credentials, extraSlots);
        const configured = reference !== '' && credentials[reference]?.configured === true;
        const message = messages[backend.id];
        const quota = quotas[backend.id];
        const restored = verifyPassed[backend.id] === true;
        const failed = verifyFailed[backend.id] === true;
        const enabled = draft.field(backend.toggleKey).value === true;
        // The credential state reads off `keyKind`: a backend that needs no key
        // is always ready, one whose key is optional runs anonymously until a key
        // is stored, and one that requires a key is only ready once it is stored.
        const keyState = backend.keyKind === 'none'
          ? { state: 'done', text: t('backendKeyless') }
          : configured
            ? { state: 'done', text: t('backendConfigured') }
            : backend.keyKind === 'optional'
              ? { state: 'idle', text: t('backendAnonymous') }
              : { state: 'warning', text: t('backendMissingKey') };
        const status = failed
          ? { state: 'warning', text: t('backendUnverified') }
          : restored
            ? { state: 'done', text: t('backendVerified') }
            : enabled
              ? keyState
              : { state: 'idle', text: t('backendOff') };
        const slotNodes = [];
        for (let slot = 1; slot <= slots; slot += 1) {
          const candidate = keyRefsFor(reference)[slot - 1];
          const slotText = String(keyTexts[`${backend.id}:${slot}`] ?? '');
          const slotConfigured = credentials[candidate]?.configured === true;
          slotNodes.push(h('div', { key: `slot-${slot}`, 'data-secret': `${backend.id}:${slot}` },
            h(UI.SettingsSecretField, {
              id: `dsh-web-search-${backend.id}-key-${slot}`,
              label: backend.special === 'cookie' ? t('cookieSlot') : t('keySlot', { n: slot }),
              hint: t('keyHint'),
              text: slotText,
              disabled,
              configured: slotConfigured,
              stateLabel: slotConfigured ? t('configured') : t('notConfigured'),
              onEdit: (text) => setKeyTexts((current) => ({ ...current, [`${backend.id}:${slot}`]: text })),
            }),
            h(UI.Button, {
              variant: 'ghost',
              size: 'sm',
              disabled,
              onClick: () => { void removeKey(backend, slot); },
            }, t('removeKey'))));
        }
        return h('tr', { key: backend.id, 'data-backend': backend.id },
          h('td', null,
            h(UI.DisclosureRow, {
              icon: null,
              title: name,
              open,
              expandable: true,
              onToggle: () => setExpanded((current) => ({ ...current, [backend.id]: open !== true })),
              collapsedContent: h('span', null,
                h(UI.StateDot, { state: status.state }),
                ' ',
                status.text),              headerAccessory: null,
            }),
            h('div', { hidden: !open, 'data-backend-body': backend.id },
              ...shown.map(fieldNode),
              advanced.length === 0 ? null : h('div', { key: 'advanced', 'data-group': `${backend.id}:advanced` },
                h(UI.Button, {
                  variant: 'ghost',
                  size: 'sm',
                  'aria-expanded': advancedOpen[backend.id] === true,
                  onClick: () => setAdvancedOpen((current) => ({ ...current, [backend.id]: current[backend.id] !== true })),
                }, advancedOpen[backend.id] === true ? t('collapseGroup', { name: t('advanced') }) : t('expandGroup', { name: t('advanced') })),
                h('div', { hidden: advancedOpen[backend.id] !== true }, ...advanced.map(fieldNode))),
              h('p', null, t('credentialHint')),
              h('div', { 'data-key-block': backend.id }, ...slotNodes),
              h('div', { 'data-backend-actions': backend.id },
                h(UI.Button, { variant: 'outline', size: 'sm', disabled, onClick: () => { void saveKeys(backend); } }, t('saveKey')),
                slots >= MAX_KEY_REFS || backend.special === 'cookie' ? null : h(UI.Button, {
                  variant: 'ghost',
                  size: 'sm',
                  disabled,
                  onClick: () => setExtraSlots((current) => ({ ...current, [backend.id]: (current[backend.id] ?? 0) + 1 })),
                }, t('addKey')),
                h(UI.Button, { variant: 'ghost', size: 'sm', disabled, onClick: () => { void clearKeys(backend); } },
                  clearArmed === backend.id ? t('confirmClear') : t('clearKeys')),
                backend.canVerify ? h(UI.Button, { variant: 'outline', size: 'sm', disabled, onClick: () => { void verify(backend); } }, busy ? t('verifying') : t('verify')) : null,
                backend.quota ? h(UI.Button, { variant: 'ghost', size: 'sm', disabled, onClick: () => { void readQuota(backend); } }, t('quotaLoading')) : null,
                backend.special === 'models' ? h(UI.Button, { variant: 'ghost', size: 'sm', disabled, onClick: () => { void loadModels(); } }, t('loadModels')) : null),
              quota === undefined ? null : h('p', { 'data-quota': backend.id }, t('quotaLabel', { text: quota })),
              message === undefined ? null : h('p', { role: 'status', 'data-message': backend.id }, message.text))),
          h('td', null,
            h(UI.Switch, {
              checked: enabled,
              label: t('enableBackend', { name }),
              disabled,
              onChange: (next) => draft.edit(backend.toggleKey, next),
            })));
      };

      /** One card: its title, its description, the fields that sit on the card face, and its folded groups. */
      const cardNode = (card) => {
        const cardRows = SETTINGS_UI.filter((row) => row.card === card.id);
        const face = cardRows.filter((row) => row.level === 'common' && row.group === null);
        const groups = [...new Set(cardRows.filter((row) => row.group !== null).map((row) => row.group))];
        const body = card.id === 'backends'
          ? h('table', { 'data-backend-table': 'yes' }, h('tbody', null, ...BACKENDS.map(backendGroup)))
          : [
            ...face.map(fieldNode),
            ...groups.map((group) => {
              const rowsInGroup = cardRows.filter((row) => row.group === group);
              return h('div', { key: group, 'data-group': group },
                h(UI.Button, {
                  variant: 'ghost',
                  size: 'sm',
                  'aria-expanded': openGroups[group] === true,
                  onClick: () => setOpenGroups((current) => ({ ...current, [group]: current[group] !== true })),
                }, `${openGroups[group] === true ? '▾' : '▸'} ${t(groupTitleKey(group))}`),
                groupBody(rowsInGroup));
            }),
          ];
        return h('section', { key: card.id, 'data-card': card.id },
          h('h3', null, t(card.titleKey)),
          h('p', null, t(card.descKey)),
          ...(Array.isArray(body) ? body : [body]));
      };

      const snapshot = draft.snapshot();
      const header = [h('h2', { key: 'title' }, t('title')), h('p', { key: 'intro' }, t('intro'))];
      if (snapshot.status === 'loading') {
        return h('section', { 'data-page': 'settings' }, ...header, h('p', null, t('loading')));
      }
      if (snapshot.status === 'unavailable') {
        return h('section', { 'data-page': 'settings' }, ...header,
          h('p', { role: 'status' }, t('unavailable')));
      }
      return h('section', { 'data-page': 'settings' },
        ...header,
        h(UI.SettingsForm, {
          labels: {
            unavailable: t('unavailable'),
            readOnly: t('readOnly'),
            saveFailed: t('saveFailed'),
            save: t('save'),
            saving: t('saving'),
          },
          state: draft.shell(),
          onSave: () => { void draft.save(); },
          onDiscard: () => draft.discard(),
          children: [
            ...CARDS.map(cardNode),
            credentialsError ? h('p', { key: 'credentials-error', role: 'status' }, t('credentialsFailed')) : null,
            modelMessage.length === 0 ? null : h('p', { key: 'models-message', role: 'status' }, modelMessage),
          ].filter((node) => node !== null),
        }));
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.credentials', 'configForms'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-web-search: settings locale');
        const t = ctx.locale.bind(NS);
        const Page = (props) => h(SettingsPage, { ...props, t, ctx });
        ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: PACKAGE,
          locale: NS,
        }, Page)), 'dsh-web-search: bundle settings page');
      },
    };
  },
});
})();
