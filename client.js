/** Web settings page for the dsh-web-search bundle. */

// IIFE keeps this bundle's declarations out of the classic-script global lexical scope shared by sibling bundles.
(() => {
/** Split one pasted key box into individual keys; comma, ideographic comma and whitespace separate. */
const splitKeyInput = (value) => String(value ?? '').split(/[\s,，]+/u).filter((key) => key.length > 0);

/**
 * Assign pasted keys to free numbered credential refs in order. More keys than free refs sets
 * overflow so the caller refuses the whole batch instead of silently truncating.
 */
const planKeyWrites = (rows, refs) => {
  const occupied = new Set(rows.filter((row) => row.ref !== null).map((row) => row.ref));
  const writes = [];
  for (const row of rows) {
    for (const key of splitKeyInput(row.value)) {
      const target = refs.find((candidate) => !occupied.has(candidate));
      if (target === undefined) return { writes, overflow: true };
      occupied.add(target);
      writes.push({ ref: target, value: key });
    }
  }
  return { writes, overflow: false };
};

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
 * Component-level key-save handler: build the write plan from the provider's current rows and
 * the target reference, then run it through saveKey so busy, refusal and result callbacks stay
 * in one place. Extracted from the settings-page factory so tests can drive the real flow (#174).
 */
const handleKeySave = async ({ rows, ref, setBusy, setCredential, onRefused, onSaved, onFailed }) => {
  await saveKey({
    plan: planKeyWrites(rows, keyRefsFor(ref)),
    setBusy,
    setCredential,
    onRefused,
    onSaved,
    onFailed,
  });
};

window.__ModuleLoader__.load({
  id: '@qikairo7/dsh-web-search',
  // Pure helpers exposed for unit tests; the host reads only `id` and `factory`.
  splitKeyInput,
  planKeyWrites,
  applyKeyPlan,
  beginKeySave,
  saveKey,
  handleKeySave,
  humanizeVerifyError,
  maskSavedKey,
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'dshWebSearchSettings';
    const PACKAGE = '@qikairo7/dsh-web-search';
    const SETTINGS_NS = 'web-search-router';

    const PROVIDERS = [
      {
        id: 'keenable',
        label: 'Keenable',
        refKey: 'keenableApiKeyEnv',
        defaultRef: 'KEENABLE_API_KEY',
        toggleKey: 'keenableEnabled',
        hintKey: 'hintKeenable',
        canSearch: true,
        canFetch: true,
        quota: true,
        verify: true,
        rateLimit: false,
        keyUrl: 'https://keenable.ai',
        role: 'both',
        anonymous: true,
      },
      {
        id: 'anysearch',
        label: 'AnySearch',
        refKey: 'anysearchApiKeyEnv',
        defaultRef: 'ANYSEARCH_API_KEY',
        toggleKey: 'anysearchEnabled',
        hintKey: 'hintAnysearch',
        canSearch: true,
        canFetch: true,
        quota: false,
        verify: true,
        rateLimit: false,
        keyUrl: 'https://anysearch.com',
        role: 'search',
        anonymous: true,
      },
      {
        id: 'github',
        label: 'GitHub',
        refKey: 'githubApiKeyEnv',
        defaultRef: 'GITHUB_TOKEN',
        toggleKey: 'githubEnabled',
        hintKey: 'hintGithub',
        canSearch: true,
        canFetch: true,
        quota: true,
        verify: true,
        rateLimit: false,
        keyUrl: 'https://github.com/settings/tokens',
        role: 'search',
        anonymous: true,
      },
      {
        id: 'exa',
        label: 'Exa',
        refKey: 'exaApiKeyEnv',
        defaultRef: 'EXA_API_KEY',
        toggleKey: 'exaEnabled',
        hintKey: 'hintExa',
        canSearch: true,
        canFetch: true,
        quota: false,
        verify: true,
        rateLimit: false,
        keyUrl: 'https://exa.ai',
        role: 'both',
      },
      {
        id: 'tavily',
        label: 'Tavily',
        refKey: 'tavilyApiKeyEnv',
        defaultRef: 'TAVILY_API_KEY',
        toggleKey: 'tavilyEnabled',
        hintKey: 'hintTavily',
        canSearch: true,
        canFetch: true,
        quota: true,
        verify: true,
        rateLimit: false,
        keyUrl: 'https://tavily.com',
        role: 'both',
      },
      {
        id: 'firecrawl',
        label: 'Firecrawl',
        refKey: 'firecrawlApiKeyEnv',
        defaultRef: 'FIRECRAWL_API_KEY',
        toggleKey: 'firecrawlEnabled',
        hintKey: 'hintFirecrawl',
        canSearch: true,
        canFetch: true,
        quota: true,
        verify: true,
        rateLimit: false,
        keyUrl: 'https://firecrawl.dev',
        role: 'fetch',
      },
      {
        id: 'zhihu',
        label: '知乎 / Zhihu',
        refKey: 'zhihuApiKeyEnv',
        defaultRef: 'ZHIHU_API_KEY',
        toggleKey: 'zhihuEnabled',
        hintKey: 'hintZhihu',
        canSearch: true,
        canFetch: false,
        quota: true,
        verify: true,
        rateLimit: false,
        keyUrl: 'https://developer.zhihu.com',
        role: 'search',
      },
      {
        id: 'siliconflow',
        label: 'SiliconFlow',
        refKey: 'siliconflowApiKeyEnv',
        defaultRef: 'SILICONFLOW_API_KEY',
        toggleKey: 'siliconflowEnabled',
        hintKey: 'hintSiliconflow',
        canSearch: false,
        canFetch: false,
        quota: true,
        verify: false,
        rateLimit: false,
        keyUrl: 'https://cloud.siliconflow.cn/account/ak',
        role: 'models',
      },
      {
        id: 'x',
        label: 'X / Twitter',
        refKey: 'xToolsCookieRef',
        defaultRef: 'X_COOKIE',
        toggleKey: 'xToolsEnabled',
        hintKey: 'hintX',
        authType: 'cookie',
        defaultEnabled: false,
        capabilitySwitch: false,
        canSearch: true,
        canFetch: false,
        quota: false,
        verify: true,
        rateLimit: false,
        independent: true,
        keyUrl: 'https://x.com',
        role: 'search',
      },
    ];

    const EXTRA_TOGGLES = [
      { key: 'aihotEnabled', label: 'AIHOT', hintKey: 'hintAihot' },
      { key: 'httpEnabled', label: 'HTTP', hintKey: 'hintHttp' },
    ];

    const SWITCHES = [
      { key: 'intentRouting', labelKey: 'intentRouting' },
      { key: 'languageRouting', labelKey: 'languageRouting' },
      { key: 'officialDocsEnabled', labelKey: 'officialDocsEnabled' },
      { key: 'newsFreshnessEnabled', labelKey: 'newsFreshnessEnabled' },
      { key: 'enrichEnabled', labelKey: 'enrichEnabled' },
    ];

    const MODEL_FIELDS = [
      { key: 'siliconflowRerankModel', labelKey: 'rerankModel', kind: 'rerank' },
      { key: 'siliconflowEmbeddingModel', labelKey: 'embeddingModel', kind: 'embedding' },
    ];

    const MODEL_DEFAULTS = {
      siliconflowRerankModel: 'BAAI/bge-reranker-v2-m3',
      siliconflowEmbeddingModel: 'BAAI/bge-m3',
    };

    const QUOTA_FIELDS = [
      { id: 'keenable', label: 'Keenable', freeKey: 'quotaKeenable' },
      { id: 'anysearch', label: 'AnySearch', freeKey: 'quotaAnysearch' },
      { id: 'github', label: 'GitHub', freeKey: 'quotaGithub' },
      { id: 'exa', label: 'Exa', freeKey: 'quotaExa' },
      { id: 'tavily', label: 'Tavily', freeKey: 'quotaTavily' },
      { id: 'firecrawl', label: 'Firecrawl', freeKey: 'quotaFirecrawl' },
      { id: 'zhihu', label: '知乎 / Zhihu', freeKey: 'quotaZhihu' },
      { id: 'siliconflow', label: 'SiliconFlow', freeKey: 'quotaSiliconflow' },
    ];

    const BOOLEAN_DEFAULTS = {
      intentRouting: true,
      languageRouting: true,
      officialDocsEnabled: true,
      newsFreshnessEnabled: true,
      enrichEnabled: true,
      tavilyIncludeAnswer: true,
      zhihuIncludeMetadata: true,
    };

    const en = {
      title: 'Search and fetch settings',
      intro: 'Choose the engines behind search and fetch, add keys, then confirm they still work. Keenable and AnySearch work without a key.',
      keysTitle: 'Provider API keys',
      keysHint: 'Keys are stored write-only in the DSH credential store. The page never reads a saved value back.',
      providersAnonymous: 'Anonymous or optional key',
      providersKey: 'Key required',
      providersTitle: 'Providers',
      modesTitle: 'Search behavior',
      modelsTitle: 'Rerank and embedding models',
      modelsHint: 'Pull the model roster from SiliconFlow, then choose the models used by quality mode.',
      rerankModel: 'Rerank model',
      embeddingModel: 'Embedding model',
      fetchModels: 'Pull models',
      modelsLoading: 'Loading models…',
      modelsLoaded: 'Loaded {count} model(s).',
      modelsFailed: 'Could not load models. Save a valid SiliconFlow key first.',
      refreshQuota: 'Refresh allowance',
      quotaLoading: 'Refreshing…',
      quotaRemaining: '{value} remaining',
      quotaFailed: 'Could not query allowance.',
      quotaKeenable: '100,000 requests/month with a key; 1,000/hour anonymous',
      quotaAnysearch: '1,000 searches/day with a key; anonymous access also works',
      quotaGithub: 'Anonymous 10 requests/min; 30/min with a PAT',
      quotaExa: '$10 free credits/month plus a one-time $10 bonus',
      quotaTavily: '1,000 credits/month',
      quotaFirecrawl: '1,000 credits/month',
      quotaZhihu: '5,000 global + 5,000 site searches/day',
      quotaSiliconflow: 'Free allowance for BGE rerank and embeddings',
      advancedTitle: 'Advanced',
      searchMode: 'Search mode',
      fetchMode: 'Fetch mode',
      fast: 'Fast',
      quality: 'Quality',
      clean: 'Clean',
      searchModeHint: 'Quality compares several engines for better results, a little slower. Fast asks one engine for speed.',
      fetchModeHint: 'Fast fetches the whole page for speed. Clean keeps only the article body.',
      configured: 'Configured',
      notConfigured: 'Not configured',
      fromEnvironment: 'From environment',
      fromStore: 'Credential store',
      statusUnknown: 'Status unknown',
      statusVerified: 'Configured · verified',
      loading: 'Loading settings…',
      retry: 'Retry',
      show: 'Show',
      hide: 'Hide',
      unsaved: 'Unsaved changes',
      unsavedCount: '{count} unsaved change(s)',
      discard: 'Discard',
      discardDone: 'Draft discarded.',
      draftHint: 'Draft change — applies when you save at the top',
      keyPlaceholder: 'Paste one key, or several separated by commas/spaces',
      apiKeyLabel: '{name} API key',
      keysCount: '{count} keys',
      tooManyKeys: 'Use at most 8 keys per provider.',
      savedKeyMasked: 'Saved key',
      addKey: 'Add key',
      removeKey: 'Delete key',
      addKeyLabel: 'Add key for {name}',
      removeKeyLabel: 'Delete key {index} for {name}',
      removeProvider: 'Remove',
      removeProviderLabel: 'Remove all keys for {name}',
      addAnotherKey: 'Add another key',
      searchApi: 'Search API',
      getKey: 'Get key ↗',
      keyStatusUsage: 'Usage',
      keyStatusRateLimit: 'Rate limit',
      keyStatusPlan: 'Plan',
      statusUnsupported: 'Not available',
      statusUnchecked: 'Not checked',
      statusFailed: 'Refresh failed',
      noSearchEngine: 'No search engine is enabled.',
      qualityDynamic: 'Will ask {names} in parallel ({count} engines you enabled), then merge with {model} reranking.',
      qualityDynamicNoRerank: 'Will ask {names} in parallel ({count} engines you enabled) and merge the results.',
      fastDynamic: 'Will ask {primary} first; if it fails, try up to {fallbacks} more engines.',
      fastDynamicAuto: 'Will pick the first engine automatically; if it fails, try up to {fallbacks} more engines.',
      cleanDynamic: 'Will extract the article body with {names} first.',
      customized: 'Customized',
      restoreDefaults: 'Restore defaults',
      qualityParams: 'Quality parameters',
      fastParams: 'Fast parameters',
      cleanParams: 'Clean parameters',
      maxEngines: 'Max parallel engines',
      participate: 'Participating engines',
      rerankEnabled: 'Rerank',
      primaryEngine: 'Primary engine',
      autoPick: 'Auto',
      fallbacks: 'Fallback engines',
      extractEngines: 'Extraction engines',
      savedKeyReadonly: 'Saved keys cannot be shown',
      summaryConfigured: '{count} of {total} providers configured',
      roleSearch: 'Search',
      enginesTitle: 'Engines',
      diagramQuery: 'Query',
      diagramQueryHint: 'Type what you need',
      diagramEngine: 'Engine',
      diagramEngineHint: 'Pick a provider',
      diagramResult: 'Result',
      diagramResultHint: 'Sources and content',
      sourceTitle: 'Source',
      sourceCode: 'Code name',
      sourceDocs: 'Docs',
      sourceDocsLink: 'GitHub repository ↗',
      tabOverview: 'Overview',
      tabEngines: 'Engines',
      tabModes: 'Modes and models',
      tabAdvanced: 'Advanced',
      quickEngines: 'Configure engines',
      readyTitle: 'Readiness',
      readyOkAnonymous: 'Search is ready ({mode} · {count} engine(s) work without a key; a key makes them stronger).',
      readyNone: 'No search engine is enabled yet.',
      readyMissing: 'Not ready yet: {names}.',
      readyGo: 'Open its card',
      pendingEngines: 'Missing keys: {names}',
      allEnginesReady: 'All enabled engines have keys',
      noVerify: 'No verification for this engine',
      quickModes: 'Search and fetch modes',
      quickAdvanced: 'Advanced switches',
      capSearch: 'Search',
      capFetch: 'Fetch',
      featuresTitle: 'Features',
      featureAnysearchTag: 'Vertical tag',
      featureAnysearchTagHint: 'AnySearch tag such as academic or finance; leave blank for general search.',
      featureAnysearchZone: 'Search region',
      zoneAuto: 'Auto',
      zoneCn: 'China',
      zoneIntl: 'International',
      featureCleanContent: 'Clean page content',
      featureCleanContentHint: 'Strip ads and menus when fetching, keep the article body.',
      featureBatch: 'Batch search tool',
      featureBatchHint: 'Register the anysearch_batch_search tool.',
      featureZhihuMode: 'Search scope',
      zhihuGlobal: 'Site-wide',
      zhihuSite: 'Zhihu only',
      modelCustom: 'Or type any model ID',
      verifyNoKey: 'Save a key before verifying',
      summarySuffix: 'ready',
      roleFetch: 'Fetch',
      roleBoth: 'Search + fetch',
      roleModels: 'Rerank',
      intentTitle: 'Search and fetch intent',
      intentHint: 'Set the global mode first; each engine below supplies one or both capabilities.',
      test: 'Test',
      testing: 'Testing…',
      testOk: '{name} responded in {ms} ms with {count} result(s).',
      testFailed: 'Verification failed. Check the key, network, or provider status.',
      testFailedDetail: '{name} — verification failed: {reason}',
      modelsFailedDetail: 'Could not load models: {reason}',
      quotaFailedDetail: 'Could not query allowance: {reason}',
      save: 'Save',
      confirm: 'Confirm',
      cancel: 'Cancel',
      saving: 'Saving…',
      saved: 'Saved.',
      savedKey: 'Saved {name} key.',
      clearedKey: 'Cleared {name} key.',
      saveFailed: 'The deployment refused the write. Check the key and try again.',
      configSaveFailed: 'The deployment refused these settings. Review the values and try again.',
      enterKey: 'Enter a key first.',
      clearConfirm: 'Clear all stored keys for {name}?',
      configSaved: 'Settings saved.',
      configNoChanges: 'No changes to save.',
      configConflict: 'Another change landed first. The page was refreshed; review and save again.',
      refresh: 'Refresh status',
      unavailable: 'The plugin settings are not available. Make sure the plugin is enabled.',
      readOnly: 'This deployment stores settings read-only. API keys can still be saved to the credential store.',
      hintKeenable: 'Free quota; anonymous access works, a key raises the quota.',
      hintAnysearch: 'Anonymous access works; a registered key raises the daily quota.',
      hintGithub: 'GitHub API search for repositories and issues; anonymous works, a PAT raises the quota.',
      hintExa: 'Semantic search and Contents fetch; required for the free depth hop.',
      hintTavily: 'Fallback search, news freshness, and PDF extraction; paid credits.',
      hintFirecrawl: 'Last-resort fetch for JS and PDF pages; paid credits.',
      hintZhihu: 'Chinese search; requires a Zhihu Open Platform Access Secret.',
      hintSiliconflow: 'BGE rerank and embeddings used by quality mode.',
      hintAihot: 'Anonymous AI-news source; no key.',
      hintHttp: 'Anonymous direct HTTP fetch; no key.',
      hintX: 'Read-only X tweet search through a browser cookie; independent tool, not part of web_search merging.',
      cookieHint: 'Paste the x.com cookie string exported from your browser, or import a cookie file.',
      cookieImport: 'Import cookie',
      cookieImported: 'Cookie imported',
      cookieFile: 'Cookie file',
      intentRouting: 'Intent routing',
      languageRouting: 'Language routing',
      officialDocsEnabled: 'Official docs supplement',
      newsFreshnessEnabled: 'News freshness supplement',
      enrichEnabled: 'Evidence enrichment',
      enabled: 'Enabled',
      disabled: 'Disabled',
      settingsSection: 'Connection',
      searchSection: 'Search',
      fetchSection: 'Fetch',
    };

    const zh = {
      title: '搜索与抓取设置',
      intro: '选好搜索和抓取用哪些引擎，把 Key 配好，再确认它们还能用。Keenable 和 AnySearch 不填 Key 也能开始。',
      keysTitle: '后端 API Key',
      keysHint: 'Key 只写入 DSH 凭据库，保存后不会回显原值。',
      providersAnonymous: '匿名可用 / Key 可选',
      providersKey: '需要 Key',
      providersTitle: '后端开关',
      modesTitle: '搜索行为',
      modelsTitle: '重排与嵌入模型',
      modelsHint: '从 SiliconFlow 拉取模型列表，再选择质量模式使用的重排与嵌入模型。',
      rerankModel: '重排模型',
      embeddingModel: 'Embedding 模型',
      fetchModels: '拉取模型',
      modelsLoading: '正在加载模型…',
      modelsLoaded: '已加载 {count} 个模型。',
      modelsFailed: '无法加载模型，请先保存有效的 SiliconFlow Key。',
      refreshQuota: '刷新额度',
      quotaLoading: '正在刷新…',
      quotaRemaining: '剩余 {value}',
      quotaFailed: '额度查询失败。',
      quotaKeenable: '有 Key 时 100,000 次/月；匿名 1,000 次/小时',
      quotaAnysearch: '有 Key 时 1,000 次搜索/天；匿名也可用',
      quotaGithub: '匿名 10 次/分钟；配置 PAT 后 30 次/分钟',
      quotaExa: '每月 10 美元免费额度 + 一次性 10 美元奖励',
      quotaTavily: '1,000 credits/月',
      quotaFirecrawl: '1,000 credits/月',
      quotaZhihu: '全网 5,000 次/天 + 站内 5,000 次/天',
      quotaSiliconflow: 'BGE 重排与 embeddings 的免费额度',
      advancedTitle: '高级',
      searchMode: '搜索模式',
      fetchMode: '抓取模式',
      fast: '快速',
      quality: '质量',
      clean: '干净',
      searchModeHint: '质量：多找几家对比，结果更准，稍慢一点。快速：只问一家，出结果快。',
      fetchModeHint: '快速：直接抓整页，速度优先。干净：只留正文，去掉广告和菜单，读起来舒服。',
      configured: '已配置',
      notConfigured: '未配置',
      fromEnvironment: '来自环境变量',
      fromStore: '凭据库',
      statusUnknown: '状态未知',
      statusVerified: '已配置 · 验证过',
      loading: '正在加载设置…',
      retry: '重试',
      show: '显示',
      hide: '隐藏',
      unsaved: '有未保存的改动',
      unsavedCount: '{count} 项未保存',
      discard: '放弃',
      discardDone: '已放弃草稿。',
      draftHint: '草稿改动——点顶部「保存」后生效',
      keyPlaceholder: '输入一个 Key，或粘贴多个（逗号/空格分隔）',
      apiKeyLabel: '{name} API Key',
      keysCount: '{count} 个 Key',
      tooManyKeys: '每个 Provider 最多 8 个 Key。',
      savedKeyMasked: '已保存 Key',
      addKey: '添加 Key',
      removeKey: '删除',
      addKeyLabel: '为 {name} 添加 Key',
      removeKeyLabel: '删除 {name} 的第 {index} 个 Key',
      removeProvider: '移除',
      removeProviderLabel: '移除 {name} 的全部 Key',
      addAnotherKey: '添加另一个密钥',
      searchApi: '搜索 API',
      getKey: '获取密钥 ↗',
      keyStatusUsage: '用量',
      keyStatusRateLimit: '限流恢复',
      keyStatusPlan: '套餐',
      statusUnsupported: '不支持',
      statusUnchecked: '待刷新',
      statusFailed: '刷新失败',
      noSearchEngine: '没有可用的搜索引擎。',
      qualityDynamic: '将同时询问 {names}（你开启的 {count} 家搜索），结果用 {model} 重排合并。',
      qualityDynamicNoRerank: '将同时询问 {names}（你开启的 {count} 家搜索），合并结果。',
      fastDynamic: '先问 {primary}；失败时最多再试 {fallbacks} 家。',
      fastDynamicAuto: '自动选择第一个引擎；失败时最多再试 {fallbacks} 家。',
      cleanDynamic: '优先用 {names} 抽取正文。',
      customized: '已自定义',
      restoreDefaults: '恢复默认',
      qualityParams: '质量参数',
      fastParams: '快速参数',
      cleanParams: '干净参数',
      maxEngines: '并行引擎上限',
      participate: '参与引擎',
      rerankEnabled: '重排',
      primaryEngine: '首选引擎',
      autoPick: '自动',
      fallbacks: '失败回退家数',
      extractEngines: '正文抽取引擎',
      savedKeyReadonly: '已保存的 Key 不会回显',
      summaryConfigured: '已配置 {count} / {total} 个后端',
      roleSearch: '搜索',
      enginesTitle: '引擎',
      diagramQuery: '查询',
      diagramQueryHint: '写下你要找的内容',
      diagramEngine: '引擎',
      diagramEngineHint: '选择搜索或抓取后端',
      diagramResult: '结果',
      diagramResultHint: '来源与正文',
      sourceTitle: '来源信息',
      sourceCode: '代码名',
      sourceDocs: '文档',
      sourceDocsLink: 'GitHub 仓库 ↗',
      tabOverview: '总览',
      tabEngines: '引擎',
      tabModes: '模式与模型',
      tabAdvanced: '高级',
      quickEngines: '去配引擎',
      readyTitle: '就绪状态',
      readyOkAnonymous: '搜索已就绪（{mode} · 匿名 {count} 家可用，配 Key 后更强）。',
      readyNone: '还没有开启任何搜索引擎。',
      readyMissing: '还差：{names}。',
      readyGo: '打开它的卡片',
      pendingEngines: '缺 Key：{names}',
      allEnginesReady: '启用的引擎都已配 Key',
      noVerify: '此引擎无验证',
      quickModes: '搜索与抓取模式',
      quickAdvanced: '高级开关',
      capSearch: '搜索',
      capFetch: '抓取',
      featuresTitle: '特性',
      featureAnysearchTag: '垂直领域标签',
      featureAnysearchTagHint: 'AnySearch 的 tag，如 academic、finance；留空走通用搜索。',
      featureAnysearchZone: '搜索区域',
      zoneAuto: '自动',
      zoneCn: '中国',
      zoneIntl: '国际',
      featureCleanContent: 'URL 清洗正文',
      featureCleanContentHint: '抓取时去掉广告和菜单，只留正文。',
      featureBatch: '批量搜索工具',
      featureBatchHint: '注册 anysearch_batch_search 工具。',
      featureZhihuMode: '搜索范围',
      zhihuGlobal: '全网',
      zhihuSite: '站内',
      modelCustom: '或直接输入模型 ID',
      verifyNoKey: '保存 Key 后可验证',
      summarySuffix: '已就绪',
      roleFetch: '抓取',
      roleBoth: '搜索 + 抓取',
      roleModels: '重排',
      intentTitle: '搜索与抓取意图',
      intentHint: '先定全局模式，下面的引擎分别供给搜索或抓取能力。',
      test: '验证',
      testing: '验证中…',
      testOk: '{name} 在 {ms} ms 内返回 {count} 条结果。',
      testFailed: '验证失败，请检查 Key、网络或 Provider 状态。',
      testFailedDetail: '{name} — 验证失败：{reason}',
      modelsFailedDetail: '无法加载模型：{reason}',
      quotaFailedDetail: '额度查询失败：{reason}',
      save: '保存',
      confirm: '确认',
      cancel: '取消',
      saving: '保存中…',
      saved: '已保存。',
      savedKey: '{name} Key 已保存。',
      clearedKey: '{name} Key 已清除。',
      saveFailed: '部署拒绝了写入，请检查 Key 后重试。',
      configSaveFailed: '部署拒绝了这些设置，请复核后重试。',
      enterKey: '请先输入 Key。',
      clearConfirm: '确认清除 {name} 的全部已保存 Key？',
      configSaved: '设置已保存。',
      configNoChanges: '没有需要保存的改动。',
      configConflict: '有另一处修改先落盘，页面已刷新，请复核后重新保存。',
      refresh: '刷新状态',
      unavailable: '插件设置当前不可用，请确认插件已启用。',
      readOnly: '当前部署以只读方式保存设置；API Key 仍可写入凭据库。',
      hintKeenable: '免费额度；可匿名使用，配置 Key 后额度更高。',
      hintAnysearch: '可匿名使用；注册 Key 后每日额度更高。',
      hintGithub: 'GitHub 官方 API：仓库与 issue 搜索；匿名可用，PAT 提额。',
      hintExa: '语义搜索与 Contents 抓取；免费深度回退需要它。',
      hintTavily: '搜索兜底、新闻时效与 PDF 抽取；消耗付费额度。',
      hintFirecrawl: 'JS/PDF 页面的最后兜底抓取；消耗付费额度。',
      hintZhihu: '中文搜索；需要知乎开放平台 Access Secret。',
      hintSiliconflow: '质量模式使用的 BGE 重排与 embeddings。',
      hintAihot: '匿名 AI 新闻源，无需 Key。',
      hintHttp: '匿名直连 HTTP 抓取，无需 Key。',
      hintX: '用浏览器 cookie 做 X 推文只读搜索；独立工具，不参与 web_search 合并。',
      cookieHint: '粘贴从浏览器导出的 x.com cookie 字符串，或导入 cookie 文件。',
      cookieImport: '导入 Cookie',
      cookieImported: 'Cookie 已导入',
      cookieFile: 'Cookie 文件',
      intentRouting: '意图路由',
      languageRouting: '语言路由',
      officialDocsEnabled: '官方文档补充',
      newsFreshnessEnabled: '新闻时效补充',
      enrichEnabled: '证据增强',
      enabled: '已启用',
      disabled: '已停用',
      settingsSection: '连接',
      searchSection: '搜索',
      fetchSection: '抓取',
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

    const styles = {
      section: {
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        maxWidth: '1120px',
        padding: '24px',
        borderRadius: '20px',
        background: 'color-mix(in srgb, var(--dsw-alias-bg-layer-1) 94%, var(--dsw-alias-label-primary) 6%)',
        color: 'var(--dsw-alias-label-primary)',
        boxSizing: 'border-box',
      },
      pageHead: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '20px',
        flexWrap: 'wrap',
      },
      heading: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 300,
        fontFamily: 'var(--dsw2-font-display)',
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
      },
      intro: {
        margin: '8px 0 0',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: '13px',
        lineHeight: 1.6,
        maxWidth: '60ch',
      },
      summary: {
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '9999px',
        background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 6%, var(--dsw-alias-bg-layer-1))',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '11px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      },
      summaryCount: {
        fontSize: '20px',
        fontWeight: 500,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--dsw-alias-label-primary)',
      },
      intentPanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '16px',
        background: 'var(--dsw-alias-bg-layer-1)',
        boxShadow: '0 1px 2px rgba(28,26,23,0.05)',
      },
      intentRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      },
      intentField: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
      workspace: {
        display: 'grid',
        gridTemplateColumns: '5fr 7fr',
        gap: '24px',
        alignItems: 'start',
      },
      engineList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '8px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '16px',
        background: 'color-mix(in srgb, var(--dsw-alias-bg-layer-1) 88%, var(--dsw-alias-label-primary) 12%)',
      },
      engineListHead: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '4px 8px 8px',
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-primary)',
      },
      engineItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        height: '40px',
        padding: '0 10px',
        border: 'none',
        borderRadius: '8px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        boxSizing: 'border-box',
      },
      engineItemOn: {
        background: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)',
        boxShadow: 'inset 3px 0 0 0 var(--dsw-alias-state-business-primary)',
      },
      engineItemName: {
        flex: '1 1 auto',
        fontSize: '14px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      engineItemNameOn: {
        fontWeight: 500,
      },
      engineItemRole: {
        fontSize: '12px',
        fontWeight: 400,
        color: 'var(--dsw-alias-label-tertiary)',
        whiteSpace: 'nowrap',
      },
      enginePanes: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minWidth: 0,
      },
      statusDot: {
        flex: '0 0 6px',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        boxSizing: 'border-box',
        border: 'none',
        background: 'var(--dsw-alias-label-tertiary)',
      },
      statusDotOn: {
        background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 65%, transparent)',
      },
      card: {
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 40%, var(--dsw-alias-border-l2))',
        borderRadius: '20px',
        background: 'var(--dsw-alias-bg-layer-1)',
        boxShadow: '0 1px 2px rgba(28,26,23,0.05)',
      },
      cardOn: {
        borderColor: 'var(--dsw-alias-state-business-primary)',
      },
      cardHead: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '16px',
        borderBottom: '1px solid var(--dsw-alias-border-l2)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, var(--dsw-alias-bg-layer-1))',
      },
      cardTitleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      },
      cardTitle: {
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: 1.4,
      },
      kindChip: {
        fontSize: '11px',
        fontWeight: 500,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-label-tertiary)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '9999px',
        padding: '2px 8px',
      },
      badge: {
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '9999px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      },
      badgeOn: {
        color: 'var(--dsw-alias-label-secondary)',
        backgroundColor: 'color-mix(in srgb, var(--dsw-alias-label-primary) 8%, var(--dsw-alias-bg-layer-1))',
      },
      badgeOff: {
        color: 'var(--dsw-alias-label-secondary)',
        backgroundColor: 'color-mix(in srgb, var(--dsw-alias-label-primary) 8%, var(--dsw-alias-bg-layer-1))',
      },
      cardHeadRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        rowGap: '8px',
      },
      textButton: {
        padding: '2px 2px',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-tertiary)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      },
      cardBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
      },
      detailLinks: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
      },
      hint: {
        margin: 0,
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: '12px',
        fontWeight: 400,
        lineHeight: 1.55,
      },
      hintOneLine: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '52ch',
      },
      link: {
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--dsw-alias-state-business-primary)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      },
      keyList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
      keyRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: '56px',
        padding: '12px 14px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '12px',
        background: 'var(--dsw-alias-card-fill)',
        boxSizing: 'border-box',
      },
      keyRowLine: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      },
      keyRowActions: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '8px',
        flexWrap: 'wrap',
      },
      keyRowStatus: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        paddingTop: '8px',
        borderTop: '1px solid var(--dsw-alias-border-l2)',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      statusBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--dsw-alias-label-secondary)',
        background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 8%, var(--dsw-alias-bg-layer-1))',
      },
      statusBadgeOn: {
        color: 'var(--dsw-alias-label-primary)',
        background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 8%, var(--dsw-alias-bg-layer-1))',
      },
      badgeWarn: {
        color: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 75%, var(--dsw-alias-label-primary))',
        backgroundColor: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, var(--dsw-alias-bg-layer-1))',
      },
      statusDotWarn: {
        background: 'var(--dsw-alias-state-warn-primary)',
      },
      statusBadgeWarn: {
        color: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 75%, var(--dsw-alias-label-primary))',
        background: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, var(--dsw-alias-bg-layer-1))',
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, var(--dsw-alias-border-l2))',
      },
      statusBadgeError: {
        color: 'var(--dsw-alias-state-error-primary)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, var(--dsw-alias-bg-layer-1))',
      },
      statusBadgeMuted: {
        color: 'var(--dsw-alias-label-secondary)',
        background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 8%, var(--dsw-alias-bg-layer-1))',
      },
      statusText: {
        fontSize: '13px',
        fontWeight: 400,
        color: 'var(--dsw-alias-label-secondary)',
      },
      planText: {
        fontSize: '13px',
        fontWeight: 400,
        color: 'var(--dsw-alias-label-secondary)',
      },
      keyValue: {
        flex: '1 1 260px',
        minHeight: '36px',
        display: 'flex',
        alignItems: 'center',
        padding: '6px 10px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
        fontSize: '13px',
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        fontFamily: 'var(--dsw2-font-mono)',
      },
      input: {
        flex: '1 1 300px',
        minWidth: '180px',
        boxSizing: 'border-box',
        padding: '8px 10px',
        fontSize: '13px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
        fontFamily: 'inherit',
      },
      select: {
        padding: '8px 10px',
        fontSize: '13px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
        fontFamily: 'inherit',
        width: '100%',
        boxSizing: 'border-box',
      },
      button: {
        padding: '7px 13px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '9999px',
        cursor: 'pointer',
        fontFamily: 'inherit',
      },
      smallButton: {
        padding: '4px 10px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '9999px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      },
      primary: {
        color: 'var(--dsw-alias-state-business-primary)',
        borderColor: 'var(--dsw-alias-state-business-primary)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)',
        fontWeight: 500,
      },
      dashed: {
        padding: '9px 11px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-secondary)',
        background: 'transparent',
        border: '1px dashed var(--dsw-alias-border-l2)',
        borderRadius: '9999px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
      },
      disabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
      },
      fieldRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        minHeight: '28px',
      },
      fieldLabel: {
        fontSize: '13px',
        fontWeight: 400,
      },
      switch: {
        display: 'inline-flex',
        alignItems: 'center',
        width: '32px',
        height: '18px',
        padding: '2px',
        borderRadius: '999px',
        border: 'none',
        background: 'var(--dsw-alias-border-l2)',
        cursor: 'pointer',
        boxSizing: 'border-box',
        flexShrink: 0,
      },
      switchOn: {
        background: 'var(--dsw-alias-state-business-primary)',
      },
      knob: {
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      knobOn: {
        transform: 'translateX(14px)',
      },
      saveBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, var(--dsw-alias-border-l2))',
        borderRadius: '16px',
        background: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, var(--dsw-alias-bg-layer-1))',
      },
      saveBarText: {
        fontWeight: 500,
        fontSize: '13px',
        color: 'var(--dsw-alias-label-primary)',
      },
      saveBarHint: {
        flex: '1 1 auto',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      readyCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '16px',
        background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 8%, var(--dsw-alias-bg-layer-1))',
      },
      readyCardWarn: {
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, var(--dsw-alias-border-l2))',
        background: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, var(--dsw-alias-bg-layer-1))',
      },
      readyIcon: {
        fontSize: '20px',
        lineHeight: 1,
      },
      readyMain: {
        fontWeight: 500,
        fontSize: '14px',
        color: 'var(--dsw-alias-label-primary)',
      },
      readySub: {
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      readyLink: {
        border: 'none',
        background: 'none',
        padding: 0,
        color: 'var(--dsw-alias-state-business-primary)',
        fontSize: '12px',
        cursor: 'pointer',
        textDecoration: 'underline',
      },
      checkDot: {
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: 'var(--dsw-alias-label-tertiary)',
        flex: '0 0 auto',
      },
      checkDotOn: {
        background: 'var(--dsw-alias-state-success-primary)',
      },
      checkItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      },
      confirmRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flex: '1 1 100%',
        marginTop: '4px',
      },
      draftChip: {
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '6px',
        padding: '1px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 50%, var(--dsw-alias-border-l2))',
        color: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 75%, var(--dsw-alias-label-primary))',
        background: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, var(--dsw-alias-bg-layer-1))',
      },
      message: {
        margin: 0,
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      success: {
        color: 'var(--dsw-alias-state-success-primary)',
      },
      error: {
        color: 'var(--dsw-alias-state-error-primary)',
      },
      diagram: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '14px 16px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '16px',
        background: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 6%, var(--dsw-alias-bg-layer-1))',
      },
      diagramStep: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: '180px',
      },
      diagramIcon: {
        flex: '0 0 32px',
        width: '32px',
        height: '32px',
        borderRadius: '10px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--dsw-alias-state-business-primary)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, var(--dsw-alias-bg-layer-1))',
      },
      diagramText: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
      },
      diagramTitle: {
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-primary)',
      },
      diagramHint: {
        fontSize: '12px',
        fontWeight: 400,
        color: 'var(--dsw-alias-label-tertiary)',
      },
      diagramArrow: {
        fontSize: '14px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      sourceBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        paddingTop: '12px',
        borderTop: '1px solid var(--dsw-alias-border-l2)',
      },
      sourceTitle: {
        margin: '0 0 4px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-secondary)',
      },
      sourceRow: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '7px 0',
        borderBottom: '1px solid var(--dsw-alias-border-l2)',
      },
      sourceLabel: {
        fontSize: '12px',
        fontWeight: 400,
        color: 'var(--dsw-alias-label-tertiary)',
      },
      sourceValue: {
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
        fontFamily: 'var(--dsw2-font-mono)',
        textAlign: 'right',
      },
      tabs: {
        display: 'flex',
        gap: '4px',
        padding: '4px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '16px',
        background: 'var(--dsw-alias-card-fill)',
        width: 'fit-content',
      },
      tab: {
        padding: '6px 14px',
        border: 'none',
        borderRadius: '9999px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
      },
      tabOn: {
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 1px 2px rgba(28,26,23,0.06)',
      },
      quickRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
      },
      quickCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6px',
        padding: '14px 16px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '16px',
        background: 'var(--dsw-alias-bg-layer-1)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
      },
      backendCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '16px',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      capSwitch: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
        whiteSpace: 'nowrap',
      },
      featureBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        paddingTop: '12px',
        borderTop: '1px solid var(--dsw-alias-border-l2)',
      },
      featureRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      },
      featureLabel: {
        fontSize: '12px',
        fontWeight: 400,
        color: 'var(--dsw-alias-label-secondary)',
      },
      featureHint: {
        margin: 0,
        fontSize: '11px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      modeGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '12px',
      },
      modeCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6px',
        padding: '14px 16px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '16px',
        background: 'var(--dsw-alias-bg-layer-1)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
      },
      modeCardOn: {
        borderColor: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, var(--dsw-alias-border-l2))',
        background: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 7%, var(--dsw-alias-bg-layer-1))',
      },
      modeTitle: {
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-primary)',
      },
      modeDesc: {
        fontSize: '12px',
        fontWeight: 400,
        color: 'var(--dsw-alias-label-tertiary)',
        lineHeight: 1.55,
      },
      modeParams: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '14px 16px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '16px',
        background: 'var(--dsw-alias-card-fill)',
      },
      modeParamRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      },
      checkRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
      },
      checkItem: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      group: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '16px',
        background: 'var(--dsw-alias-bg-layer-1)',
        boxShadow: '0 1px 2px rgba(28,26,23,0.05)',
      },
      groupHead: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '12px',
      },
      groupTitle: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 500,
      },
    };

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

    function keyRowsFor(reference, credentials) {
      const refs = keyRefsFor(reference);
      const rows = refs
        .filter((candidate) => credentials?.[candidate]?.configured === true)
        .map((candidate) => ({
          ref: candidate,
          masked: typeof credentials[candidate].masked === 'string' ? credentials[candidate].masked : '',
          value: '',
        }));
      if (rows.length === 0) rows.push({ ref: null, masked: '', value: '' });
      return rows;
    }

    function findNamespace(value) {
      const namespaces = Array.isArray(value?.namespaces) ? value.namespaces : [];
      return namespaces.find((entry) => entry.ns === SETTINGS_NS)
        ?? namespaces.find((entry) => entry.value !== undefined
          && typeof entry.value === 'object'
          && entry.value !== null
          && 'searchMode' in entry.value
          && 'keenableEnabled' in entry.value);
    }

    function truthy(value, fallback) {
      return value === undefined || value === null ? fallback : value === true;
    }

    // Order fields live in the host schema as comma-separated strings
    // (lib/index.js maps kind:'order' to z.string()); the page works with arrays,
    // so split the string on read and join the array on write.
    const ORDER_FIELDS = new Set(['qualityExcludedProviders', 'cleanExtractProviders']);

    function splitOrder(value, fallback) {
      const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\s]+/u) : [];
      const names = [...new Set(raw
        .map((name) => String(name).trim().toLowerCase())
        .filter((name) => name.length > 0))];
      return names.length > 0 ? names : [...fallback];
    }

    function configDraft(ns) {
      const value = ns?.value ?? {};
      const draft = {
        searchMode: value.searchMode === 'fast' ? 'fast' : 'quality',
        fetchMode: value.fetchMode === 'clean' ? 'clean' : 'fast',
        siliconflowRerankModel: typeof value.siliconflowRerankModel === 'string' && value.siliconflowRerankModel.length > 0
          ? value.siliconflowRerankModel
          : MODEL_DEFAULTS.siliconflowRerankModel,
        siliconflowEmbeddingModel: typeof value.siliconflowEmbeddingModel === 'string' && value.siliconflowEmbeddingModel.length > 0
          ? value.siliconflowEmbeddingModel
          : MODEL_DEFAULTS.siliconflowEmbeddingModel,
      };
      for (const field of SWITCHES) draft[field.key] = truthy(value[field.key], BOOLEAN_DEFAULTS[field.key] !== false);
      for (const provider of PROVIDERS) {
        draft[provider.toggleKey] = truthy(value[provider.toggleKey], provider.defaultEnabled !== false);
        if (provider.canSearch && provider.capabilitySwitch !== false) draft[`${provider.id}SearchEnabled`] = truthy(value[`${provider.id}SearchEnabled`], true);
        if (provider.canFetch && provider.capabilitySwitch !== false) draft[`${provider.id}FetchEnabled`] = truthy(value[`${provider.id}FetchEnabled`], true);
      }
      for (const toggle of EXTRA_TOGGLES) draft[toggle.key] = truthy(value[toggle.key], true);
      draft.anysearchTag = typeof value.anysearchTag === 'string' ? value.anysearchTag : '';
      draft.anysearchZone = value.anysearchZone === 'cn' || value.anysearchZone === 'intl' ? value.anysearchZone : 'auto';
      draft.anysearchCleanContent = truthy(value.anysearchCleanContent, true);
      draft.anysearchBatchEnabled = truthy(value.anysearchBatchEnabled, true);
      draft.zhihuSearchMode = value.zhihuSearchMode === 'site' ? 'site' : 'global';
      const maxEngines = Number(value.qualityMaxEngines);
      draft.qualityMaxEngines = Number.isSafeInteger(maxEngines) && maxEngines >= 1 && maxEngines <= 8 ? maxEngines : 4;
      draft.qualityRerankEnabled = truthy(value.qualityRerankEnabled, true);
      draft.qualityExcludedProviders = splitOrder(value.qualityExcludedProviders, []);
      draft.fastPrimaryProvider = typeof value.fastPrimaryProvider === 'string' ? value.fastPrimaryProvider : '';
      const fallbacks = Number(value.fastMaxFallbacks);
      draft.fastMaxFallbacks = Number.isSafeInteger(fallbacks) && fallbacks >= 0 && fallbacks <= 5 ? fallbacks : 1;
      draft.cleanExtractProviders = splitOrder(value.cleanExtractProviders, ['keenable', 'anysearch', 'exa']);
      return draft;
    }

    function configKeys() {
      return [
        'searchMode',
        'fetchMode',
        ...MODEL_FIELDS.map((field) => field.key),
        ...SWITCHES.map((field) => field.key),
        ...PROVIDERS.map((provider) => provider.toggleKey),
        ...PROVIDERS.flatMap((provider) => [
          ...(provider.canSearch && provider.capabilitySwitch !== false ? [`${provider.id}SearchEnabled`] : []),
          ...(provider.canFetch && provider.capabilitySwitch !== false ? [`${provider.id}FetchEnabled`] : []),
        ]),
        ...EXTRA_TOGGLES.map((toggle) => toggle.key),
        'anysearchTag',
        'anysearchZone',
        'anysearchCleanContent',
        'anysearchBatchEnabled',
        'zhihuSearchMode',
        'qualityMaxEngines',
        'qualityRerankEnabled',
        'qualityExcludedProviders',
        'fastPrimaryProvider',
        'fastMaxFallbacks',
        'cleanExtractProviders',
      ];
    }

    function configOperations(current, draft) {
      const base = configDraft({ value: current });
      return configKeys()
        .filter((key) => {
          const next = draft[key];
          const before = base[key];
          if (Array.isArray(next) && Array.isArray(before)) {
            return JSON.stringify(next) !== JSON.stringify(before);
          }
          return next !== before;
        })
        .map((key) => ({
          op: 'set',
          path: [key],
          value: ORDER_FIELDS.has(key) && Array.isArray(draft[key]) ? draft[key].join(',') : draft[key],
        }));
    }

    function Toggle(props) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': props.checked,
        'aria-label': props.label,
        disabled: props.disabled,
        onClick: () => props.onChange(!props.checked),
        style: {
          ...styles.switch,
          ...(props.checked ? styles.switchOn : {}),
          ...(props.disabled ? styles.disabled : {}),
        },
      }, h('span', {
        className: 'dsh-web-search-knob',
        style: {
          ...styles.knob,
          ...(props.checked ? styles.knobOn : {}),
        },
      }));
    }

    const SECTION_IDS = ['overview', 'engines', 'modes', 'advanced'];

    /** Read the active section from the URL hash so a refresh keeps it. */
    function readSectionId() {
      if (typeof window === 'undefined' || window.location === undefined) return 'overview';
      const hash = String(window.location.hash ?? '').replace(/^#/u, '');
      return SECTION_IDS.includes(hash) ? hash : 'overview';
    }

    function SettingsPage(props) {
      const { t } = props;
      const [state, setState] = React.useState({ status: 'loading' });
      const [section, setSection] = React.useState(readSectionId);
      const [draft, setDraft] = React.useState({});
      const [keyRows, setKeyRows] = React.useState({});
      const [keyMessages, setKeyMessages] = React.useState({});
      const [revealed, setRevealed] = React.useState({});
      const [selectedProvider, setSelectedProvider] = React.useState(PROVIDERS[0].id);
      const [confirmClear, setConfirmClear] = React.useState(undefined);
      const [busy, setBusy] = React.useState(false);
      const [models, setModels] = React.useState({ rerank: [], embedding: [] });
      const [modelsBusy, setModelsBusy] = React.useState(false);
      const [modelMessage, setModelMessage] = React.useState('');
      const [quota, setQuota] = React.useState({});
      const [quotaBusy, setQuotaBusy] = React.useState(false);
      const [quotaMessage, setQuotaMessage] = React.useState('');
      const [verifyFailed, setVerifyFailed] = React.useState({});
      const [verifyPassed, setVerifyPassed] = React.useState({});
      const [message, setMessage] = React.useState('');
      const [messageError, setMessageError] = React.useState(false);

      const refresh = React.useCallback(async (resetDraft = true) => {
        const settingsResult = await safeCall(() => props.ctx.remote.settings.describe());
        if (!isOk(settingsResult)) {
          setState({ status: 'unavailable' });
          return;
        }
        const ns = findNamespace(settingsResult.value);
        if (ns === undefined) {
          setState({ status: 'unavailable' });
          return;
        }
        const refs = PROVIDERS.flatMap((provider) => keyRefsFor(
          String(ns.value?.[provider.refKey] ?? '').trim() || provider.defaultRef,
        ));
        const credentials = {};
        let anyBatchFailed = false;
        for (let i = 0; i < refs.length; i += 60) {
          const batch = refs.slice(i, i + 60);
          const batchResult = await safeCall(() => props.ctx.remote.credentials.describe(batch));
          if (isOk(batchResult)) Object.assign(credentials, batchResult.value);
          else anyBatchFailed = true;
        }
        setKeyRows(Object.fromEntries(PROVIDERS.map((provider) => {
          const reference = String(ns.value?.[provider.refKey] ?? '').trim() || provider.defaultRef;
          return [provider.id, keyRowsFor(reference, credentials)];
        })));
        setState({
          status: 'ready',
          ns,
          writable: settingsResult.value.writable !== false,
          credentials,
          credentialsError: anyBatchFailed,
        });
        if (resetDraft) setDraft(configDraft(ns));
      }, [props.ctx]);

      React.useEffect(() => {
        if (typeof document === 'undefined' || document.getElementById('dsh-web-search-focus-style') !== null) return undefined;
        const style = document.createElement('style');
        style.id = 'dsh-web-search-focus-style';
        style.textContent = [
          // dsw2 design tokens carry the settings-page visual layer;
          // the dsw aliases below stay as a host-compatibility shim.
          ':root, body[data-ds-dark-theme] {',
          '  --dsw2-font-display: \'Waldenburg\', \'Inter\', system-ui, -apple-system, \'Segoe UI\', sans-serif;',
          '  --dsw2-font-mono: \'Geist Mono\', ui-monospace, \'Cascadia Mono\', Consolas, monospace;',
          '  --dsw2-ink: #000000;',
          '  --dsw2-graphite: #44403b;',
          '  --dsw2-smoke: #777169;',
          '  --dsw2-eggshell: #fdfcfc;',
          '  --dsw2-warm-taupe: #f5f3f1;',
          '  --dsw2-stone: #ebe8e4;',
          '  --dsw2-violet-spark: #0447ff;',
          '  --dsw2-ember-orange: #ff4704;',
          '  --dsw2-tracking-display: -0.02em;',
          '}',
          'body[data-ds-dark-theme] {',
          '  --dsw2-ink: #fdfcfc;',
          '  --dsw2-graphite: #eceae6;',
          '  --dsw2-smoke: #b8b3ab;',
          '  --dsw2-eggshell: #1c1a17;',
          '  --dsw2-warm-taupe: #242220;',
          '  --dsw2-stone: #32302c;',
          '  --dsw2-violet-spark: #6690ff;',
          '  --dsw2-ember-orange: #ff8557;',
          '  --dsw2-tracking-display: -0.01em;',
          '}',
          'body {',
          '  --dsw-alias-bg-layer-1: var(--dsw2-eggshell);',
          '  --dsw-alias-card-fill: var(--dsw2-warm-taupe);',
          '  --dsw-alias-border-l2: var(--dsw2-stone);',
          '  --dsw-alias-label-primary: var(--dsw2-ink);',
          '  --dsw-alias-label-secondary: var(--dsw2-graphite);',
          '  --dsw-alias-label-tertiary: var(--dsw2-smoke);',
          '  --dsw-alias-state-business-primary: var(--dsw2-violet-spark);',
          '  --dsw-alias-state-error-primary: var(--dsw2-ember-orange);',
          '}',
          // The dsw alias redirect hangs on body only: the host defines the
          // same names on body, and a later body-level declaration wins the
          // cascade over any :root value. Dark needs no separate block because
          // these aliases all point at dsw2 vars, which re-resolve per theme.
          // Waldenburg / Inter / Geist Mono are bundled next to the plugin and
          // served same-origin from /dsh-web-search/fonts; the stack
          // falls back to system-ui while Chinese text uses the system voice.
          '@font-face { font-family: \'Waldenburg\'; src: url("/dsh-web-search/fonts/inter-300-latin.woff2") format("woff2"); font-weight: 300; font-style: normal; font-display: swap; unicode-range: U+0000-00FF, U+2000-206F; }',
          '@font-face { font-family: \'Inter\'; src: url("/dsh-web-search/fonts/inter-300-latin.woff2") format("woff2"); font-weight: 300; font-style: normal; font-display: swap; unicode-range: U+0000-00FF, U+2000-206F; }',
          '@font-face { font-family: \'Inter\'; src: url("/dsh-web-search/fonts/inter-400-latin.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; unicode-range: U+0000-00FF, U+2000-206F; }',
          '@font-face { font-family: \'Inter\'; src: url("/dsh-web-search/fonts/inter-500-latin.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; unicode-range: U+0000-00FF, U+2000-206F; }',
          '@font-face { font-family: \'Geist Mono\'; src: url("/dsh-web-search/fonts/geist-mono-400-latin.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; unicode-range: U+0000-00FF, U+2000-206F; }',
          // Apple motion baseline: the press responds on pointer-down, the knob
          // settles with a critically-damped spring (damping 1.0, response 0.35s);
          // reduced-motion users get the state change without the travel.
          '[role="switch"] .dsh-web-search-knob { transition: transform 350ms cubic-bezier(0.2, 0, 0, 1); }',
          '[role="switch"]:active .dsh-web-search-knob { transition-duration: 150ms; }',
          '[role="switch"]:focus-visible { outline: 2px solid var(--dsw2-violet-spark); outline-offset: 2px; }',
          'button:focus-visible { outline: 2px solid var(--dsw2-violet-spark); outline-offset: 2px; }',
          '@media (prefers-reduced-motion: reduce) { [role="switch"] .dsh-web-search-knob { transition: none; } }',
        ].join('\n');
        document.head.appendChild(style);
        return () => { style.remove(); };
      }, []);
      React.useEffect(() => {
        void refresh();
      }, [refresh]);

      const goSection = (id) => {
        setSection(id);
        if (typeof window !== 'undefined' && window.history !== undefined && window.location !== undefined) {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
        }
      };

      const note = (text, error = false) => {
        setMessage(text);
        setMessageError(error);
        if (!error && text.length > 0 && typeof setTimeout === 'function') setTimeout(() => setMessage((current) => (current === text ? '' : current)), 4000);
      };

      const noteKey = (provider, text, error = false, rowIndex = undefined) => {
        setMessage('');
        setKeyMessages((current) => ({ ...current, [provider.id]: { text, error, rowIndex } }));
        if (!error && text.length > 0 && typeof setTimeout === 'function') setTimeout(() => setKeyMessages((current) => {
          const entry = current[provider.id];
          if (entry === undefined || entry.text !== text) return current;
          const next = { ...current };
          delete next[provider.id];
          return next;
        }), 4000);
      };

      const handleSaveKey = async (provider, ref) => {
        if (provider.authType === 'cookie') {
          const row = (keyRows[provider.id] ?? [])[0];
          const value = row === undefined ? '' : row.value.trim();
          if (value.length === 0) {
            noteKey(provider, t('enterKey'), true);
            return;
          }
          setBusy(true);
          const result = await safeCall(() => props.ctx.remote.credentials.set(ref, value));
          if (isOk(result)) {
            noteKey(provider, t('cookieImported'));
            await refresh(false);
          } else {
            noteKey(provider, t('saveFailed'), true);
          }
          setBusy(false);
          return;
        }
        await handleKeySave({
          rows: keyRows[provider.id] ?? [],
          ref,
          setBusy,
          setCredential: (target, value) => safeCall(() => props.ctx.remote.credentials.set(target, value)),
          onRefused: (kind) => noteKey(provider, t(kind), true),
          onSaved: async () => {
            setRevealed({});
            noteKey(provider, provider.authType === 'cookie' ? t('cookieImported') : t('savedKey', { name: provider.label }));
            await refresh(false);
          },
          onFailed: () => noteKey(provider, t('saveFailed'), true),
        });
      };

      const addKeyRow = (provider) => {
        const rows = keyRows[provider.id] ?? [];
        if (rows.length >= MAX_KEY_REFS) {
          noteKey(provider, t('tooManyKeys'), true);
          return;
        }
        setKeyRows((current) => ({
          ...current,
          [provider.id]: [...(current[provider.id] ?? []), { ref: null, masked: '', value: '' }],
        }));
      };

      const removeKeyRow = async (provider, index) => {
        const row = (keyRows[provider.id] ?? [])[index];
        if (row === undefined) return;
        if (row.ref === null) {
          setKeyRows((current) => ({
            ...current,
            [provider.id]: (current[provider.id] ?? []).filter((_, position) => position !== index),
          }));
          return;
        }
        setBusy(true);
        const result = await safeCall(() => props.ctx.remote.credentials.unset(row.ref));
        if (isOk(result)) {
          noteKey(provider, t('clearedKey', { name: provider.label }));
          await refresh(false);
        } else {
          noteKey(provider, t('saveFailed'), true);
        }
        setBusy(false);
      };

      const clearKey = async (provider, ref) => {
        if (confirmClear !== provider.id) {
          setConfirmClear(provider.id);
          return;
        }
        setConfirmClear(undefined);
        setBusy(true);
        let failed = false;
        for (const candidate of keyRefsFor(ref)) {
          if (state.credentials?.[candidate]?.configured !== true) continue;
          const result = await safeCall(() => props.ctx.remote.credentials.unset(candidate));
          if (!isOk(result)) {
            failed = true;
            break;
          }
        }
        if (!failed) {
          noteKey(provider, t('clearedKey', { name: provider.label }));
          await refresh(false);
        } else {
          noteKey(provider, t('saveFailed'), true);
        }
        setBusy(false);
      };

      const testProvider = async (provider, rowIndex = undefined) => {
        setBusy(true);
        noteKey(provider, t('testing'), false, rowIndex);
        try {
          const response = await fetch('/dsh-web-search/health', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ providerId: provider.id, capability: 'search' }),
          });
          const data = await response.json();
          if (data?.ok === true) {
            setVerifyFailed((current) => ({ ...current, [provider.id]: false }));
            setVerifyPassed((current) => ({ ...current, [provider.id]: true }));
            noteKey(provider, t('testOk', {
              name: provider.label,
              ms: data.latencyMs ?? '—',
              count: data.count ?? 0,
            }), false, rowIndex);
          } else {
            const reason = humanizeVerifyError(data);
            noteKey(provider, reason
              ? t('testFailedDetail', { name: provider.label, reason })
              : t('testFailed'), true, rowIndex);
            setVerifyFailed((current) => ({ ...current, [provider.id]: true }));
            setVerifyPassed((current) => ({ ...current, [provider.id]: false }));
          }
        } catch {
          noteKey(provider, t('testFailed'), true, rowIndex);
        } finally {
          setBusy(false);
        }
      };

      const loadModels = async () => {
        setModelsBusy(true);
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
              throw Object.assign(new Error(reason || 'models failed'), { reason });
            }
            next[kind] = Array.isArray(data.models) ? data.models : [];
          }
          setModels(next);
          const count = next.rerank.length + next.embedding.length;
          setModelMessage(t('modelsLoaded', { count }));
        } catch (error) {
          const reason = typeof error?.reason === 'string' ? error.reason : '';
          setModelMessage(reason ? t('modelsFailedDetail', { reason }) : t('modelsFailed'));
        } finally {
          setModelsBusy(false);
        }
      };

      const loadQuotas = async () => {
        setQuotaBusy(true);
        setQuotaMessage('');
        try {
          const response = await fetch('/dsh-web-search/quotas', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ providerIds: QUOTA_FIELDS.filter((item) => {
              const provider = PROVIDERS.find((candidate) => candidate.id === item.id);
              return provider !== undefined && provider.quota;
            }).map((item) => item.id) }),
          });
          const data = await response.json();
          if (data?.ok !== true) {
            const reason = serverReason(data);
            throw Object.assign(new Error(reason || 'quota failed'), { reason });
          }
          setQuota(data.providers ?? {});
        } catch (error) {
          const reason = typeof error?.reason === 'string' ? error.reason : '';
          setQuotaMessage(reason ? t('quotaFailedDetail', { reason }) : t('quotaFailed'));
        } finally {
          setQuotaBusy(false);
        }
      };

      const saveConfig = async () => {
        if (state.status !== 'ready' || !state.writable) return;
        const operations = configOperations(state.ns.value ?? {}, draft);
        if (operations.length === 0) {
          note(t('configNoChanges'));
          return;
        }
        setBusy(true);
        const result = await safeCall(() => props.ctx.remote.settings.mutate(SETTINGS_NS, operations, state.ns.revision));
        if (isOk(result)) {
          note(t('configSaved'));
          await refresh();
        } else if (result?.code === 'settings/conflict' || result?.error?.code === 'settings/conflict') {
          note(t('configConflict'), true);
          await refresh();
        } else {
          note(t('configSaveFailed'), true);
        }
        setBusy(false);
      };

      if (state.status === 'loading') {
        return h('section', { style: styles.section },
          h('h3', { style: styles.heading }, t('title')),
          h('p', { style: styles.intro }, t('loading')));
      }
      if (state.status === 'unavailable') {
        return h('section', { style: styles.section },
          h('h3', { style: styles.heading }, t('title')),
          h('p', { style: { ...styles.intro, ...styles.error } }, t('unavailable')),
          h('button', {
            type: 'button',
            style: styles.button,
            onClick: () => { void refresh(); },
          }, t('retry')));
      }

      const ns = state.ns;
      const readOnly = !state.writable;
      const dirtyCount = configOperations(ns.value ?? {}, draft).length;
      const dirty = dirtyCount > 0;
      const discardDraft = () => setDraft(configDraft(ns));
      const runSave = () => { void saveConfig(); };
      const saveBar = dirty ? h('div', { style: styles.saveBar, role: 'status' },
        h('span', { style: styles.saveBarText }, t('unsavedCount', { count: dirtyCount })),
        h('span', { style: styles.saveBarHint }, t('unsaved')),
        h('button', { type: 'button', style: styles.smallButton, disabled: busy, onClick: discardDraft }, t('discard')),
        h('button', { type: 'button', style: { ...styles.smallButton, ...styles.primary, ...(busy ? styles.disabled : {}) }, disabled: busy, onClick: runSave }, busy ? t('saving') : t('save'))) : null;
      const intentPanel = () => h('div', { style: styles.intentPanel },
        h('div', { style: styles.groupHead },
          h('h4', { style: styles.groupTitle }, t('intentTitle')),
          h('span', { style: styles.hint }, t('intentHint'))),
        h('div', { style: styles.intentRow },
          h('div', { style: styles.intentField },
            h('span', { style: styles.fieldLabel }, t('searchMode')),
            h('select', {
              style: { ...styles.select, ...(readOnly || busy ? styles.disabled : {}) },
              'aria-label': t('searchMode'),
              value: draft.searchMode,
              disabled: readOnly || busy,
              onChange: (event) => setDraft((current) => ({ ...current, searchMode: event.target.value })),
            }, h('option', { value: 'quality' }, t('quality')), h('option', { value: 'fast' }, t('fast'))),
            h('span', { style: styles.hint }, t('searchModeHint'))),
          h('div', { style: styles.intentField },
            h('span', { style: styles.fieldLabel }, t('fetchMode')),
            h('select', {
              style: { ...styles.select, ...(readOnly || busy ? styles.disabled : {}) },
              'aria-label': t('fetchMode'),
              value: draft.fetchMode,
              disabled: readOnly || busy,
              onChange: (event) => setDraft((current) => ({ ...current, fetchMode: event.target.value })),
            }, h('option', { value: 'fast' }, t('fast')), h('option', { value: 'clean' }, t('clean'))),
            h('span', { style: styles.hint }, t('fetchModeHint')))));
      const modelsPanel = () => h('div', { style: styles.group },
        h('h4', { style: styles.groupTitle }, t('modelsTitle')),
        h('p', { style: styles.hint }, t('modelsHint')),
        ...MODEL_FIELDS.map((field) => h('div', { key: field.key, style: styles.fieldRow },
          h('span', { style: styles.fieldLabel }, t(field.labelKey)),
          h('select', {
            style: { ...styles.select, maxWidth: '260px', ...(readOnly || busy ? styles.disabled : {}) },
            'aria-label': t(field.labelKey),
            value: draft[field.key],
            disabled: readOnly || busy,
            onChange: (event) => setDraft((current) => ({ ...current, [field.key]: event.target.value })),
          }, ...modelOptions(field).map((model) => h('option', { key: `model-${model}`, value: model }, model))))),
        ...MODEL_FIELDS.map((field) => h('div', { key: `custom-${field.key}`, style: styles.fieldRow },
          h('span', { style: styles.hint }, t('modelCustom')),
          h('input', {
            style: { ...styles.input, maxWidth: '260px', ...(readOnly || busy ? styles.disabled : {}) },
            type: 'text',
            'aria-label': `${t(field.labelKey)} ${t('modelCustom')}`,
            placeholder: MODEL_DEFAULTS[field.key],
            value: draft[field.key],
            disabled: readOnly || busy,
            onChange: (event) => setDraft((current) => ({ ...current, [field.key]: event.target.value })),
          }))),
        h('div', { style: styles.keyRowLine },
          h('button', {
            type: 'button',
            style: { ...styles.button, ...(readOnly || busy || modelsBusy ? styles.disabled : {}) },
            disabled: readOnly || busy || modelsBusy,
            onClick: () => { void loadModels(); },
          }, modelsBusy ? t('modelsLoading') : t('fetchModels')),
          modelMessage.length === 0 ? null : h('span', { role: 'status', style: styles.message }, modelMessage)));
      const providerCards = PROVIDERS.map((provider) => {
        const ref = String(ns.value?.[provider.refKey] ?? '').trim() || provider.defaultRef;
        const refs = keyRefsFor(ref);
        const configuredRefs = refs.filter((candidate) => state.credentials?.[candidate]?.configured === true);
        const info = state.credentials?.[configuredRefs[0] ?? ref] ?? {};
        const configured = configuredRefs.length > 0 || info.configured === true;
        const keyCount = configuredRefs.length > 0 ? configuredRefs.length : configured ? 1 : 0;
        const writable = info.writable !== false;
        const fromEnvironment = info.source === 'environment';
        const fromStore = typeof info.masked === 'string' && info.masked.length > 0;
        const keyMessage = keyMessages[provider.id];
        const sourceText = fromStore ? t('fromStore') : fromEnvironment ? t('fromEnvironment') : '';
        const statusText = configured
          ? (verifyPassed[provider.id] === true
            ? t('statusVerified')
            : (keyCount > 1 ? `${t('configured')} · ${t('keysCount', { count: keyCount })}` : (sourceText.length > 0 ? `${t('configured')} · ${sourceText}` : t('configured'))))
          : t('notConfigured');
        const quotaMeta = QUOTA_FIELDS.find((item) => item.id === provider.id);
        const quotaInfo = quota[provider.id];
        const liveQuota = quotaInfo?.ok === true && typeof quotaInfo.remaining === 'number';
        const usageText = liveQuota
          ? t('quotaRemaining', { value: `${String(quotaInfo.remaining)}${quotaInfo.currency === 'CNY' ? ' CNY' : ''}` })
          : (quotaInfo === undefined ? t('statusUnchecked') : t('statusUnsupported'));
        const planText = quotaMeta === undefined ? '' : t(quotaMeta.freeKey);
        const rows = keyRows[provider.id] ?? [];
        const selected = selectedProvider === provider.id;
        const isCookie = provider.authType === 'cookie';
        return h('div', {
          key: provider.id,
          id: `dsh-web-search-provider-${provider.id}`,
          tabIndex: -1,
          style: { ...styles.card, display: selected ? 'flex' : 'none', ...(configured && !state.credentialsError ? styles.cardOn : {}) },
        },
          h('div', { style: styles.cardHead },
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px', flex: '1 1 auto' } },
              h('div', { style: styles.cardTitleRow },
                h('span', { style: styles.cardTitle }, provider.label),
                h('span', { style: styles.kindChip }, provider.role === 'both' ? t('roleBoth') : provider.role === 'fetch' ? t('roleFetch') : provider.role === 'models' ? t('roleModels') : t('roleSearch')),
                h('span', { style: { ...styles.badge, ...(configured ? (verifyFailed[provider.id] === true ? styles.badgeWarn : styles.badgeOn) : styles.badgeOff) } }, statusText)),
              h('p', { style: { ...styles.hint, ...styles.hintOneLine }, title: t(provider.hintKey) }, t(provider.hintKey))),
            h('div', { style: styles.cardHeadRight },
              provider.canSearch && provider.capabilitySwitch !== false ? h('label', { style: styles.capSwitch },
                h(Toggle, {
                  label: `${provider.label} ${t('capSearch')}`,
                  checked: draft[`${provider.id}SearchEnabled`] !== false,
                  disabled: readOnly || busy,
                  onChange: (value) => setDraft((current) => ({ ...current, [`${provider.id}SearchEnabled`]: value })),
                }),
                h('span', null, t('capSearch'))) : null,
              provider.canFetch && provider.capabilitySwitch !== false ? h('label', { style: styles.capSwitch },
                h(Toggle, {
                  label: `${provider.label} ${t('capFetch')}`,
                  checked: draft[`${provider.id}FetchEnabled`] !== false,
                  disabled: readOnly || busy,
                  onChange: (value) => setDraft((current) => ({ ...current, [`${provider.id}FetchEnabled`]: value })),
                }),
                h('span', null, t('capFetch'))) : null,
              h('button', {
                type: 'button',
                style: { ...styles.textButton, ...((busy || !writable || !configured) ? styles.disabled : {}) },
                'aria-label': t('removeProviderLabel', { name: provider.label }),
                disabled: busy || !writable || !configured,
                onClick: () => { void clearKey(provider, ref); },
              }, t('removeProvider')),
              h(Toggle, {
                label: `${provider.label} ${draft[provider.toggleKey] === true ? t('enabled') : t('disabled')}`,
                checked: draft[provider.toggleKey] === true,
                disabled: readOnly || busy,
                onChange: (value) => setDraft((current) => ({ ...current, [provider.toggleKey]: value })),
              }))),
              dirty ? h('span', { style: styles.draftChip, title: t('draftHint') }, t('draftHint')) : null,
          h('div', { style: styles.cardBody },
            h('div', { style: styles.detailLinks },
              h('a', { style: styles.link, href: provider.keyUrl, target: '_blank', rel: 'noreferrer' }, t('getKey')),
              h('span', { style: styles.hint }, t('keysHint'))),
            provider.id === 'anysearch' ? h('div', { style: styles.featureBox },
              h('h5', { style: styles.sourceTitle }, t('featuresTitle')),
              h('div', { style: styles.modeParamRow },
                h('span', { style: styles.featureLabel }, t('featureAnysearchTag')),
                h('input', {
                  style: { ...styles.input, maxWidth: '220px' },
                  value: draft.anysearchTag,
                  placeholder: 'academic / finance / code',
                  onChange: (event) => setDraft((current) => ({ ...current, anysearchTag: event.target.value })),
                })),
              h('p', { style: styles.featureHint }, t('featureAnysearchTagHint')),
              h('div', { style: styles.modeParamRow },
                h('span', { style: styles.featureLabel }, t('featureAnysearchZone')),
                h('select', {
                  style: { ...styles.select, maxWidth: '180px' },
                  value: draft.anysearchZone,
                  onChange: (event) => setDraft((current) => ({ ...current, anysearchZone: event.target.value })),
                }, h('option', { value: 'auto' }, t('zoneAuto')), h('option', { value: 'cn' }, t('zoneCn')), h('option', { value: 'intl' }, t('zoneIntl')))),
              h('div', { style: styles.modeParamRow },
                h('span', { style: styles.featureLabel }, t('featureCleanContent')),
                h(Toggle, {
                  label: t('featureCleanContent'),
                  checked: draft.anysearchCleanContent === true,
                  disabled: readOnly || busy,
                  onChange: (value) => setDraft((current) => ({ ...current, anysearchCleanContent: value })),
                })),
              h('p', { style: styles.featureHint }, t('featureCleanContentHint')),
              h('div', { style: styles.modeParamRow },
                h('span', { style: styles.featureLabel }, t('featureBatch')),
                h(Toggle, {
                  label: t('featureBatch'),
                  checked: draft.anysearchBatchEnabled === true,
                  disabled: readOnly || busy,
                  onChange: (value) => setDraft((current) => ({ ...current, anysearchBatchEnabled: value })),
                })),
              h('p', { style: styles.featureHint }, t('featureBatchHint')))
              : provider.id === 'zhihu' ? h('div', { style: styles.featureBox },
                h('h5', { style: styles.sourceTitle }, t('featuresTitle')),
                h('div', { style: styles.modeParamRow },
                  h('span', { style: styles.featureLabel }, t('featureZhihuMode')),
                  h('select', {
                    style: { ...styles.select, maxWidth: '180px' },
                    value: draft.zhihuSearchMode,
                    onChange: (event) => setDraft((current) => ({ ...current, zhihuSearchMode: event.target.value })),
                  }, h('option', { value: 'global' }, t('zhihuGlobal')), h('option', { value: 'site' }, t('zhihuSite'))))) : null,
            h('div', { style: styles.keyList },
              rows.map((row, rowIndex) => {
                const rowKey = `${provider.id}:${row.ref ?? `new-${rowIndex}`}`;
                const rowShown = revealed[rowKey] === true;
                const statusItems = [];
                if (provider.quota) {
                  statusItems.push(h('span', {
                    style: {
                      ...styles.statusBadge,
                      ...(liveQuota ? styles.statusBadgeOn : quotaInfo === undefined ? styles.statusBadgeWarn : styles.statusBadgeError),
                    },
                  }, `${t('keyStatusUsage')} ${liveQuota ? usageText : quotaInfo === undefined ? t('statusUnchecked') : t('statusFailed')}`));
                }
                if (provider.rateLimit) {
                  statusItems.push(h('span', { style: styles.statusText }, `${t('keyStatusRateLimit')} ${t('statusUnchecked')}`));
                }
                if (planText.length > 0 && (!provider.quota || quotaInfo !== undefined)) {
                  statusItems.push(h('span', { style: styles.planText }, `${t('keyStatusPlan')} ${planText}`));
                }
                const rowMessage = keyMessage !== undefined && keyMessage.rowIndex === rowIndex ? keyMessage : undefined;
                return h('div', { key: row.ref ?? `new-${rowIndex}`, style: styles.keyRow },
                  h('div', { style: styles.keyRowLine },
                    row.ref === null
                      ? isCookie
                        ? h('textarea', {
                          style: { ...styles.input, minHeight: '72px', resize: 'vertical' },
                          rows: 4,
                          'aria-label': t('apiKeyLabel', { name: provider.label }),
                          placeholder: t('cookieHint'),
                          value: row.value,
                          disabled: !writable || busy,
                          onChange: (event) => {
                            const value = event.target.value;
                            setKeyRows((current) => ({
                              ...current,
                              [provider.id]: (current[provider.id] ?? []).map((entry, position) => (
                                position === rowIndex ? { ...entry, value } : entry
                              )),
                            }));
                          },
                        })
                        : h('input', {
                          style: { ...styles.input, ...(!writable || busy ? styles.disabled : {}) },
                          type: rowShown ? 'text' : 'password',
                          autoComplete: 'new-password',
                          'aria-label': t('apiKeyLabel', { name: provider.label }),
                          placeholder: t('keyPlaceholder'),
                          value: row.value,
                          disabled: !writable || busy,
                          onChange: (event) => {
                            const value = event.target.value;
                            setKeyRows((current) => ({
                              ...current,
                              [provider.id]: (current[provider.id] ?? []).map((entry, position) => (
                                position === rowIndex ? { ...entry, value } : entry
                              )),
                            }));
                          },
                          onBlur: () => {
                            if (row.value.trim().length > 0) void handleSaveKey(provider, ref);
                          },
                        })
                      : h('span', { style: styles.keyValue }, row.masked ? maskSavedKey(row.masked) : t('savedKeyMasked'))),
                  isCookie && row.ref === null ? h('div', { style: styles.keyRowLine },
                    h('label', { style: styles.featureLabel }, t('cookieFile')),
                    h('input', {
                      type: 'file',
                      accept: '.txt,.json',
                      style: styles.input,
                      onChange: async (event) => {
                        const file = event.target.files?.[0];
                        if (file === undefined) return;
                        const value = await file.text();
                        setKeyRows((current) => ({
                          ...current,
                          [provider.id]: (current[provider.id] ?? []).map((entry, position) => (
                            position === rowIndex ? { ...entry, value } : entry
                          )),
                        }));
                      },
                    })) : null,
                  h('div', { style: styles.keyRowActions },
                    row.ref === null && row.value.trim().length > 0 ? h('button', {
                      type: 'button',
                      style: { ...styles.smallButton, ...styles.primary, ...((busy || !writable) ? styles.disabled : {}) },
                      disabled: busy || !writable,
                      onClick: () => { void handleSaveKey(provider, ref); },
                    }, isCookie ? t('cookieImport') : t('save')) : null,
                    isCookie ? null : h('button', {
                      type: 'button',
                      style: { ...styles.smallButton, ...((busy || !writable || row.ref !== null) ? styles.disabled : {}) },
                      title: row.ref === null ? undefined : t('savedKeyReadonly'),
                      'aria-label': row.ref === null ? `${t('show')} ${rowIndex + 1}` : t('savedKeyReadonly'),
                      disabled: busy || !writable || row.ref !== null,
                      onClick: () => setRevealed((current) => ({ ...current, [rowKey]: !current[rowKey] })),
                    }, rowShown ? t('hide') : t('show')),
                    provider.verify ? h('button', {
                      type: 'button',
                      style: { ...styles.smallButton, ...((busy || !writable || !configured) ? styles.disabled : {}) },
                      title: configured ? undefined : t('verifyNoKey'),
                      disabled: busy || !writable || !configured,
                      onClick: () => { void testProvider(provider, rowIndex); },
                    }, busy ? t('testing') : t('test')) : h('span', { style: styles.statusText }, t('noVerify')),
                    h('button', {
                      type: 'button',
                      style: { ...styles.smallButton, ...((busy || !writable) ? styles.disabled : {}) },
                      'aria-label': t('removeKeyLabel', { name: provider.label, index: rowIndex + 1 }),
                      disabled: busy || !writable,
                      onClick: () => { void removeKeyRow(provider, rowIndex); },
                    }, t('removeKey'))),
                  statusItems.length === 0 && rowMessage === undefined ? null : h('div', { style: styles.keyRowStatus },
                    ...statusItems,
                    rowMessage === undefined ? null : h('p', {
                      role: 'status',
                      style: { ...styles.message, ...(rowMessage.error ? styles.error : styles.success) },
                    }, rowMessage.text,
                    rowMessage.error && provider.keyUrl ? h('a', { style: { ...styles.link, marginLeft: '8px' }, href: provider.keyUrl, target: '_blank', rel: 'noreferrer' }, t('getKey')) : null)));
              })),
            isCookie ? null : h('button', {
              type: 'button',
              style: { ...styles.dashed, ...((busy || !writable || rows.length >= MAX_KEY_REFS) ? styles.disabled : {}) },
              'aria-label': t('addKeyLabel', { name: provider.label }),
              disabled: busy || !writable || rows.length >= MAX_KEY_REFS,
              onClick: () => addKeyRow(provider),
            }, `+ ${rows.length === 0 ? t('addKey') : t('addAnotherKey')}`),
            confirmClear === provider.id ? h('div', { style: styles.keyRowLine },
              h('span', { style: styles.message }, t('clearConfirm', { name: provider.label })),
              h('button', {
                type: 'button',
                style: styles.smallButton,
                onClick: () => { void clearKey(provider, ref); },
              }, t('confirm')),
              h('button', {
                type: 'button',
                style: styles.smallButton,
                onClick: () => setConfirmClear(undefined),
              }, t('cancel'))) : null,
            keyMessage === undefined || keyMessage.rowIndex !== undefined ? null : h('p', {
              role: 'status',
              style: { ...styles.message, ...(keyMessage.error ? styles.error : styles.success) },
            }, keyMessage.text,
            keyMessage.error && provider.keyUrl ? h('a', { style: { ...styles.link, marginLeft: '8px' }, href: provider.keyUrl, target: '_blank', rel: 'noreferrer' }, t('getKey')) : null),
            h('div', { style: styles.sourceBox },
              h('h5', { style: styles.sourceTitle }, t('sourceTitle')),
              h('div', { style: styles.sourceRow },
                h('span', { style: styles.sourceLabel }, t('sourceCode')),
                h('span', { style: styles.sourceValue }, PACKAGE)),
              h('div', { style: styles.sourceRow },
                h('span', { style: styles.sourceLabel }, t('sourceDocs')),
                h('a', { style: styles.link, href: 'https://github.com/qikairo7/dsh-web-search', target: '_blank', rel: 'noreferrer' }, t('sourceDocsLink'))))));
      });
      const usableProviderCount = () => PROVIDERS.filter((provider) => (provider.anonymous === true || engineConfigured(provider)) && (provider.independent === true ? draft[provider.toggleKey] === true : draft[provider.toggleKey] !== false)).length;
      const modelOptions = (field) => [...new Set([
        draft[field.key],
        ...(models[field.kind] ?? []),
        MODEL_DEFAULTS[field.key],
      ].filter((value) => typeof value === 'string' && value.length > 0))];
      const engineConfigured = (provider) => {
        const ref = String(ns.value?.[provider.refKey] ?? '').trim() || provider.defaultRef;
        return keyRefsFor(ref).some((candidate) => state.credentials?.[candidate]?.configured === true);
      };
      const searchCandidates = () => PROVIDERS.filter((provider) => (
        provider.canSearch &&
        provider.independent !== true &&
        draft[provider.toggleKey] !== false &&
        draft[`${provider.id}SearchEnabled`] !== false
      ));
      const fetchCandidates = () => PROVIDERS.filter((provider) => (
        provider.canFetch &&
        draft[provider.toggleKey] !== false &&
        draft[`${provider.id}FetchEnabled`] !== false
      ));
      const qualityCandidates = () => searchCandidates()
        .filter((provider) => !draft.qualityExcludedProviders.includes(provider.id))
        .slice(0, draft.qualityMaxEngines);
      const namesOf = (providers) => providers.map((provider) => provider.label).join('、');
      const toggleExcluded = (id, enabled) => setDraft((current) => ({
        ...current,
        qualityExcludedProviders: enabled
          ? current.qualityExcludedProviders.filter((name) => name !== id)
          : [...new Set([...current.qualityExcludedProviders, id])],
      }));
      const toggleCleanProvider = (id, enabled) => setDraft((current) => ({
        ...current,
        cleanExtractProviders: enabled
          ? [...new Set([...current.cleanExtractProviders, id])]
          : current.cleanExtractProviders.filter((name) => name !== id),
      }));
      const qualityCustomized = draft.qualityMaxEngines !== 4
        || draft.qualityRerankEnabled !== true
        || draft.qualityExcludedProviders.length > 0;
      const fastCustomized = draft.fastPrimaryProvider !== '' || draft.fastMaxFallbacks !== 1;
      const cleanCustomized = JSON.stringify(draft.cleanExtractProviders) !== JSON.stringify(['keenable', 'anysearch', 'exa']);
      const modeCard = (kind, value, title, desc, onSelect) => h('button', {
        type: 'button',
        style: { ...styles.modeCard, ...(draft[kind] === value ? styles.modeCardOn : {}) },
        onClick: onSelect,
      }, h('span', { style: styles.modeTitle }, title), h('span', { style: styles.modeDesc }, desc));
      const paramHeader = (title, customized, restore) => h('div', { style: styles.groupHead },
        h('h5', { style: styles.groupTitle }, title),
        customized ? h('span', { style: styles.statusBadgeWarn }, t('customized')) : null,
        customized ? h('button', {
          type: 'button',
          style: styles.smallButton,
          onClick: restore,
        }, t('restoreDefaults')) : null);
      const qualityParams = h('div', { style: styles.modeParams },
        paramHeader(t('qualityParams'), qualityCustomized, () => setDraft((current) => ({
          ...current,
          qualityMaxEngines: 4,
          qualityRerankEnabled: true,
          qualityExcludedProviders: [],
        }))),
        h('div', { style: styles.modeParamRow },
          h('span', { style: styles.featureLabel }, t('maxEngines')),
          h('input', {
            type: 'number', min: 1, max: 8,
            style: { ...styles.input, maxWidth: '96px' },
            value: draft.qualityMaxEngines,
            onChange: (event) => setDraft((current) => ({ ...current, qualityMaxEngines: Math.max(1, Math.min(8, Number(event.target.value) || 4)) })),
          })),
        h('div', { style: styles.modeParamRow },
          h('span', { style: styles.featureLabel }, t('participate')),
          h('div', { style: styles.checkRow },
            ...searchCandidates().map((provider) => h('label', { key: `quality-${provider.id}`, style: styles.checkItem },
              h('span', { style: { ...styles.checkDot, ...(engineConfigured(provider) && !state.credentialsError ? styles.checkDotOn : {}) } }),
              h('input', {
                type: 'checkbox',
                checked: !draft.qualityExcludedProviders.includes(provider.id),
                onChange: (event) => toggleExcluded(provider.id, event.target.checked),
              }),
              provider.label)))),
        h('div', { style: styles.modeParamRow },
          h('span', { style: styles.featureLabel }, t('rerankEnabled')),
          h(Toggle, {
            label: t('rerankEnabled'),
            checked: draft.qualityRerankEnabled === true,
            disabled: readOnly || busy,
            onChange: (value) => setDraft((current) => ({ ...current, qualityRerankEnabled: value })),
          })),
        h('div', { style: styles.modeParamRow },
          h('span', { style: styles.featureLabel }, t('rerankModel')),
          h('select', {
            style: { ...styles.select, maxWidth: '260px' },
            value: draft.siliconflowRerankModel,
            onChange: (event) => setDraft((current) => ({ ...current, siliconflowRerankModel: event.target.value })),
          }, ...modelOptions({ key: 'siliconflowRerankModel', kind: 'rerank' }).map((model) => h('option', { key: `quality-model-${model}`, value: model }, model)))));
      const fastParams = h('div', { style: styles.modeParams },
        paramHeader(t('fastParams'), fastCustomized, () => setDraft((current) => ({
          ...current,
          fastPrimaryProvider: '',
          fastMaxFallbacks: 1,
        }))),
        h('div', { style: styles.modeParamRow },
          h('span', { style: styles.featureLabel }, t('primaryEngine')),
          h('select', {
            style: { ...styles.select, maxWidth: '260px' },
            value: draft.fastPrimaryProvider,
            onChange: (event) => setDraft((current) => ({ ...current, fastPrimaryProvider: event.target.value })),
          }, h('option', { value: '' }, t('autoPick')), ...searchCandidates().map((provider) => h('option', { key: `fast-${provider.id}`, value: provider.id }, provider.label)))),
        h('div', { style: styles.modeParamRow },
          h('span', { style: styles.featureLabel }, t('fallbacks')),
          h('input', {
            type: 'number', min: 0, max: 5,
            style: { ...styles.input, maxWidth: '96px' },
            value: draft.fastMaxFallbacks,
            onChange: (event) => setDraft((current) => ({ ...current, fastMaxFallbacks: Math.max(0, Math.min(5, Number(event.target.value) || 0)) })),
          })));
      const cleanParams = h('div', { style: styles.modeParams },
        paramHeader(t('cleanParams'), cleanCustomized, () => setDraft((current) => ({
          ...current,
          cleanExtractProviders: ['keenable', 'anysearch', 'exa'],
        }))),
        h('div', { style: styles.modeParamRow },
          h('span', { style: styles.featureLabel }, t('extractEngines')),
          h('div', { style: styles.checkRow },
            ...fetchCandidates().map((provider) => h('label', { key: `clean-${provider.id}`, style: styles.checkItem },
              h('span', { style: { ...styles.checkDot, ...(engineConfigured(provider) && !state.credentialsError ? styles.checkDotOn : {}) } }),
              h('input', {
                type: 'checkbox',
                checked: draft.cleanExtractProviders.includes(provider.id),
                onChange: (event) => toggleCleanProvider(provider.id, event.target.checked),
              }),
              provider.label)))));
      const qualityDesc = () => {
        const names = qualityCandidates();
        if (names.length === 0) return t('noSearchEngine');
        return draft.qualityRerankEnabled === true
          ? t('qualityDynamic', { names: namesOf(names), count: names.length, model: draft.siliconflowRerankModel })
          : t('qualityDynamicNoRerank', { names: namesOf(names), count: names.length });
      };
      const primaryLabel = () => {
        const provider = PROVIDERS.find((item) => item.id === draft.fastPrimaryProvider);
        return provider === undefined ? '' : provider.label;
      };
      const readySearchList = searchCandidates();
      const readyMissing = readySearchList.filter((provider) => provider.anonymous !== true && !engineConfigured(provider));
      const readyPanel = () => {
        const anonymousCount = readySearchList.filter((provider) => provider.anonymous === true).length;
        const ok = readySearchList.length > 0;
        const missingNames = namesOf(readyMissing);
        return h('div', { style: { ...styles.readyCard, ...(ok ? {} : styles.readyCardWarn) } },
          h('span', { style: styles.readyIcon }, ok ? '✓' : '✗'),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 auto' } },
            h('span', { style: styles.readyMain }, ok ? t('readyOkAnonymous', { mode: draft.searchMode === 'quality' ? t('quality') : t('fast'), count: anonymousCount }) : t('readyNone')),
            missingNames.length > 0 ? h('span', { style: styles.readySub }, t('readyMissing', { names: missingNames })) : h('span', { style: styles.readySub }, t('readyAllSet'))),
          missingNames.length > 0 ? h('button', { type: 'button', style: styles.readyLink, onClick: () => goSection('engines') }, t('readyGo')) : null);
      };
      const modePanel = () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        readySearchList.length === 0 ? h('div', { style: { ...styles.readyCard, ...styles.readyCardWarn }, role: 'alert' },
          h('span', { style: styles.readyIcon }, '✗'),
          h('span', { style: styles.readyMain }, t('readyNone'))) : null,
        h('h4', { style: styles.groupTitle }, t('searchMode')),
        h('div', { style: styles.modeGrid },
          modeCard('searchMode', 'quality', t('quality'), qualityDesc(), () => setDraft((current) => ({ ...current, searchMode: 'quality' }))),
          modeCard('searchMode', 'fast', t('fast'), draft.fastPrimaryProvider.length > 0
            ? t('fastDynamic', { primary: primaryLabel(), fallbacks: draft.fastMaxFallbacks })
            : t('fastDynamicAuto', { fallbacks: draft.fastMaxFallbacks }), () => setDraft((current) => ({ ...current, searchMode: 'fast' })))),
        draft.searchMode === 'quality' ? qualityParams : fastParams,
        h('h4', { style: styles.groupTitle }, t('fetchMode')),
        h('div', { style: styles.modeGrid },
          modeCard('fetchMode', 'fast', t('fast'), t('fetchModeHint'), () => setDraft((current) => ({ ...current, fetchMode: 'fast' }))),
          modeCard('fetchMode', 'clean', t('clean'), t('cleanDynamic', { names: namesOf(fetchCandidates().filter((provider) => draft.cleanExtractProviders.includes(provider.id))) }) || t('fetchModeHint'), () => setDraft((current) => ({ ...current, fetchMode: 'clean' })))),
        draft.fetchMode === 'clean' ? cleanParams : null,
        modelsPanel());
      const quick = (id, title, detail) => h('button', {
        type: 'button',
        style: styles.quickCard,
        onClick: () => goSection(id),
      }, h('span', { style: styles.fieldLabel }, title), h('span', { style: styles.hint }, detail));
      const engineList = h('div', { style: styles.engineList },
        h('div', { style: styles.engineListHead },
          h('span', null, t('enginesTitle')),
          h('button', {
            type: 'button',
            style: { ...styles.smallButton, ...(quotaBusy ? styles.disabled : {}) },
            disabled: quotaBusy,
            onClick: () => { void loadQuotas(); },
          }, quotaBusy ? t('quotaLoading') : t('refreshQuota'))),
        ...PROVIDERS.map((provider, index) => h('button', {
          key: `engine-${provider.id}`,
          type: 'button',
          'aria-label': provider.label,
          onClick: () => setSelectedProvider(provider.id),
          onKeyDown: (event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const next = PROVIDERS[index + (event.key === 'ArrowDown' ? 1 : -1)];
            if (next === undefined || typeof document === 'undefined') return;
            setSelectedProvider(next.id);
            const target = document.querySelector(`button[aria-label="${CSS.escape(next.label)}"]`);
            if (target !== null) target.focus();
          },
          style: { ...styles.engineItem, ...(selectedProvider === provider.id ? styles.engineItemOn : {}) },
        },
          h('span', { style: { ...styles.statusDot, ...(engineConfigured(provider) && !state.credentialsError ? (verifyFailed[provider.id] === true ? styles.statusDotWarn : styles.statusDotOn) : {}) } }),
          h('span', { style: { ...styles.engineItemName, ...(selectedProvider === provider.id ? styles.engineItemNameOn : {}) } }, provider.label),
          h('span', { style: styles.engineItemRole }, provider.canSearch && provider.canFetch ? t('roleBoth') : provider.canFetch ? t('roleFetch') : provider.canSearch ? t('roleSearch') : t('roleModels')))),
        quotaMessage.length === 0 ? null : h('span', { role: 'status', style: { ...styles.message, ...styles.error } }, quotaMessage),
        state.credentialsError ? h('button', { type: 'button', style: styles.smallButton, disabled: busy, onClick: () => { void refresh(false); } }, t('retry')) : null);
      const backendPanel = h('div', { style: styles.backendCard },
        h('h4', { style: styles.groupTitle }, t('providersTitle')),
        ...EXTRA_TOGGLES.map((toggle) => h('div', { key: toggle.key, style: styles.featureRow },
          h('span', { style: styles.featureLabel }, toggle.label),
          h(Toggle, {
            label: toggle.label,
            checked: draft[toggle.key] === true,
            disabled: readOnly || busy,
            onChange: (value) => setDraft((current) => ({ ...current, [toggle.key]: value })),
          }))));
      return h('section', { style: styles.section },
        h('div', { style: styles.pageHead },
          h('div', null,
            h('h3', { style: styles.heading }, t('title')),
            h('p', { style: styles.intro }, t('intro'))),
          h('div', { style: styles.summary },
            h('span', { style: styles.summaryCount }, String(usableProviderCount())),
            h('span', null, `/ ${PROVIDERS.length} ${t('summarySuffix')}`))),
        readOnly ? h('p', { style: styles.hint }, t('readOnly')) : null,
        saveBar,
        h('div', { style: styles.tabs, role: 'tablist' },
          ...[['overview', t('tabOverview')], ['engines', t('tabEngines')], ['modes', t('tabModes')], ['advanced', t('tabAdvanced')]].map(([id, label]) => h('button', {
            key: `tab-${id}`,
            type: 'button',
            role: 'tab',
            'aria-selected': section === id,
            style: { ...styles.tab, ...(section === id ? styles.tabOn : {}) },
            onClick: () => goSection(id),
          }, label))),
        h('div', { style: { display: section === 'overview' ? 'flex' : 'none', flexDirection: 'column', gap: '16px' } },
          readyPanel(),
          intentPanel(),
          h('div', { style: styles.diagram },
            h('div', { style: styles.diagramStep },
              h('span', { style: styles.diagramIcon }, '1'),
              h('div', { style: styles.diagramText },
                h('span', { style: styles.diagramTitle }, t('diagramQuery')),
                h('span', { style: styles.diagramHint }, t('diagramQueryHint')))),
            h('span', { style: styles.diagramArrow }, '→'),
            h('div', { style: styles.diagramStep },
              h('span', { style: styles.diagramIcon }, '2'),
              h('div', { style: styles.diagramText },
                h('span', { style: styles.diagramTitle }, t('diagramEngine')),
                h('span', { style: styles.diagramHint }, t('diagramEngineHint')))),
            h('span', { style: styles.diagramArrow }, '→'),
            h('div', { style: styles.diagramStep },
              h('span', { style: styles.diagramIcon }, '3'),
              h('div', { style: styles.diagramText },
                h('span', { style: styles.diagramTitle }, t('diagramResult')),
                h('span', { style: styles.diagramHint }, t('diagramResultHint'))))),
          h('div', { style: styles.quickRow },
            quick('engines', t('quickEngines'), readyMissing.length > 0 ? t('pendingEngines', { names: namesOf(readyMissing) }) : t('allEnginesReady')),
            quick('modes', t('quickModes'), `${draft.searchMode === 'quality' ? t('quality') : t('fast')} · ${draft.fetchMode === 'clean' ? t('clean') : t('fast')}`),
            quick('advanced', t('quickAdvanced'), `${SWITCHES.filter((field) => draft[field.key] === true).length} ${t('enabled')}`))),
        h('div', { style: { ...styles.workspace, display: section === 'engines' ? 'grid' : 'none' } },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, engineList, backendPanel),
          h('div', { style: styles.enginePanes }, ...providerCards)),
        h('div', { style: { display: section === 'modes' ? 'flex' : 'none', flexDirection: 'column', gap: '16px' } }, modePanel()),
        h('div', { style: { ...styles.group, display: section === 'advanced' ? 'flex' : 'none' } },
          h('h4', { style: styles.groupTitle }, t('advancedTitle')),
          ...SWITCHES.map((field) => h('div', { key: field.key, style: styles.featureRow },
            h('span', { style: styles.fieldLabel }, t(field.labelKey)),
            h(Toggle, {
              label: t(field.labelKey),
              checked: draft[field.key] === true,
              disabled: readOnly || busy,
              onChange: (value) => setDraft((current) => ({ ...current, [field.key]: value })),
            })))),
        h('div', { style: styles.keyRowLine },
          h('button', {
            type: 'button',
            style: { ...styles.button, ...styles.primary, ...(readOnly || busy || !dirty ? styles.disabled : {}) },
            disabled: readOnly || busy || !dirty,
            onClick: () => { void saveConfig(); },
          }, busy ? t('saving') : t('save')),
          h('button', {
            type: 'button',
            style: { ...styles.button, ...(busy ? styles.disabled : {}) },
            disabled: busy,
            onClick: () => { void refresh(); },
          }, t('refresh')),
          dirty ? h('span', { style: styles.message }, t('unsaved')) : null),
        message.length === 0 ? null : h('p', {
          role: 'status',
          style: { ...styles.message, ...(messageError ? styles.error : styles.success) },
        }, message));
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.settings', 'remote.credentials'],
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
