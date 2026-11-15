# Configuration / 配置

本文件是配置字段、默认值和说明的唯一事实来源。两个 README 只保留行为概览并链接到这里。

## English

The settings page is generated from the plugin's `Config` schema. All fields are optional; the defaults below match the verified setup.

### Mode and routing

| Field | Default | Meaning |
|---|---|---|
| `searchMode` | `quality` | `quality` = free-source merge + rerank + top-5 evidence enrichment; `fast` = single-provider priority order |
| `fetchMode` | `fast` | `fast` = Keenable/direct HTTP first; `clean` = Keenable/AnySearch/Exa extraction first, HTTP then, Tavily/Firecrawl fallback |
| `intentRouting` | `true` | Route technical/news/Chinese-community queries with free-first role-table orders; routed queries ignore the configured orders (`false` always uses the configured orders) |
| `languageRouting` | `true` | Detect query language and pass `language` to Tavily/AnySearch |
| `officialDocsEnabled` | `true` | Add a domain-restricted Tavily search only when free results miss known official docs |
| `newsFreshnessEnabled` | `true` | Add one Tavily news search for non-AI news queries when fewer than 3 free results are dated within 7 days |
| `aihotEnabled` | `true` | Enable the AIHOT AI-news provider |
| `chineseSearchOrder` | `zhihu,keenable,anysearch,exa,tavily,firecrawl` | Fast-mode search order for Han queries not caught by intent routing |
| `defaultSearchOrder` | `keenable,anysearch,exa,tavily,firecrawl` | Fast-mode search order for other queries not caught by intent routing |
| `fetchOrder` | `keenable,http,anysearch,exa,tavily,firecrawl` | Fast fetch fallback order |
| `cleanFetchOrder` | `keenable,anysearch,exa,http,tavily,firecrawl` | Clean fetch order |
| `tavilyIncludeAnswer` | `true` | Map Tavily's answer to `web_search.content` |
| `zhihuIncludeMetadata` | `true` | Add author/vote/comment to Zhihu summaries |

### Backends and credentials

| Field | Default | Meaning |
|---|---|---|
| `anysearchEnabled` | `true` | Enable AnySearch |
| `anysearchApiKeyEnv` | `ANYSEARCH_API_KEY` | AnySearch credential reference |
| `anysearchBaseURL` | `https://api.anysearch.com` | AnySearch API base |
| `anysearchMaxRenderedContentChars` | `12000` | Per-call rendered-content cap for `anysearch_search` / `anysearch_batch_search` |
| `keenableEnabled` | `true` | Enable Keenable |
| `keenableApiKeyEnv` | `KEENABLE_API_KEY` | Keenable credential reference |
| `keenableBaseURL` | `https://api.keenable.ai` | Keenable API base |
| `exaEnabled` | `true` | Enable Exa |
| `exaApiKeyEnv` | `EXA_API_KEY` | Exa credential reference |
| `exaBaseURL` | `https://api.exa.ai` | Exa API base |
| `tavilyEnabled` | `true` | Enable Tavily |
| `tavilyApiKeyEnv` | `TAVILY_API_KEY` | Tavily credential reference |
| `tavilyBaseURL` | `https://api.tavily.com` | Tavily API base |
| `firecrawlEnabled` | `true` | Enable Firecrawl |
| `firecrawlApiKeyEnv` | `FIRECRAWL_API_KEY` | Firecrawl credential reference |
| `firecrawlBaseURL` | `https://api.firecrawl.dev` | Firecrawl API base |
| `zhihuEnabled` | `true` | Enable Zhihu providers |
| `zhihuApiKeyEnv` | `ZHIHU_API_KEY` | Zhihu Access Secret reference |
| `zhihuBaseURL` | `https://developer.zhihu.com` | Zhihu API base |
| `aihotBaseURL` | `https://aihot.news` | AIHOT API base |
| `httpEnabled` | `true` | Enable the direct HTTP fetch provider |
| `siliconflowEnabled` | `true` | Enable SiliconFlow reranking |
| `siliconflowApiKeyEnv` | `SILICONFLOW_API_KEY` | SiliconFlow credential reference |
| `siliconflowBaseURL` | `https://api.siliconflow.cn/v1` | SiliconFlow API base |
| `siliconflowRerankModel` | `BAAI/bge-reranker-v2-m3` | Rerank model |
| `siliconflowEmbeddingsEnabled` | `true` | Enable semantic duplicate removal |
| `siliconflowEmbeddingModel` | `BAAI/bge-m3` | Embedding model |

### Quality, limits, and cache

| Field | Default | Meaning |
|---|---|---|
| `semanticDedupThreshold` | `0.95` | Cosine similarity threshold for duplicate removal |
| `requestTimeoutMs` | `30000` | Per-request timeout |
| `maxFetchChars` | `200000` | Maximum characters returned by `web_fetch` |
| `maxSnippetChars` | `4000` | Maximum characters per search summary |
| `enrichEnabled` | `true` | Fetch top sources and regenerate their summaries |
| `enrichTopN` | `5` | Number of top sources to enrich |
| `enrichSummaryMinChars` | `800` | Minimum enriched summary length |
| `enrichSummaryMaxChars` | `1500` | Maximum enriched summary length |
| `minDirectHtmlChars` | `2048` | SPA-shell detection threshold |
| `searchCacheTtlMs` | `300000` | Search cache TTL |
| `searchCacheMaxEntries` | `200` | Search cache entry cap |
| `fetchCacheTtlMs` | `600000` | Fetch cache TTL |
| `fetchCacheMaxEntries` | `100` | Fetch cache entry cap |
| `breakerFailureThreshold` | `3` | Consecutive failures before cooldown |
| `breakerCooldownMs` | `300000` | Provider cooldown |

All `*BaseURL` fields, including `anysearchBaseURL`, `tavilyBaseURL`, and `firecrawlBaseURL`, appear in the tables above and can be overridden from the settings page or a profile patch.

## 中文

设置页由插件的 `Config` schema 自动生成。所有字段可选，默认值如下。

### 模式与路由

| 字段 | 默认值 | 说明 |
|---|---|---|
| `searchMode` | `quality` | `quality` = 免费源合并 + 重排 + 前 5 条证据增强；`fast` = 单后端优先顺序 |
| `fetchMode` | `fast` | `fast` = Keenable/直连 HTTP 优先；`clean` = Keenable/AnySearch/Exa 抽取优先、HTTP 其后，Tavily/Firecrawl 兜底 |
| `intentRouting` | `true` | 命中 technical / news / 中文社区路由的查询使用角色表（`lib/roles.js`）派生的免费优先顺序，忽略自定义顺序；`false` 时全部使用自定义顺序 |
| `languageRouting` | `true` | 检测查询语言并把 `language` 传给 Tavily/AnySearch |
| `officialDocsEnabled` | `true` | 免费结果未命中已知官方域时，额外跑一次受限 Tavily 搜索 |
| `newsFreshnessEnabled` | `true` | 非 AI 新闻查询的免费结果 7 天内带日期来源不足 3 条时，额外跑一次 Tavily news 搜索 |
| `aihotEnabled` | `true` | 启用 AIHOT AI 新闻源 |
| `chineseSearchOrder` | `zhihu,keenable,anysearch,exa,tavily,firecrawl` | fast 模式下未命中 intent 路由的含汉字查询的搜索顺序 |
| `defaultSearchOrder` | `keenable,anysearch,exa,tavily,firecrawl` | fast 模式下未命中 intent 路由的其他查询的搜索顺序 |
| `fetchOrder` | `keenable,http,anysearch,exa,tavily,firecrawl` | fast 抓取回退顺序 |
| `cleanFetchOrder` | `keenable,anysearch,exa,http,tavily,firecrawl` | clean 抓取顺序 |
| `tavilyIncludeAnswer` | `true` | 把 Tavily 答案映射到 `web_search.content` |
| `zhihuIncludeMetadata` | `true` | 知乎 summary 加入作者/赞同/评论 |

### 后端与凭据

| 字段 | 默认值 | 说明 |
|---|---|---|
| `anysearchEnabled` | `true` | 启用 AnySearch |
| `anysearchApiKeyEnv` | `ANYSEARCH_API_KEY` | AnySearch 凭据引用 |
| `anysearchBaseURL` | `https://api.anysearch.com` | AnySearch API 地址 |
| `anysearchMaxRenderedContentChars` | `12000` | `anysearch_search` / `anysearch_batch_search` 单次向模型展示的正文字符上限 |
| `keenableEnabled` | `true` | 启用 Keenable |
| `keenableApiKeyEnv` | `KEENABLE_API_KEY` | Keenable 凭据引用 |
| `keenableBaseURL` | `https://api.keenable.ai` | Keenable API 地址 |
| `exaEnabled` | `true` | 启用 Exa |
| `exaApiKeyEnv` | `EXA_API_KEY` | Exa 凭据引用 |
| `exaBaseURL` | `https://api.exa.ai` | Exa API 地址 |
| `tavilyEnabled` | `true` | 启用 Tavily |
| `tavilyApiKeyEnv` | `TAVILY_API_KEY` | Tavily 凭据引用 |
| `tavilyBaseURL` | `https://api.tavily.com` | Tavily API 地址 |
| `firecrawlEnabled` | `true` | 启用 Firecrawl |
| `firecrawlApiKeyEnv` | `FIRECRAWL_API_KEY` | Firecrawl 凭据引用 |
| `firecrawlBaseURL` | `https://api.firecrawl.dev` | Firecrawl API 地址 |
| `zhihuEnabled` | `true` | 启用知乎 Provider |
| `zhihuApiKeyEnv` | `ZHIHU_API_KEY` | 知乎 Access Secret 引用 |
| `zhihuBaseURL` | `https://developer.zhihu.com` | 知乎 API 地址 |
| `aihotBaseURL` | `https://aihot.news` | AIHOT API 地址 |
| `httpEnabled` | `true` | 启用直连 HTTP 抓取 |
| `siliconflowEnabled` | `true` | 启用 SiliconFlow 重排 |
| `siliconflowApiKeyEnv` | `SILICONFLOW_API_KEY` | SiliconFlow 凭据引用 |
| `siliconflowBaseURL` | `https://api.siliconflow.cn/v1` | SiliconFlow API 地址 |
| `siliconflowRerankModel` | `BAAI/bge-reranker-v2-m3` | 重排模型 |
| `siliconflowEmbeddingsEnabled` | `true` | 启用语义去重 |
| `siliconflowEmbeddingModel` | `BAAI/bge-m3` | Embedding 模型 |

### 质量、限制与缓存

| 字段 | 默认值 | 说明 |
|---|---|---|
| `semanticDedupThreshold` | `0.95` | 语义重复的余弦阈值 |
| `requestTimeoutMs` | `30000` | 单次请求超时 |
| `maxFetchChars` | `200000` | `web_fetch` 最大字符数 |
| `maxSnippetChars` | `4000` | 每条搜索 summary 最大字符数 |
| `enrichEnabled` | `true` | 抓取前几条结果正文并重生成摘要 |
| `enrichTopN` | `5` | 参与增强的前几条结果数 |
| `enrichSummaryMinChars` | `800` | 增强摘要最小字符数 |
| `enrichSummaryMaxChars` | `1500` | 增强摘要最大字符数 |
| `minDirectHtmlChars` | `2048` | SPA 空壳判定阈值 |
| `searchCacheTtlMs` | `300000` | 搜索缓存 TTL |
| `searchCacheMaxEntries` | `200` | 搜索缓存条数上限 |
| `fetchCacheTtlMs` | `600000` | 抓取缓存 TTL |
| `fetchCacheMaxEntries` | `100` | 抓取缓存条数上限 |
| `breakerFailureThreshold` | `3` | 连续失败多少次后冷却 |
| `breakerCooldownMs` | `300000` | 后端冷却时长 |

所有 `*BaseURL` 字段（包括 `anysearchBaseURL`、`tavilyBaseURL`、`firecrawlBaseURL`）都在上面的表格中，可在设置页或 profile patch 中覆盖。
