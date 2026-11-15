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
      providersTitle: 'Providers',
      modesTitle: 'Search behavior',
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
      statusUnknown: 'Status unknown',
      loading: 'Loading settings…',
      retry: 'Retry',
      show: 'Show',
      hide: 'Hide',
      unsaved: 'Unsaved changes',
      keyPlaceholder: 'sk-…',
      savedPlaceholder: 'Saved key: type a new one to replace it',
      save: 'Save',
      clear: 'Clear',
      saving: 'Saving…',
      saved: 'Saved.',
      savedKey: 'Saved {name} key.',
      clearedKey: 'Cleared {name} key.',
      saveFailed: 'The deployment refused the write. Check the key and try again.',
      configSaveFailed: 'The deployment refused these settings. Review the values and try again.',
      enterKey: 'Enter a key first.',
      clearConfirm: 'Clear the stored key for {name}?',
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
      providersTitle: '后端开关',
      modesTitle: '搜索行为',
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
      statusUnknown: '状态未知',
      loading: '正在加载设置…',
      retry: '重试',
      show: '显示',
      hide: '隐藏',
      unsaved: '有未保存的改动',
      keyPlaceholder: 'sk-…',
      savedPlaceholder: '已保存；输入新 Key 可替换',
      save: '保存',
      clear: '清除',
      saving: '保存中…',
      saved: '已保存。',
      savedKey: '{name} Key 已保存。',
      clearedKey: '{name} Key 已清除。',
      saveFailed: '部署拒绝了写入，请检查 Key 后重试。',
      configSaveFailed: '部署拒绝了这些设置，请复核后重试。',
      enterKey: '请先输入 Key。',
      clearConfirm: '确认清除 {name} 的已保存 Key？',
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
        ...SWITCHES.map((field) => field.key),
        ...PROVIDERS.map((provider) => provider.toggleKey),
        ...EXTRA_TOGGLES.map((toggle) => toggle.key),
      ];
      for (const key of keys) {
        const before = key === 'searchMode'
          ? (current.searchMode === 'fast' ? 'fast' : 'quality')
          : key === 'fetchMode'
            ? (current.fetchMode === 'clean' ? 'clean' : 'fast')
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
      const [keyDrafts, setKeyDrafts] = React.useState({});
      const [keyMessages, setKeyMessages] = React.useState({});
      const [revealed, setRevealed] = React.useState({});
      const [busy, setBusy] = React.useState(false);
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
        const refs = PROVIDERS.map((provider) => String(ns.value?.[provider.refKey] ?? '').trim() || provider.defaultRef);
        const credentialsResult = await safeCall(() => props.ctx.remote.credentials.describe(refs));
        setState({
          status: 'ready',
          ns,
          writable: settingsResult.value.writable !== false,
          credentials: isOk(credentialsResult) ? credentialsResult.value : {},
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
        const value = (keyDrafts[provider.id] ?? '').trim();
        if (value.length === 0) {
          noteKey(provider, t('enterKey'), true);
          return;
        }
        setBusy(true);
        const result = await safeCall(() => props.ctx.remote.credentials.set(ref, value));
        if (isOk(result)) {
          setKeyDrafts((current) => ({ ...current, [provider.id]: '' }));
          setRevealed((current) => ({ ...current, [provider.id]: false }));
          noteKey(provider, t('savedKey', { name: provider.label }));
          await refresh(false);
        } else {
          noteKey(provider, t('saveFailed'), true);
        }
        setBusy(false);
      };

      const clearKey = async (provider, ref) => {
        if (!window.confirm(t('clearConfirm', { name: provider.label }))) return;
        setBusy(true);
        const result = await safeCall(() => props.ctx.remote.credentials.unset(ref));
        if (isOk(result)) {
          noteKey(provider, t('clearedKey', { name: provider.label }));
          await refresh(false);
        } else {
          noteKey(provider, t('saveFailed'), true);
        }
        setBusy(false);
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
        const info = state.credentials?.[ref] ?? {};
        const configured = info.configured === true;
        const writable = info.writable !== false;
        const fromEnvironment = info.source === 'environment';
        const shown = revealed[provider.id] === true;
        const keyMessage = keyMessages[provider.id];
        const statusText = state.credentialsError
          ? t('statusUnknown')
          : configured ? (fromEnvironment ? t('fromEnvironment') : t('configured')) : t('notConfigured');
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
          h('div', { style: styles.keyRow },
            h('input', {
              style: { ...styles.input, ...(!writable || busy ? styles.disabled : {}) },
              type: shown ? 'text' : 'password',
              autoComplete: 'new-password',
              placeholder: configured ? t('savedPlaceholder') : t('keyPlaceholder'),
              value: keyDrafts[provider.id] ?? '',
              disabled: !writable || busy,
              onChange: (event) => setKeyDrafts((current) => ({ ...current, [provider.id]: event.target.value })),
            }),
            h('button', {
              type: 'button',
              style: { ...styles.button, ...((busy || !writable) ? styles.disabled : {}) },
              disabled: busy || !writable,
              onClick: () => setRevealed((current) => ({ ...current, [provider.id]: !shown })),
            }, shown ? t('hide') : t('show')),
            h('button', {
              type: 'button',
              style: { ...styles.button, ...styles.primary, ...((busy || !writable || (keyDrafts[provider.id] ?? '').trim().length === 0) ? styles.disabled : {}) },
              disabled: busy || !writable || (keyDrafts[provider.id] ?? '').trim().length === 0,
              onClick: () => { void saveKey(provider, ref); },
            }, t('save')),
            h('button', {
              type: 'button',
              style: { ...styles.button, ...((busy || !writable || !configured) ? styles.disabled : {}) },
              disabled: busy || !writable || !configured,
              onClick: () => { void clearKey(provider, ref); },
            }, t('clear'))),
          keyMessage === undefined ? null : h('p', {
            role: 'status',
            style: { ...styles.message, ...(keyMessage.error ? styles.error : {}) },
          }, keyMessage.text));
      });

      return h('section', { style: styles.section },
        h('h3', { style: styles.heading }, t('title')),
        h('p', { style: styles.intro }, t('intro')),
        readOnly ? h('p', { style: styles.hint }, t('readOnly')) : null,
        h('div', { style: styles.group },
          h('h4', { style: styles.groupTitle }, t('keysTitle')),
          h('p', { style: styles.hint }, t('keysHint')),
          ...providerCards),
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
              value: draft.searchMode,
              disabled: readOnly || busy,
              onChange: (event) => setDraft((current) => ({ ...current, searchMode: event.target.value })),
            }, h('option', { value: 'quality' }, t('quality')), h('option', { value: 'fast' }, t('fast')))),
          h('p', { style: styles.hint }, t('searchModeHint')),
          h('div', { style: styles.fieldRow },
            h('span', { style: styles.fieldLabel }, t('fetchMode')),
            h('select', {
              style: { ...styles.select, ...(readOnly || busy ? styles.disabled : {}) },
              value: draft.fetchMode,
              disabled: readOnly || busy,
              onChange: (event) => setDraft((current) => ({ ...current, fetchMode: event.target.value })),
            }, h('option', { value: 'fast' }, t('fast')), h('option', { value: 'clean' }, t('clean')))),
          h('p', { style: styles.hint }, t('fetchModeHint'))),
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
        }, Page)), 'dsh-web-search: settings page');
      },
    };
  },
});
