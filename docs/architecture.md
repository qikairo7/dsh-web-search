# dsh-web-search 架构

改 `lib/` 前先读本文件。这里只做地图：行为概览在 [README](../README.md) / [README.en](../README.en.md)；请求流细节见本文档与 [docs/configuration.md](configuration.md)，实现规则在 [CODING_STANDARDS](../CODING_STANDARDS.md)，决策原因在 [docs/adr](adr/) 与维护者本地决策记录（见根 AGENTS.md 的「维护者本地文件」节）。

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
keenable / anysearch / exa / bing / tavily / firecrawl / zhihu / zhihu-site / aihot / github / http
                │
                ▼
        external search / fetch services
```

插件默认只在 `ctx.web` 注册 Provider；例外是 `lib/tools/` 下的 AnySearch、Tavily、AIHOT 与 X 搜索高级工具。`dsh-tool-web` 仍负责 `web_search` / `web_fetch` 的 schema、展示和结果形状。

## 入口与注册

`lib/index.js` 导出 `name`、`inject`、`Config` 和 `apply()`。`apply()` 经 `createProviders()` 按 catalog 顺序构造各 Provider 实例与 SiliconFlow 客户端，注册 search / fetch Provider、`auto` 路由与可选高级工具。

## Provider 能力与默认顺序

| Provider id | 搜索 | 抓取 | 默认角色 |
|---|---|---|---|
| `anysearch` | 是 | 是 | 英文/默认搜索补充；覆盖面广 |
| `keenable` | 是 | 是 | 免费额度首选；搜索 + 干净 Markdown 抓取 |
| `exa` | 是 | 是 | 语义搜索 + Contents 抓取；免费栈之后的免费深度回退 |
| `bing` | 是 | 否 | 免 Key HTML SERP 兜底；免费栈之后、付费尾之前 |
| `github` | 是 | 是 | GitHub API：仓库/issue 搜索 + issue/README 抓取 |
| `tavily` | 是 | 是 | 搜索兜底；新闻时效/官方文档补充；可选生成答案；PDF Extract |
| `firecrawl` | 是 | 是 | 仅 Fetch 最后兜底；SPA/PDF 抓取最强 |
| `zhihu` | 是 | 否 | 中文搜索首选；全网 + 站内补充 |
| `zhihu-site` | 是 | 否 | 单独选择时只搜知乎站内 |
| `aihot` | 是 | 否 | AI 新闻查询的精选源；匿名 |
| `http` | 否 | 是 | 直连 HTTP 抓取；fast 顺序中位于 Keenable 之后 |
| `auto` | 是 | 是 | 默认自动路由 |

## 模块地图

| 模块 | 职责 |
|---|---|
| `lib/index.js` | 插件入口；由 `SETTINGS_SPEC` 生成 `Config`，`createProviders()` 按 catalog 派生实例并注册 |
| `lib/health.js` | 设置页的 Provider 管理路由：健康检查、SiliconFlow 模型列表和可查询的 Provider 额度；仅在 Web Server profile 注册 |
| `lib/providers/*.js` | 各后端适配器与 `mapXxxSearch()` 纯映射；消费 `request.routing` 注记，缺省时经 `resolveRouting` 推导 |
| `lib/providers/shared.js` | 适配器共用层：`providerOperation` 骨架（超时、错误边界、诊断标签）、`USER_AGENT`、计数夹取、凭据检查 |
| `lib/providers/anysearchClient.js` | AnySearch HTTP 客户端（移植自 `anysearch-dsh`） |
| `lib/providers/router.js` | `AutoSearchProvider` / `AutoFetchProvider`：模式分流、routing 注解、缓存回退；fetch 支持显式 order |
| `lib/providerRunner.js` | 搜索/抓取共用的资格判定、熔断、attempt 与有序回退；成功路径播报 debug 级 provider trail |
| `lib/routing.js` | routing 事实的唯一家：`routingFacts` 注记构造与 `resolveRouting` 缺省推导（intent / syntax / language） |
| `lib/roles.js` | 路由角色单一表：quality 组合、fast 免费前缀、settings 级默认顺序（拼 keyless 地板与付费尾） |
| `lib/quality.js` | `QualityEngine`：单入口编排合并、去重、重排降级、权威排序、证据增强与官方文档补充 |
| `lib/enrich.js` | Evidence enrichment：抓取、HTML 清洗、技术/普通摘要；有界性在模块内兜底 |
| `lib/cache.js` | TTL + LRU 机制层（`TtlLruCache`）与按能力的策略层（`ResultCache`：TTL / 容量 / 写条件） |
| `lib/realtime.js` | 天气/汇率实时 |
| `lib/cacheKey.js` | 缓存键：settings 指纹 + 请求 + fetch 有效顺序；search order 纯度由 `test/routing-purity.test.js` 守护 |
| `lib/catalog.js` | Provider 元数据：能力、tier（free / keyless / paid）、算子支持、keyless 地板与付费回退顺序、settingsKey、注册顺序 |
| `lib/settings.js` | `DEFAULT_SETTINGS`、`SETTINGS_SPEC`（`path` 兼任默认值指针）、`resolveSettings()` |
| `lib/credentials.js` | 通过 DSH credentials 与启动环境解析 API Key；支持 `*_2`、`*_3` 多 Key 引用 |
| `lib/keyring.js` | Provider 多 Key 包装：按顺序尝试 Key，额度/限流/鉴权失败切换到下一个 |
| `lib/quotaStore.js` | 缓存 Provider 响应中的最近一次额度读数（Keenable 的 `credits_remaining`） |
| `lib/http.js` | `joinURL`、`requestJSON` / `requestText`、超时、取消与 HTTP 错误 |
| `lib/host.js` | host 归一化、域名匹配与直连 HTTP 私网地址判定/解析校验的唯一实现；读取 `DSH_WEB_HTTP_ALLOW_PRIVATE` 逃生门 |
| `lib/errors.js` | `WebError` 适配与 `WEB_*` 错误码；`toWebError` 保留调用方已带的 `WEB_*` code |
| `lib/intent.js` | intent 路由分类；quality/fast 顺序查询 `lib/roles.js` 角色表 |
| `lib/technical.js` | 技术文本与查询词启发式 |
| `lib/query.js` | `site:`、`lang:`、`after:`、`before:` 解析（provider 中立） |
| `lib/officialDocs.js` | 官方文档域名规则与旧文档过滤 |
| `lib/news.js` | 新闻域名、语言过滤与排序加权 |
| `lib/authority.js` | 域名权威加权与排序 |
| `lib/rerank.js` | SiliconFlow 重排：`rerankScored` 单方法，失败降级 |
| `lib/embeddings.js` | SiliconFlow 语义去重 |
| `lib/summarize.js` | 查询相关摘要与证据摘要 |
| `lib/clean.js` | Markdown 正文清洗与 HTML 转文本 |
| `lib/text.js` | 汉字检测与中英文语言判断 |
| `lib/tools/*.js` | 可选高级工具：AnySearch 三件、formatter/限额、`tavily_*`、`aihot_*`、`x_search`（X，ADR-0013）；`index.js` 负责注册 |
| `test/*.test.js` | 按 lib 模块对应的 `node:test` 单测，不访问网络；HTTP 拦截用 `test/helpers/withFetch.js` |

## 搜索流程

1. `web_search` 进入 `AutoSearchProvider.search()`；检查取消、读 `settings()`，经 `routingFacts()` 一次下发 routing 注解，按 `searchMode` 分流。
2. 缓存命中直接返回；key 由 resolved settings 指纹与请求生成。
3. 天气/汇率查询先由 `realtime.js`（Open-Meteo、ExchangeRate-API/Frankfurter）应答；失败则继续正常搜索。
4. `quality`：`QualityEngine.search()` 从角色表取该语言免费 Provider 并行调用，合并去重后走 BGE 重排（一次尝试，失败降级为提供方优先序）、权威加权与证据增强。补充缝各触发一次、不计熔断：官方文档补充由 `domainSearch` 声明者承担（缺官方域且无 `site:` 时）；新闻时效补充由 `newsSupplement` 声明者承担（条件见 README）。
5. `fast`：`ProviderRunner.run()` 按 `fastOrder()` 顺序逐个尝试（付费尾由 catalog tier 派生）；只有 `isRecoverable(error)` 为真才进入下一个 Provider。
6. 所有 Provider 都失败时返回最后一个可恢复错误；空结果不写缓存；弱结果沿原序再试 1 家免费后端（ADR-0015）。

## 抓取流程

1. `web_fetch` 进入 `AutoFetchProvider.fetch()`；读取 `fetchMode` 与对应顺序，显式 order 计入缓存键。
2. `ProviderRunner.run({ capability: 'fetch' })` 执行回退；顺序由 `fetchOrder` / `cleanFetchOrder` 拥有（见[配置](configuration.md)）；github.com 的 issue 与仓库主页直取 GitHub API。付费尾只在免费路径失败后使用；证据增强经显式 `order: fetchOrder` 复用缓存与熔断。
3. 直连 HTTP 自己实现最多 5 跳重定向、5 MB 上限、HTML/text/JSON/XML 类型判断和 SPA 空壳回退。
4. 非弱成功结果写缓存；回退与熔断规则同搜索（见不变量）。

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

用户可见默认值与配额由 [配置](configuration.md) 拥有；代码事实由 `DEFAULT_SETTINGS` 拥有。

## 扩展点

| 目标 | 做法 |
|---|---|
| 新增后端 | 新增 provider 文件与 ID 常量；在 `lib/catalog.js` 声明能力、settingsKey、tier 与算子，在 `lib/index.js` factory 表与 `lib/settings.js` `SETTINGS_SPEC` 登记；补 README 与映射/路由测试；新 id 或契约先写 ADR |
| 新增配置字段 | 同时修改 `Config`、`DEFAULT_SETTINGS`、`SETTINGS_SPEC`，并更新两份 README |
| 修改路由或回退 | 改 `lib/providers/router.js`、`lib/roles.js` 或 `lib/routing.js`，补路由测试，更新 README 的 Behavior 与配额说明 |
| 修改文档 | 先读 [docs/AGENTS.md](AGENTS.md)，按事实归属改唯一一份，再跑 `pnpm docs:check` |
| 记录决策 | 契约级写 ADR；需要保留理由与被放弃方案写 Agent Note |

## 不变量

- 依赖方向、标准 Provider id、工具层归属和付费 API/MCP 禁例：以 [CODING_STANDARDS.md](../CODING_STANDARDS.md) 第 1 节与根 [AGENTS.md](../AGENTS.md) 的「硬边界」为准。
- Provider 边界只抛 `WEB_*` 错误；只有 `isRecoverable(error)` 为真才触发下一个 Provider，取消和非法 URL 立即返回。
- 搜索与抓取的缓存 key 覆盖所有影响结果的设置；循环必须有界。
- 成功调用在 debug 级播报 provider trail（尝试名单 + 应答家）；默认级别无输出，返回结构与行为不变。

## 相关文档

- [开发指南](development.md) / [测试策略](testing.md)：环境、命令与测试分层
- [新增 Provider](cookbook/adding-a-provider.md)：扩展步骤与验收清单
- [防御性 Review 规则](defensive-patterns.md)：artifact 级细节
- [GLOSSARY](../GLOSSARY.md)：术语
