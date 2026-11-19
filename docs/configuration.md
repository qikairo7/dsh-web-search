# 配置

本文件是配置字段、默认值和说明的唯一事实来源。两个 README 只保留行为概览并链接到这里。

设置页由插件的 `Config` schema 自动生成。所有字段可选，默认值如下。

## 各后端免费额度

各后端文档化的免费额度；Tavily 与 Firecrawl 的实时剩余值显示在设置页。

| 后端 | 免费额度 | 用途 |
|---|---|---|
| Keenable | 100,000 次/月（Key）；匿名 1,000 次/小时 | 默认搜索 + 干净 Markdown 抓取 |
| AnySearch | 注册后 1000 次搜索/天；匿名也可用 | 搜索 |
| Exa | 每月 10 美元免费额度（docs.exa.ai）+ 一次性 10 美元注册奖励 | 语义搜索 + Contents 抓取；免费深度回退 |
| Bing | 免 Key HTML SERP，无计量配额 | 免费栈之后、付费尾之前的兜底搜索地板 |
| Zhihu | 全网 5000 次/天 + 站内 5000 次/天 | 中文搜索 |
| Tavily | 1000 credits/月 | 仅兜底：免费源空结果、缺官方文档、新闻时效不足、Fetch 失败链 |
| Firecrawl | 1000 credits/月 | Fetch 最后兜底：难抓的 JS/PDF 页面 |
| AIHOT | 匿名只读 | AI 新闻搜索/精选（免费） |
| 直连 HTTP | 无 API 成本 | 静态页面抓取 |
| SiliconFlow | 免费额度 | BGE 重排 + embeddings |

## 模式与路由

| 字段 | 默认值 | 说明 |
|---|---|---|
| `searchMode` | `quality` | `quality` = 免费源合并 + 重排 + 前 5 条证据增强；`fast` = 单后端优先顺序 |
| `fetchMode` | `fast` | `fast` = Keenable/直连 HTTP 优先；`clean` = Keenable/AnySearch/Exa 抽取优先、HTTP 其后，Tavily/Firecrawl 兜底 |
| `intentRouting` | `true` | 命中 technical / news / 中文社区路由的查询使用角色表（`lib/roles.js`）派生的免费优先顺序，忽略自定义顺序；`false` 时全部使用自定义顺序 |
| `languageRouting` | `true` | 检测查询语言并把 `language` 传给 Tavily/AnySearch |
| `officialDocsEnabled` | `true` | 免费结果未命中已知官方域时，额外跑一次受限 Tavily 搜索 |
| `newsFreshnessEnabled` | `true` | 非 AI 新闻查询的免费结果 7 天内带日期来源不足 3 条时，额外跑一次 Tavily news 搜索 |
| `aihotEnabled` | `true` | 启用 AIHOT AI 新闻源 |
| `chineseSearchOrder` | `zhihu,keenable,anysearch,exa,bing,tavily,firecrawl` | fast 模式下未命中 intent 路由的含汉字查询的搜索顺序 |
| `defaultSearchOrder` | `keenable,anysearch,exa,bing,tavily,firecrawl` | fast 模式下未命中 intent 路由的其他查询的搜索顺序 |
| `fetchOrder` | `keenable,http,anysearch,exa,tavily,firecrawl` | fast 抓取回退顺序 |
| `cleanFetchOrder` | `keenable,anysearch,exa,http,tavily,firecrawl` | clean 抓取顺序 |
| `tavilyIncludeAnswer` | `true` | 把 Tavily 答案映射到 `web_search.content` |
| `zhihuIncludeMetadata` | `true` | 知乎 summary 加入作者/赞同/评论 |

## 后端与凭据

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
| `bingEnabled` | `true` | 启用免 Key 的 Bing 兜底搜索地板 |
| `bingBaseURL` | `https://www.bing.com` | Bing SERP 地址 |
| `bingMarket` | `` | 非空时才发送 `mkt`；留空用 Bing 自行本地化 |
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

## 质量、限制与缓存

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
| `fallbackFailureClasses` | `quota,auth,bot-wall,transient,invalid-response,unknown` | 允许回退到下一后端的失败类别：`quota`（402/429 配额限流）、`auth`（401/403 鉴权）、`bot-wall`（目标站点拦截）、`transient`（408/5xx 超时与服务端错误）、`invalid-response`（坏响应或空内容）、`unknown`（其余可恢复失败）。显式置空表示任何失败立即中止；未设置保持六类全开。该门禁作用于顺序回退链；quality 并行扇出不受影响 |
| `breakerFailureThreshold` | `3` | 连续失败多少次后冷却 |
| `breakerCooldownMs` | `300000` | 后端冷却时长 |

所有 `*BaseURL` 字段（包括 `anysearchBaseURL`、`tavilyBaseURL`、`firecrawlBaseURL`）都在上面的表格中，可在设置页或 profile patch 中覆盖。
