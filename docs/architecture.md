# dsh-web-search 架构

改 `lib/` 前先读本文件。这里只做地图：行为细节在 [README](../README.md) / [README.zh](../README.zh.md)，实现规则在 [CODING_STANDARDS](../CODING_STANDARDS.md)，决策原因在 [docs/adr](adr/) 与 [Agent Notes](../.agents/notes/README.md)。

## 组成

```text
dsh-tool-web (web_search / web_fetch)      anysearch_* tools (optional)
        │ ctx.web                                  │ ctx.tools
        ▼                                          ▼
web-search-router (lib/index.js) ────────────────┘
        │
        ├── AutoSearchProvider (searchMode: quality | fast)
        └── AutoFetchProvider  (fetchMode: fast | clean)
                │
                ▼
keenable / anysearch / exa / tavily / firecrawl / zhihu / zhihu-site / aihot / http
                │
                ▼
        external search / fetch services
```

插件默认只在 `ctx.web` 注册 Provider；异常是 `lib/tools/` 下的 AnySearch、Tavily 与 AIHOT 高级工具。`dsh-tool-web` 仍负责 `web_search` / `web_fetch` 的 schema、展示和结果形状。

## 入口与注册

`lib/index.js` 导出 `name`、`inject`、`Config` 和 `apply()`。`apply()` 创建各 Provider 与 SiliconFlow 客户端，注册 search / fetch Provider、`auto` 路由与可选高级工具。

Provider 的能力矩阵与默认顺序由 [README 的 Providers 段](../README.md#providers) 拥有；代码中的注册列表在 `lib/index.js`。

## 模块地图

| 模块 | 职责 |
|---|---|
| `lib/index.js` | 插件入口；由 `SETTINGS_SPEC` 生成 `Config`，按 catalog 注册 Provider 与 auto 路由 |
| `lib/providers/*.js` | 各后端适配器、`mapXxxSearch()` 纯映射、Provider 类；消费 `request.routing` 注记，缺省时自推导 |
| `lib/providers/anysearchClient.js` | AnySearch HTTP 客户端（移植自 `anysearch-dsh`） |
| `lib/providers/shared.js` | 适配器共用的 header、计数夹取、文本结果与凭据检查 |
| `lib/providers/router.js` | `AutoSearchProvider` / `AutoFetchProvider`：routing 注解、模式分流、缓存回退；fetch 支持显式 order |
| `lib/providerRunner.js` | 搜索/抓取共用的资格判定、熔断、attempt 与有序回退 |
| `lib/quality.js` | `QualityEngine`：`search(request, signal)` 单入口编排合并、去重、重排降级、权威排序、证据增强与官方文档补充 |
| `lib/enrich.js` | Evidence enrichment：抓取、HTML 清洗、技术/普通摘要 |
| `lib/cache.js` | search / fetch 结果的 TTL + LRU 缓存 |
| `lib/realtime.js` | 天气/汇率实时 |
| `lib/cacheKey.js` | 由 settings 指纹、请求与 fetch 有效顺序生成缓存键 |
| `lib/catalog.js` | Provider 元数据：能力（含 `domainSearch`）、tier（free/paid）、算子支持、付费回退顺序、settingsKey、注册顺序 |
| `lib/settings.js` | `DEFAULT_SETTINGS`、`SETTINGS_SPEC`、`resolveSettings()`、配置校验 |
| `lib/credentials.js` | 通过 DSH credentials 与启动环境解析 API Key |
| `lib/http.js` | `joinURL`、`requestJSON`、超时、取消与 HTTP 错误 |
| `lib/errors.js` | `WebError` 适配与 `WEB_*` 错误码 |
| `lib/intent.js` | intent 路由分类；fastOrder 付费尾从 catalog tier 派生 |
| `lib/technical.js` | 技术文本与查询词启发式 |
| `lib/language.js` | 中英文检测 |
| `lib/query.js` | `site:`、`lang:`、`after:`、`before:` 解析 |
| `lib/officialDocs.js` | 官方文档域名规则与旧文档过滤 |
| `lib/news.js` | 新闻域名、语言过滤与排序加权 |
| `lib/authority.js` | 域名权威加权与排序 |
| `lib/rerank.js` | SiliconFlow 重排：`rerankScored` 单方法，失败降级 |
| `lib/embeddings.js` | SiliconFlow 语义去重 |
| `lib/summarize.js` | 查询相关摘要与证据摘要 |
| `lib/clean.js` | Markdown 正文清洗与 HTML 转文本 |
| `lib/text.js` | 汉字等小型文本判断 |
| `lib/tools/index.js` | 注册可选高级工具 |
| `lib/tools/anysearch-capabilities.js` | `anysearch_capabilities` |
| `lib/tools/anysearch-search.js` | `anysearch_search` |
| `lib/tools/anysearch-batch.js` | `anysearch_batch_search` |
| `lib/tools/anysearch-format.js` | 共用 formatter |
| `lib/tools/anysearchLimits.js` | 高级工具超时 |
| `lib/tools/tavily-search.js` | `tavily_search` |
| `lib/tools/tavily-extract.js` | `tavily_extract` |
| `lib/tools/aihot.js` | `aihot_latest` / `aihot_hot` |
| `test/*.test.js` | 按 lib 模块对应的 `node:test` 单测，不访问网络 |

## 搜索流程

1. `web_search` 进入 `AutoSearchProvider.search()`；先检查取消、读取 `settings()`，解析 routing 注解一次下发，再按 `searchMode` 分流。
2. 缓存命中直接返回；key 由 resolved settings 指纹与请求生成。
3. 天气/汇率查询先由 `realtime.js`（Open-Meteo、ExchangeRate-API/Frankfurter）应答；失败则继续正常搜索。
4. `quality`：`QualityEngine.search()` 用 `qualityPair()` 给出免费 Provider（组合见 README），经 `ProviderRunner.attempt()` 并行调用，合并去重后走 BGE 重排（一次尝试，失败降级为提供方优先序）、域名权威加权与证据增强。官方文档补充只由 catalog 声明 `domainSearch` 的 Provider 承担：免费结果缺官方域且无 `site:` 时触发一次，失败不计熔断。
5. `fast`：`ProviderRunner.run()` 按 `fastOrder()` 顺序逐个尝试（付费尾由 catalog tier 派生）；只有 `isRecoverable(error)` 为真才进入下一个 Provider。
6. 所有 Provider 都失败时返回最后一个可恢复错误；空结果不写缓存。

## 抓取流程

1. `web_fetch` 进入 `AutoFetchProvider.fetch()`；读取 `fetchMode` 与对应顺序，显式 order 计入缓存键。
2. `ProviderRunner.run({ capability: 'fetch' })` 执行回退；`fast` 默认 `keenable → http → anysearch → exa → tavily → firecrawl`，`clean` 默认 `keenable → anysearch → exa → http → tavily → firecrawl`。Tavily 和 Firecrawl 只在前面的免费路径失败后使用。证据增强经显式 `order: fetchOrder` 复用同一实例的缓存与熔断。
3. 直连 HTTP 自己实现最多 5 跳重定向、5 MB 上限、HTML/text/JSON/XML 类型判断和 SPA 空壳回退。
4. 成功结果写缓存；只有可恢复失败按顺序回退并计入熔断，取消和非法 URL 由 `isRecoverable()` 判定为终止并立即返回。

## 配置流

```text
cordis.patch.yml / 设置页
        │
        ▼
Config schema (lib/index.js)
        │
        ▼
DEFAULT_SETTINGS + resolveSettings() (lib/settings.js)
        │
        ▼
settings() thunk ──→ Provider / Router
```

用户可见默认值与配额由 README 的 Configuration 拥有；代码事实由 `DEFAULT_SETTINGS` 拥有；两份 README 必须同步。

## 扩展点

| 目标 | 做法 |
|---|---|
| 新增后端 | 新增 provider 文件与 ID 常量，在 `lib/catalog.js` 声明能力、settingsKey、tier 与算子支持，在 `lib/settings.js` 补 `SETTINGS_SPEC`，补 README 与映射/路由测试；新 id 或契约先写 ADR |
| 新增配置字段 | 同时修改 `Config`、`DEFAULT_SETTINGS`、`resolveSettings`，并更新两份 README |
| 修改路由或回退 | 改 `lib/providers/router.js`，补路由测试，更新 README 的 Behavior 与配额说明 |
| 修改文档 | 先读 [docs/AGENTS.md](AGENTS.md)，按事实归属改唯一一份，再跑 `pnpm docs:check` |
| 记录决策 | 契约级写 ADR；需要保留理由与被放弃方案写 Agent Note |

## 不变量

- 依赖方向、标准 Provider id、工具层归属和付费 API/MCP 禁例：以 `AGENTS.md` 的「依赖方向」与「硬边界」为准。
- Provider 边界只抛 `WEB_*` 错误；只有 `isRecoverable(error)` 为真才触发下一个 Provider，取消和非法 URL 立即返回。
- 搜索与抓取的缓存 key 覆盖所有影响结果的设置；循环必须有界。

## 相关文档

- [README](../README.md) / [README.zh](../README.zh.md)：用户可见行为与配置
- [CODING_STANDARDS](../CODING_STANDARDS.md)：实现与 Review 标准
- [开发指南](development.md) / [测试策略](testing.md)：环境、命令与测试分层
- [新增 Provider](cookbook/adding-a-provider.md)：扩展步骤与验收清单
- [防御性 Review 规则](defensive-patterns.md)：artifact 级细节
- [GLOSSARY](../GLOSSARY.md)：术语
- [ADR](adr/)：契约级决策
- [Agent Notes](../.agents/notes/README.md)：决策理由与备选方案
