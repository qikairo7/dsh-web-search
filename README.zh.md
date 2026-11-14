# @qikairo7/dsh-web-search

DeepSeek Harness（DSH）的自包含多后端网页搜索与抓取 Provider 插件。

它替换官方收费的网页 Provider，但保留第一方的 `dsh-tool-web` 工具层。模型仍然调用
`web_search` 和 `web_fetch`，只是后端换了。

## 项目初衷

1. **代替收费的官方接口**：插件不调用 DeepSeek Search / Fetch API，而是用免费额度后端
   提供 `web_search` / `web_fetch` 能力。
2. **给开发者开发项目使用**：面向需要获取最新信息、做多源搜索和可靠网页提取的开发者。
3. **免费额度够日常使用**：AnySearch、知乎、Tavily、Firecrawl、AIHOT、直连 HTTP 和
   SiliconFlow 免费额度覆盖正常开发使用。

非目标：不接入官方收费 Search/Fetch API，不依赖 MCP，不安装额外第三方 DSH 插件。

## 为什么做

- 旧的 `deepseek-official` 搜索每次都要跑一整轮模型，慢且贵。
- DeepSeek Search / Fetch API 按成功请求次数收费。
- 这个插件优先使用免费额度和直连 HTTP：
  - **AnySearch**：匿名可用；注册后 1000 次/天。
  - **知乎**：全网搜索 5000 次/天，站内搜索 5000 次/天。
  - **Tavily**：免费 1000 credits/月。
  - **Firecrawl**：免费 1000 credits/月，只用于难抓页面。
  - **直连 HTTP**：静态页面零 API 成本。

不需要 MCP，也不需要额外安装第三方 DSH 插件。

### 免费额度预算

| 后端 | 免费额度 | 用途 |
|---|---|---|
| AnySearch | 注册后 1000 次搜索/天；匿名也可用 | 搜索 |
| 知乎 | 全网 5000 次/天 + 站内 5000 次/天 | 中文搜索 |
| Tavily | 1000 credits/月 | 搜索、官方文档补充、clean 抓取 |
| Firecrawl | 1000 credits/月 | 难抓页面回退 |
| AIHOT | 匿名只读 | AI 新闻搜索 |
| 直连 HTTP | 无 API 成本 | 静态页面抓取 |
| SiliconFlow | 免费额度 | BGE 重排 + embeddings |

`quality` 模式选中 Tavily 时每次搜索查询消耗 1 credit，1000 credits 约等于 33 次/天（按一个月
计算）。证据页增强优先走直连 HTTP；只有无法直连的页面才回退到 Tavily/Firecrawl，可能
额外消耗 credit。`fast` 模式通常先用知乎/AnySearch，把 Tavily 留给更难查询。5 分钟搜索
缓存会减少重复消耗。

## 环境要求

- DeepSeek Harness `0.2.2-rc.3`（本插件实测版本）。
- Node.js `22.19+` 或 `24+`。
- 已挂载 `dsh-web` 的 profile；bundle patch 会启用第一方 `dsh-tool-web`。

## 安装

从当前目录安装：

```sh
dsh plugin --profile desktop add "D:\\网页搜索和提取"
```

也可以用 Plugin Manager 安装本地目录。安装后重启 DSH。

## 凭据

插件通过 DSH 凭据服务读取 API Key。把 Key 放进
`~/.dsh/.credentials.yaml`（或启动环境变量）：

```yaml
ANYSEARCH_API_KEY: "as_..."
TAVILY_API_KEY: "tvly-..."
FIRECRAWL_API_KEY: "fc-..."
ZHIHU_API_KEY: "..."
SILICONFLOW_API_KEY: "sk-..."
```

AnySearch 可以匿名使用；注册 Key 后额度更高。知乎需要开放平台的 Access Secret。
Tavily 和 Firecrawl 没有 Key 时会报告未就绪，自动路由会跳过它们。

引用名可以通过 `*ApiKeyEnv` 字段修改。

## Provider

| Provider id | 搜索 | 抓取 | 默认角色 |
|---|---|---|---|
| `anysearch` | 是 | 是 | 英文/默认搜索首选；覆盖面广 |
| `tavily` | 是 | 是 | 搜索第二选择；可选生成答案；PDF Extract |
| `firecrawl` | 是 | 是 | 搜索最后选择；SPA/PDF 抓取最强 |
| `zhihu` | 是 | 否 | 中文搜索首选；全网 + 站内补充 |
| `zhihu-site` | 是 | 否 | 单独选择时只搜知乎站内 |
| `aihot` | 是 | 否 | AI 新闻查询的精选源；匿名 |
| `http` | 否 | 是 | 抓取首选：直连 HTTP |
| `auto` | 是 | 是 | 默认自动路由 |

默认顺序：

- 中文查询（包含任意汉字）：
  `zhihu → anysearch → tavily → firecrawl`
- 其他查询：
  `anysearch → tavily → zhihu → firecrawl`
- 抓取：
  `http → tavily → firecrawl → anysearch`

bundle patch 默认固定使用 `auto`；独立 Provider 也会注册，可以在“网页搜索与抓取”
设置页里单独选择。

`searchMode` 默认是 **quality**：中文查询同时查知乎 + AnySearch + Tavily，英文查询同时查
AnySearch + Tavily + 知乎，AI 新闻查询用 AIHOT + Tavily + AnySearch；按 URL 去重后重排。
设为 `fast` 则使用上面的单后端优先顺序。`fetchMode` 默认是 **fast**（直连 HTTP 优先）；
设为 **clean** 会优先 Tavily/Firecrawl 的干净 Markdown。bundle patch 把
`tool-web.searchSummaryMaxChars` 设为 **4000**（原生默认 800），Provider 的
`maxSnippetChars` 也设为 4000；Tavily 搜索启用 `include_raw_content`，用正文而不是短
snippet 生成摘要。

## 行为细节

- **中文判定**：查询中出现任意汉字就使用中文顺序。
- **知乎补充**：中文查询先调 `global_search`；结果少于 `maxResults` 时再调
  `zhihu_search`，按 URL 去重合并。英文查询不调站内接口。
- **Tavily 答案**：`tavilyIncludeAnswer` 默认开启，Tavily 的生成答案会作为
  `web_search` 的可选 `content`。关闭后只返回来源。
- **知乎元数据**：`zhihuIncludeMetadata` 默认开启，summary 以
  `作者：…；赞同 …；评论 …` 开头，给模型一个质量信号。
- **直连 HTTP**：匿名抓取，最多 5 跳重定向（允许跨域），5 MB 响应上限，只接受
  HTML/text/JSON/XML。PDF 和二进制会抛 `WEB_UNSUPPORTED_CONTENT_TYPE`，由路由回退到
  API 抓取。小型 SPA 空壳由 `minDirectHtmlChars`（默认 2048）识别并触发回退。
- **回退边界**：只对可恢复错误回退：网络错误、超时、429、5xx、缺少凭据。用户取消和
  无效 URL 立即返回。直连 HTTP 的 404 是结果，不触发回退。
- **质量搜索**：`searchMode: quality` 并行查询三家后端，按 URL 去重，用 `BAAI/bge-m3`
  embeddings 去掉近似重复内容，再用 `BAAI/bge-reranker-v2-m3` 重排，并叠加域名权威加权
  （官方 docs、MDN、GitHub、StackOverflow 优先）；AnySearch 的正文会压缩成 800–1500 字的
  查询相关摘要；Top 5 结果会走直连优先的 Fetch 取正文并重新生成 800–1500 字摘要，技术/
  官方文档优先保留 API、参数、示例和代码块；重排或 embedding 不可用时回退到合并后的
  Provider 顺序。
- **意图路由**：本地规则把查询分成 `technical`、`news`、`chinese-community`、`general`，
  再决定后端组合和 fast 模式顺序。
- **缓存与熔断**：搜索结果缓存 5 分钟 / 200 条，抓取缓存 10 分钟 / 100 条；某后端
  连续 3 次可恢复失败后冷却 5 分钟。
- **查询语法**：解析 `site:`、`lang:`、`after:`、`before:`，在 Tavily、Firecrawl、知乎
  支持的情况下转成对应过滤参数。
- **官方文档补充**：技术查询命中已知官方域名（`deepseek-harness.github.io`、
  `api-docs.deepseek.com`、`nodejs.org`、`developer.mozilla.org`、`react.dev`、
  `docs.python.org`、`go.dev`、`rust-lang.org`，以及 Docker、Kubernetes、AWS、Azure、
  GitHub、TypeScript、Java、NVIDIA 等 `docs.*` / `developer.*` 域名）时，quality 模式额外
  跑一次限定域名的 Tavily 搜索，过滤 Node.js `/download/release/` 旧版本文档和旧
  release blog 后合并结果。
- **语言路由**：项目只做中文和英文；含汉字为 `zh`，否则为 `en`，把 `language` 传给
  Tavily/AnySearch；显式 `lang:` 优先。
- **新闻模式**：`news` 意图启用 Tavily `topic: news` + `time_range: week`、Firecrawl
  新闻源 + `qdr:w`、知乎实时索引；AI 新闻查询用 AIHOT；已知中英文新闻域名获得额外排序加权，错语言的新闻源会被过滤，AIHOT 条目额外加权。
- **正文清洗**：API 抓取结果会去掉常见的导航、登录、页脚、面包屑、仓库导航和头像行，再返回 Markdown。
- **干净抓取**：`fetchMode: clean` 把顺序改为 `tavily → firecrawl → http → anysearch`，
  用 API credits 换更干净的 Markdown。
- **不限制内网**：直连 HTTP 可以访问 loopback 和私有网段，与官方
  `dsh-web-fetch-http` 行为一致。

## 配置

设置页由插件的 `Config` schema 自动生成。所有字段可选，默认值如下：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `searchMode` | `quality` | `quality` = 三源合并 + 重排 + Top 5 证据增强；`fast` = 单后端优先顺序 |
| `fetchMode` | `fast` | `fast` = 直连 HTTP 优先；`clean` = Tavily/Firecrawl 优先 |
| `intentRouting` | `true` | 启用 technical / news / 中文社区路由规则 |
| `languageRouting` | `true` | 检测查询语言并把 `language` 传给 Tavily/AnySearch |
| `officialDocsEnabled` | `true` | 对已知官方文档域名额外跑一次受限 Tavily 搜索 |
| `aihotEnabled` | `true` | 启用 AIHOT AI 新闻源 |
| `aihotBaseURL` | `https://aihot.news` | AIHOT API 地址 |
| `chineseSearchOrder` | `zhihu,anysearch,tavily,firecrawl` | fast 模式下含汉字查询的搜索顺序 |
| `defaultSearchOrder` | `anysearch,tavily,zhihu,firecrawl` | fast 模式下其他查询的搜索顺序 |
| `fetchOrder` | `http,tavily,firecrawl,anysearch` | fast 抓取回退顺序 |
| `cleanFetchOrder` | `tavily,firecrawl,http,anysearch` | clean 抓取顺序 |
| `anysearchEnabled` | `true` | 启用 AnySearch |
| `anysearchApiKeyEnv` | `ANYSEARCH_API_KEY` | AnySearch 凭据引用 |
| `anysearchBaseURL` | `https://api.anysearch.com` | AnySearch API 地址 |
| `tavilyEnabled` | `true` | 启用 Tavily |
| `tavilyApiKeyEnv` | `TAVILY_API_KEY` | Tavily 凭据引用 |
| `tavilyBaseURL` | `https://api.tavily.com` | Tavily API 地址 |
| `tavilyIncludeAnswer` | `true` | 把 Tavily 答案映射到 `web_search.content` |
| `firecrawlEnabled` | `true` | 启用 Firecrawl |
| `firecrawlApiKeyEnv` | `FIRECRAWL_API_KEY` | Firecrawl 凭据引用 |
| `firecrawlBaseURL` | `https://api.firecrawl.dev` | Firecrawl API 地址 |
| `zhihuEnabled` | `true` | 启用知乎 Provider |
| `zhihuApiKeyEnv` | `ZHIHU_API_KEY` | 知乎 Access Secret 引用 |
| `zhihuBaseURL` | `https://developer.zhihu.com` | 知乎 API 地址 |
| `zhihuIncludeMetadata` | `true` | 知乎 summary 加入作者/赞同/评论 |
| `httpEnabled` | `true` | 启用直连 HTTP 抓取 |
| `siliconflowEnabled` | `true` | 启用 SiliconFlow 重排 |
| `siliconflowApiKeyEnv` | `SILICONFLOW_API_KEY` | SiliconFlow 凭据引用 |
| `siliconflowBaseURL` | `https://api.siliconflow.cn/v1` | SiliconFlow API 地址 |
| `siliconflowRerankModel` | `BAAI/bge-reranker-v2-m3` | 重排模型 |
| `siliconflowEmbeddingsEnabled` | `true` | 启用语义去重 |
| `siliconflowEmbeddingModel` | `BAAI/bge-m3` | Embedding 模型 |
| `semanticDedupThreshold` | `0.95` | 语义重复的余弦阈值 |
| `requestTimeoutMs` | `30000` | 单次请求超时 |
| `maxFetchChars` | `200000` | `web_fetch` 最大字符数 |
| `maxSnippetChars` | `4000` | 每条搜索 summary 最大字符数 |
| `enrichEnabled` | `true` | 抓取 Top 结果正文并重生成摘要 |
| `enrichTopN` | `5` | 参与增强的 Top 结果数 |
| `enrichSummaryMinChars` | `800` | 增强摘要最小字符数 |
| `enrichSummaryMaxChars` | `1500` | 增强摘要最大字符数 |
| `minDirectHtmlChars` | `2048` | SPA 空壳判定阈值 |
| `searchCacheTtlMs` | `300000` | 搜索缓存 TTL |
| `searchCacheMaxEntries` | `200` | 搜索缓存条数上限 |
| `fetchCacheTtlMs` | `600000` | 抓取缓存 TTL |
| `fetchCacheMaxEntries` | `100` | 抓取缓存条数上限 |
| `breakerFailureThreshold` | `3` | 连续失败多少次后冷却 |
| `breakerCooldownMs` | `300000` | 后端冷却时长 |

高级部署可以在 profile patch 里覆盖 `anysearchBaseURL`、`tavilyBaseURL`、
`firecrawlBaseURL`，这些地址不放进常规设置页。

## 开发

```sh
pnpm install
git config core.hooksPath .githooks
pnpm check
pnpm benchmark
```

`pnpm check` 运行 guardrail 测试；pre-commit hook 运行同一命令。`pnpm benchmark`
优先读已提交的 FRAMES/WebWalkerQA fixture，读取失败才回退到公开 rows API。真实 API
验收需要上面的凭据。

## 许可证

MIT
