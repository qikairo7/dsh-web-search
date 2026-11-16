/** Web settings page for the dsh-web-search bundle. */

window.__ModuleLoader__.load({
  id: '@qikairo7/dsh-web-search',
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
        anonymous: true,
      },
      {
        id: 'anysearch',
        label: 'AnySearch',
        refKey: 'anysearchApiKeyEnv',
        defaultRef: 'ANYSEARCH_API_KEY',
        toggleKey: 'anysearchEnabled',
        hintKey: 'hintAnysearch',
        anonymous: true,
      },
      {
        id: 'exa',
        label: 'Exa',
        refKey: 'exaApiKeyEnv',
        defaultRef: 'EXA_API_KEY',
        toggleKey: 'exaEnabled',
        hintKey: 'hintExa',
      },
      {
        id: 'tavily',
        label: 'Tavily',
        refKey: 'tavilyApiKeyEnv',
        defaultRef: 'TAVILY_API_KEY',
        toggleKey: 'tavilyEnabled',
        hintKey: 'hintTavily',
      },
      {
        id: 'firecrawl',
        label: 'Firecrawl',
        refKey: 'firecrawlApiKeyEnv',
        defaultRef: 'FIRECRAWL_API_KEY',
        toggleKey: 'firecrawlEnabled',
        hintKey: 'hintFirecrawl',
      },
      {
        id: 'zhihu',
        label: '知乎 / Zhihu',
        refKey: 'zhihuApiKeyEnv',
        defaultRef: 'ZHIHU_API_KEY',
        toggleKey: 'zhihuEnabled',
        hintKey: 'hintZhihu',
      },
      {
        id: 'siliconflow',
        label: 'SiliconFlow',
        refKey: 'siliconflowApiKeyEnv',
        defaultRef: 'SILICONFLOW_API_KEY',
        toggleKey: 'siliconflowEnabled',
        hintKey: 'hintSiliconflow',
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
      intro: 'Fill provider API keys, choose which backends are active, and set search and fetch modes. Keenable and AnySearch work anonymously, so you can start without any key.',
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
      quotaTitle: 'Remaining allowance',
      quotaHint: 'Documented free allowance; providers that expose an account endpoint show live remaining values. Keenable refresh sends one minimal search to read credits_remaining.',
      refreshQuota: 'Refresh allowance',
      quotaLoading: 'Refreshing…',
      quotaRemaining: '{value} remaining',
      quotaConsole: 'Check provider console',
      quotaUnavailable: 'No quota endpoint',
      quotaFailed: 'Could not query allowance.',
      quotaKeenable: '100,000 requests/month with a key; 1,000/hour anonymous',
      quotaAnysearch: '1,000 searches/day with a key; anonymous access also works',
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
      searchModeHint: 'Quality merges free providers and reranks with BGE; fast uses one provider with fallback.',
      fetchModeHint: 'Fast prefers Keenable then direct HTTP; clean prefers free extraction first.',
      configured: 'Configured',
      notConfigured: 'Not configured',
      fromEnvironment: 'From environment',
      fromStore: 'Credential store',
      statusUnknown: 'Status unknown',
      loading: 'Loading settings…',
      retry: 'Retry',
      show: 'Show',
      hide: 'Hide',
      unsaved: 'Unsaved changes',
      keyPlaceholder: 'Paste one key, or several separated by commas/spaces',
      apiKeyLabel: '{name} API key',
      keysCount: '{count} keys',
      tooManyKeys: 'Use at most 8 keys per provider.',
      savedKeyMasked: 'Saved key',
      addKey: 'Add key',
      removeKey: 'Delete key',
      addKeyLabel: 'Add key for {name}',
      removeKeyLabel: 'Delete key {index} for {name}',
      test: 'Test',
      testing: 'Testing…',
      testOk: '{name} responded in {ms} ms with {count} result(s).',
      testFailed: 'Verification failed. Check the key, network, or provider status.',
      save: 'Save',
      clear: 'Clear',
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
      hintExa: 'Semantic search and Contents fetch; required for the free depth hop.',
      hintTavily: 'Fallback search, news freshness, and PDF extraction; paid credits.',
      hintFirecrawl: 'Last-resort fetch for JS and PDF pages; paid credits.',
      hintZhihu: 'Chinese search; requires a Zhihu Open Platform Access Secret.',
      hintSiliconflow: 'BGE rerank and embeddings used by quality mode.',
      hintAihot: 'Anonymous AI-news source; no key.',
      hintHttp: 'Anonymous direct HTTP fetch; no key.',
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
      intro: '填写各后端 API Key，选择启用的后端，并设置搜索与抓取模式。Keenable 和 AnySearch 可匿名使用，没有其他 Key 也能先开始。',
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
      quotaTitle: '剩余额度',
      quotaHint: '这里显示文档中的免费额度；提供账户查询接口的 Provider 会显示实时剩余值。Keenable 刷新会发起一次最小搜索读取 credits_remaining。',
      refreshQuota: '刷新额度',
      quotaLoading: '正在刷新…',
      quotaRemaining: '剩余 {value}',
      quotaConsole: '请在 Provider 控制台查看',
      quotaUnavailable: '无额度查询接口',
      quotaFailed: '额度查询失败。',
      quotaKeenable: '有 Key 时 100,000 次/月；匿名 1,000 次/小时',
      quotaAnysearch: '有 Key 时 1,000 次搜索/天；匿名也可用',
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
      searchModeHint: '质量模式合并免费后端并用 BGE 重排；快速模式单后端优先并自动回退。',
      fetchModeHint: '快速模式 Keenable 优先、其次直连 HTTP；干净模式优先免费抽取。',
      configured: '已配置',
      notConfigured: '未配置',
      fromEnvironment: '来自环境变量',
      fromStore: '凭据库',
      statusUnknown: '状态未知',
      loading: '正在加载设置…',
      retry: '重试',
      show: '显示',
      hide: '隐藏',
      unsaved: '有未保存的改动',
      keyPlaceholder: '输入一个 Key，或粘贴多个（逗号/空格分隔）',
      apiKeyLabel: '{name} API Key',
      keysCount: '{count} 个 Key',
      tooManyKeys: '每个 Provider 最多 8 个 Key。',
      savedKeyMasked: '已保存 Key',
      addKey: '添加 Key',
      removeKey: '删除',
      addKeyLabel: '为 {name} 添加 Key',
      removeKeyLabel: '删除 {name} 的第 {index} 个 Key',
      test: '验证',
      testing: '验证中…',
      testOk: '{name} 在 {ms} ms 内返回 {count} 条结果。',
      testFailed: '验证失败，请检查 Key、网络或 Provider 状态。',
      save: '保存',
      clear: '清除',
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
      hintExa: '语义搜索与 Contents 抓取；免费深度回退需要它。',
      hintTavily: '搜索兜底、新闻时效与 PDF 抽取；消耗付费额度。',
      hintFirecrawl: 'JS/PDF 页面的最后兜底抓取；消耗付费额度。',
      hintZhihu: '中文搜索；需要知乎开放平台 Access Secret。',
      hintSiliconflow: '质量模式使用的 BGE 重排与 embeddings。',
      hintAihot: '匿名 AI 新闻源，无需 Key。',
      hintHttp: '匿名直连 HTTP 抓取，无需 Key。',
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

    const styles = {
      section: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '760px',
        color: 'var(--dsw-alias-label-primary)',
      },
      heading: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 600,
        lineHeight: 1.35,
      },
      intro: {
        margin: 0,
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: '13px',
        lineHeight: 1.5,
      },
      group: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '14px 16px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
      },
      groupTitle: {
        margin: 0,
        fontSize: '15px',
        fontWeight: 600,
      },
      groupSubtitle: {
        margin: '4px 0 0',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--dsw-alias-label-tertiary)',
      },
      hint: {
        margin: 0,
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: '12px',
        lineHeight: 1.45,
      },
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 0',
        borderTop: '1px solid var(--dsw-alias-border-l2)',
      },
      cardFirst: {
        borderTop: 'none',
        paddingTop: 0,
      },
      cardHead: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
      },
      cardTitle: {
        fontSize: '13px',
        fontWeight: 600,
      },
      badge: {
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        padding: '2px 8px',
        fontSize: '11px',
        whiteSpace: 'nowrap',
      },
      badgeOn: {
        color: 'var(--dsw-alias-state-business-primary)',
        backgroundColor: 'var(--dsw-alias-state-business-primary-dim, transparent)',
      },
      badgeOff: {
        color: 'var(--dsw-alias-label-tertiary)',
        backgroundColor: 'var(--dsw-alias-bg-l2, transparent)',
      },
      keyRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        alignItems: 'center',
      },
      keyList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      },
      keyValue: {
        flex: '1 1 220px',
        minHeight: '30px',
        display: 'flex',
        alignItems: 'center',
        padding: '4px 10px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '6px',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-tertiary)',
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
      },
      input: {
        flex: '1 1 260px',
        minWidth: '160px',
        boxSizing: 'border-box',
        padding: '7px 9px',
        fontSize: '13px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-l1, transparent)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '6px',
        fontFamily: 'inherit',
      },
      select: {
        padding: '7px 9px',
        fontSize: '13px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-l1, transparent)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '6px',
        fontFamily: 'inherit',
      },
      button: {
        padding: '6px 12px',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-l2, transparent)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '6px',
        cursor: 'pointer',
        fontFamily: 'inherit',
      },
      primary: {
        color: 'var(--dsw-alias-state-business-primary)',
        borderColor: 'var(--dsw-alias-state-business-primary)',
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
      },
      switchOn: {
        background: 'var(--dsw-alias-state-business-primary)',
      },
      knob: {
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: 'var(--dsw-alias-bg-l1, #fff)',
        transition: 'transform 120ms ease',
      },
      knobOn: {
        transform: 'translateX(14px)',
      },
      message: {
        margin: 0,
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      error: {
        color: 'var(--dsw-alias-state-error-primary)',
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

    const MAX_KEY_REFS = 8;

    function keyRefsFor(reference) {
      return [
        reference,
        ...Array.from({ length: MAX_KEY_REFS - 1 }, (_, index) => `${reference}_${index + 2}`),
      ];
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
      for (const provider of PROVIDERS) draft[provider.toggleKey] = truthy(value[provider.toggleKey], true);
      for (const toggle of EXTRA_TOGGLES) draft[toggle.key] = truthy(value[toggle.key], true);
      return draft;
    }

    function configOperations(current, draft) {
      const operations = [];
      const keys = [
        'searchMode',
        'fetchMode',
        ...MODEL_FIELDS.map((field) => field.key),
        ...SWITCHES.map((field) => field.key),
        ...PROVIDERS.map((provider) => provider.toggleKey),
        ...EXTRA_TOGGLES.map((toggle) => toggle.key),
      ];
      for (const key of keys) {
        const before = key === 'searchMode'
          ? (current.searchMode === 'fast' ? 'fast' : 'quality')
          : key === 'fetchMode'
            ? (current.fetchMode === 'clean' ? 'clean' : 'fast')
            : key in MODEL_DEFAULTS
              ? (typeof current[key] === 'string' && current[key].length > 0 ? current[key] : MODEL_DEFAULTS[key])
              : truthy(current[key], BOOLEAN_DEFAULTS[key] !== false);
        if (before !== draft[key]) operations.push({ op: 'set', path: [key], value: draft[key] });
      }
      return operations;
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
        style: {
          ...styles.knob,
          ...(props.checked ? styles.knobOn : {}),
        },
      }));
    }

    function SettingsPage(props) {
      const { t } = props;
      const [state, setState] = React.useState({ status: 'loading' });
      const [draft, setDraft] = React.useState({});
      const [keyRows, setKeyRows] = React.useState({});
      const [keyMessages, setKeyMessages] = React.useState({});
      const [revealed, setRevealed] = React.useState({});
      const [confirmClear, setConfirmClear] = React.useState(undefined);
      const [busy, setBusy] = React.useState(false);
      const [models, setModels] = React.useState({ rerank: [], embedding: [] });
      const [modelsBusy, setModelsBusy] = React.useState(false);
      const [modelMessage, setModelMessage] = React.useState('');
      const [quota, setQuota] = React.useState({});
      const [quotaBusy, setQuotaBusy] = React.useState(false);
      const [quotaMessage, setQuotaMessage] = React.useState('');
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
        const credentialsResult = await safeCall(() => props.ctx.remote.credentials.describe(refs));
        const credentials = isOk(credentialsResult) ? credentialsResult.value : {};
        setKeyRows(Object.fromEntries(PROVIDERS.map((provider) => {
          const reference = String(ns.value?.[provider.refKey] ?? '').trim() || provider.defaultRef;
          return [provider.id, keyRowsFor(reference, credentials)];
        })));
        setState({
          status: 'ready',
          ns,
          writable: settingsResult.value.writable !== false,
          credentials,
          credentialsError: !isOk(credentialsResult),
        });
        if (resetDraft) setDraft(configDraft(ns));
      }, [props.ctx]);

      React.useEffect(() => {
        void refresh();
      }, [refresh]);

      const note = (text, error = false) => {
        setMessage(text);
        setMessageError(error);
      };

      const noteKey = (provider, text, error = false) => {
        setMessage('');
        setKeyMessages((current) => ({ ...current, [provider.id]: { text, error } }));
      };

      const saveKey = async (provider, ref) => {
        const rows = keyRows[provider.id] ?? [];
        const pending = rows.filter((row) => row.value.trim().length > 0);
        if (pending.length === 0) {
          noteKey(provider, t('enterKey'), true);
          return;
        }
        setBusy(true);
        const refs = keyRefsFor(ref);
        const occupied = new Set(rows.filter((row) => row.ref !== null).map((row) => row.ref));
        let failed = false;
        for (const row of pending) {
          let target = row.ref;
          if (target === null) {
            target = refs.find((candidate) => !occupied.has(candidate) && state.credentials?.[candidate]?.configured !== true);
          }
          if (target === undefined) {
            failed = true;
            break;
          }
          occupied.add(target);
          const result = await safeCall(() => props.ctx.remote.credentials.set(target, row.value.trim()));
          if (!isOk(result)) {
            failed = true;
            break;
          }
        }
        if (!failed) {
          setRevealed((current) => ({ ...current, [provider.id]: false }));
          noteKey(provider, t('savedKey', { name: provider.label }));
          await refresh(false);
        } else {
          noteKey(provider, t('saveFailed'), true);
        }
        setBusy(false);
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

      const testProvider = async (provider) => {
        setBusy(true);
        noteKey(provider, t('testing'));
        try {
          const response = await fetch('/dsh-web-search/health', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ providerId: provider.id, capability: 'search' }),
          });
          const data = await response.json();
          if (data?.ok === true) {
            noteKey(provider, t('testOk', {
              name: provider.label,
              ms: data.latencyMs ?? '—',
              count: data.count ?? 0,
            }));
          } else {
            noteKey(provider, t('testFailed'), true);
          }
        } catch {
          noteKey(provider, t('testFailed'), true);
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
            if (data?.ok !== true) throw new Error(data?.message ?? 'models failed');
            next[kind] = Array.isArray(data.models) ? data.models : [];
          }
          setModels(next);
          const count = next.rerank.length + next.embedding.length;
          setModelMessage(t('modelsLoaded', { count }));
        } catch {
          setModelMessage(t('modelsFailed'));
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
            body: JSON.stringify({ providerIds: QUOTA_FIELDS.map((item) => item.id) }),
          });
          const data = await response.json();
          if (data?.ok !== true) throw new Error(data?.message ?? 'quota failed');
          setQuota(data.providers ?? {});
        } catch {
          setQuotaMessage(t('quotaFailed'));
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
      const dirty = configOperations(ns.value ?? {}, draft).length > 0;
      const providerCards = PROVIDERS.map((provider, index) => {
        const ref = String(ns.value?.[provider.refKey] ?? '').trim() || provider.defaultRef;
        const refs = keyRefsFor(ref);
        const configuredRefs = refs.filter((candidate) => state.credentials?.[candidate]?.configured === true);
        const info = state.credentials?.[configuredRefs[0] ?? ref] ?? {};
        const configured = configuredRefs.length > 0 || info.configured === true;
        const keyCount = configuredRefs.length > 0 ? configuredRefs.length : configured ? 1 : 0;
        const writable = info.writable !== false;
        const fromEnvironment = info.source === 'environment';
        const fromStore = typeof info.masked === 'string' && info.masked.length > 0;
        const shown = revealed[provider.id] === true;
        const keyMessage = keyMessages[provider.id];
        const sourceText = fromStore ? t('fromStore') : fromEnvironment ? t('fromEnvironment') : '';
        const statusText = state.credentialsError
          ? t('statusUnknown')
          : configured
            ? (keyCount > 1 ? `${t('configured')} · ${t('keysCount', { count: keyCount })}` : (sourceText.length > 0 ? `${t('configured')} · ${sourceText}` : t('configured')))
            : t('notConfigured');
        return h('div', { key: provider.id, style: { ...styles.card, ...(index === 0 ? styles.cardFirst : {}) } },
          h('div', { style: styles.cardHead },
            h('div', null,
              h('div', { style: styles.cardTitle }, provider.label),
              h('p', { style: styles.hint }, t(provider.hintKey))),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              h(Toggle, {
                label: `${provider.label} ${draft[provider.toggleKey] === true ? t('enabled') : t('disabled')}`,
                checked: draft[provider.toggleKey] === true,
                disabled: readOnly || busy,
                onChange: (value) => setDraft((current) => ({ ...current, [provider.toggleKey]: value })),
              }),
              h('span', { style: { ...styles.badge, ...(configured && !state.credentialsError ? styles.badgeOn : styles.badgeOff) } },
                statusText))),
          h('div', { style: styles.keyList },
            (keyRows[provider.id] ?? []).map((row, rowIndex) => h('div', {
              key: row.ref ?? `new-${rowIndex}`,
              style: styles.keyRow,
            },
            row.ref === null
              ? h('input', {
                style: { ...styles.input, ...(!writable || busy ? styles.disabled : {}) },
                type: shown ? 'text' : 'password',
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
              })
              : h('span', { style: styles.keyValue }, row.masked || t('savedKeyMasked')),
            h('button', {
              type: 'button',
              style: { ...styles.button, ...((busy || !writable) ? styles.disabled : {}) },
              'aria-label': t('removeKeyLabel', { name: provider.label, index: rowIndex + 1 }),
              disabled: busy || !writable,
              onClick: () => { void removeKeyRow(provider, rowIndex); },
            }, t('removeKey')))),
            h('button', {
              type: 'button',
              style: {
                ...styles.button,
                alignSelf: 'flex-start',
                ...((busy || !writable || (keyRows[provider.id] ?? []).length >= MAX_KEY_REFS) ? styles.disabled : {}),
              },
              'aria-label': t('addKeyLabel', { name: provider.label }),
              disabled: busy || !writable || (keyRows[provider.id] ?? []).length >= MAX_KEY_REFS,
              onClick: () => addKeyRow(provider),
            }, t('addKey'))),
          h('div', { style: styles.keyRow },
            h('button', {
              type: 'button',
              style: { ...styles.button, ...((busy || !writable) ? styles.disabled : {}) },
              disabled: busy || !writable,
              onClick: () => setRevealed((current) => ({ ...current, [provider.id]: !shown })),
            }, shown ? t('hide') : t('show')),
            provider.id === 'siliconflow' ? null : h('button', {
              type: 'button',
              style: { ...styles.button, ...((busy || !writable) ? styles.disabled : {}) },
              disabled: busy || !writable,
              onClick: () => { void testProvider(provider); },
            }, busy ? t('testing') : t('test')),
            h('button', {
              type: 'button',
              style: { ...styles.button, ...styles.primary, ...((busy || !writable || !(keyRows[provider.id] ?? []).some((row) => row.value.trim().length > 0)) ? styles.disabled : {}) },
              disabled: busy || !writable || !(keyRows[provider.id] ?? []).some((row) => row.value.trim().length > 0),
              onClick: () => { void saveKey(provider, ref); },
            }, t('save')),
            h('button', {
              type: 'button',
              style: { ...styles.button, ...((busy || !writable || !configured) ? styles.disabled : {}) },
              disabled: busy || !writable || !configured,
              onClick: () => { void clearKey(provider, ref); },
            }, t('clear'))),
          confirmClear === provider.id ? h('div', { style: styles.keyRow },
            h('span', { style: styles.message }, t('clearConfirm', { name: provider.label })),
            h('button', {
              type: 'button',
              style: styles.button,
              onClick: () => { void clearKey(provider, ref); },
            }, t('confirm')),
            h('button', {
              type: 'button',
              style: styles.button,
              onClick: () => setConfirmClear(undefined),
            }, t('cancel'))) : null,
          keyMessage === undefined ? null : h('p', {
            role: 'status',
            style: { ...styles.message, ...(keyMessage.error ? styles.error : {}) },
          }, keyMessage.text));
      });
      const anonymousCount = PROVIDERS.filter((provider) => provider.anonymous === true).length;
      const anonymousCards = providerCards.slice(0, anonymousCount);
      const keyCards = providerCards.slice(anonymousCount);
      const modelOptions = (field) => [...new Set([
        draft[field.key],
        ...(models[field.kind] ?? []),
        MODEL_DEFAULTS[field.key],
      ].filter((value) => typeof value === 'string' && value.length > 0))];
      const quotaRows = QUOTA_FIELDS.map((item) => {
        const value = quota[item.id];
        const live = value?.ok === true && typeof value.remaining === 'number';
        const display = live
          ? t('quotaRemaining', { value: `${String(value.remaining)}${value.currency === 'CNY' ? ' CNY' : ''}` })
          : t('quotaConsole');
        return h('div', { key: item.id, style: styles.fieldRow },
          h('div', null,
            h('span', { style: styles.fieldLabel }, item.label),
            h('p', { style: styles.hint }, t(item.freeKey))),
          h('span', { style: styles.hint }, display));
      });

      return h('section', { style: styles.section },
        h('h3', { style: styles.heading }, t('title')),
        h('p', { style: styles.intro }, t('intro')),
        readOnly ? h('p', { style: styles.hint }, t('readOnly')) : null,
        h('div', { style: styles.group },
          h('h4', { style: styles.groupTitle }, t('keysTitle')),
          h('p', { style: styles.hint }, t('keysHint')),
          h('h5', { style: styles.groupSubtitle }, t('providersAnonymous')),
          ...anonymousCards,
          h('h5', { style: styles.groupSubtitle }, t('providersKey')),
          ...keyCards),
        h('div', { style: styles.group },
          h('h4', { style: styles.groupTitle }, t('providersTitle')),
          ...EXTRA_TOGGLES.map((toggle) => h('div', { key: toggle.key, style: styles.fieldRow },
            h('div', null,
              h('span', { style: styles.fieldLabel }, toggle.label),
              h('p', { style: styles.hint }, t(toggle.hintKey))),
            h(Toggle, {
              label: toggle.label,
              checked: draft[toggle.key] === true,
              disabled: readOnly || busy,
              onChange: (value) => setDraft((current) => ({ ...current, [toggle.key]: value })),
            })))),
        h('div', { style: styles.group },
          h('h4', { style: styles.groupTitle }, t('modesTitle')),
          h('div', { style: styles.fieldRow },
            h('span', { style: styles.fieldLabel }, t('searchMode')),
            h('select', {
              style: { ...styles.select, ...(readOnly || busy ? styles.disabled : {}) },
              'aria-label': t('searchMode'),
              value: draft.searchMode,
              disabled: readOnly || busy,
              onChange: (event) => setDraft((current) => ({ ...current, searchMode: event.target.value })),
            }, h('option', { value: 'quality' }, t('quality')), h('option', { value: 'fast' }, t('fast')))),
          h('p', { style: styles.hint }, t('searchModeHint')),
          h('div', { style: styles.fieldRow },
            h('span', { style: styles.fieldLabel }, t('fetchMode')),
            h('select', {
              style: { ...styles.select, ...(readOnly || busy ? styles.disabled : {}) },
              'aria-label': t('fetchMode'),
              value: draft.fetchMode,
              disabled: readOnly || busy,
              onChange: (event) => setDraft((current) => ({ ...current, fetchMode: event.target.value })),
            }, h('option', { value: 'fast' }, t('fast')), h('option', { value: 'clean' }, t('clean')))),
          h('p', { style: styles.hint }, t('fetchModeHint'))),
        h('div', { style: styles.group },
          h('h4', { style: styles.groupTitle }, t('modelsTitle')),
          h('p', { style: styles.hint }, t('modelsHint')),
          ...MODEL_FIELDS.map((field) => h('div', { key: field.key, style: styles.fieldRow },
            h('span', { style: styles.fieldLabel }, t(field.labelKey)),
            h('select', {
              style: { ...styles.select, ...(readOnly || busy ? styles.disabled : {}) },
              'aria-label': t(field.labelKey),
              value: draft[field.key],
              disabled: readOnly || busy,
              onChange: (event) => setDraft((current) => ({ ...current, [field.key]: event.target.value })),
            }, ...modelOptions(field).map((model) => h('option', { key: model, value: model }, model))))),
          h('div', { style: styles.keyRow },
            h('button', {
              type: 'button',
              style: { ...styles.button, ...(readOnly || busy || modelsBusy ? styles.disabled : {}) },
              disabled: readOnly || busy || modelsBusy,
              onClick: () => { void loadModels(); },
            }, modelsBusy ? t('modelsLoading') : t('fetchModels')),
            modelMessage.length === 0 ? null : h('span', { role: 'status', style: styles.message }, modelMessage))),
        h('div', { style: styles.group },
          h('h4', { style: styles.groupTitle }, t('quotaTitle')),
          h('p', { style: styles.hint }, t('quotaHint')),
          ...quotaRows,
          h('div', { style: styles.keyRow },
            h('button', {
              type: 'button',
              style: { ...styles.button, ...(quotaBusy ? styles.disabled : {}) },
              disabled: quotaBusy,
              onClick: () => { void loadQuotas(); },
            }, quotaBusy ? t('quotaLoading') : t('refreshQuota')),
            quotaMessage.length === 0 ? null : h('span', { role: 'status', style: { ...styles.message, ...styles.error } }, quotaMessage))),
        h('div', { style: styles.group },
          h('h4', { style: styles.groupTitle }, t('advancedTitle')),
          ...SWITCHES.map((field) => h('div', { key: field.key, style: styles.fieldRow },
            h('span', { style: styles.fieldLabel }, t(field.labelKey)),
            h(Toggle, {
              label: t(field.labelKey),
              checked: draft[field.key] === true,
              disabled: readOnly || busy,
              onChange: (value) => setDraft((current) => ({ ...current, [field.key]: value })),
            })))),
        h('div', { style: styles.keyRow },
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
          style: { ...styles.message, ...(messageError ? styles.error : {}) },
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
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'web-search-router',
          order: 60,
          label: () => t('title'),
          locale: NS,
        }, Page)), 'dsh-web-search: settings section');
      },
    };
  },
});
