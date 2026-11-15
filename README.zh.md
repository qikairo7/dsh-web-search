# @qikairo7/dsh-web-search

[English](README.md) | 中文

DeepSeek Harness（DSH）的自包含多后端网页搜索与抓取 Provider 插件。它替换官方收费的网页 Provider，但保留第一方 `dsh-tool-web` 工具层。模型仍然调用 `web_search` 和 `web_fetch`，只是后端换了；另有可选的 AnySearch / Tavily / AIHOT 高级工具。插件不调用 DeepSeek Search/Fetch API。

非目标：不接入官方收费 Search/Fetch API，不依赖 MCP，不安装第三方 DSH 插件。

> 状态：1.0 之前。行为、默认值和后端支持可能在次版本之间变化。使用前请阅读 [SAFETY.zh.md](SAFETY.zh.md)。

## 为什么做

旧的 `deepseek-official` 搜索每次都要跑一整轮模型。DeepSeek Search / Fetch API 按成功请求收费。本插件优先使用免费额度和直连 HTTP：

| 后端 | 免费额度 | 用途 |
|---|---|---|
| Keenable | 100,000 次/月（Key）；匿名 1,000 次/小时 | 默认搜索 + 干净 Markdown 抓取 |
| AnySearch | 注册后 1000 次搜索/天；匿名也可用 | 搜索 |
| Exa | 每月 10 美元免费额度（docs.exa.ai）+ 一次性 10 美元注册奖励 | 语义搜索 + Contents 抓取；免费深度回退 |
| 知乎 | 全网 5000 次/天 + 站内 5000 次/天 | 中文搜索 |
| Tavily | 1000 credits/月 | 仅兜底：免费源空结果、缺官方文档、新闻时效不足、Fetch 失败链 |
| Firecrawl | 1000 credits/月 | Fetch 最后兜底：难抓的 JS/PDF 页面 |
| AIHOT | 匿名只读 | AI 新闻搜索/精选（免费） |
| 直连 HTTP | 无 API 成本 | 静态页面抓取 |
| SiliconFlow | 免费额度 | BGE 重排 + embeddings |

`quality` 默认只查免费源（中文：知乎 + Keenable + AnySearch；英文：Keenable + AnySearch；AI 新闻先查 AIHOT）。Exa 的每月免费额度使它成为免费栈之后的免费深度回退；Tavily / Firecrawl 是付费尾，只在免费源空结果、缺官方文档、新闻时效不足或 Fetch 失败时消耗。证据增强最多抓取前 5 个页面，优先走 Keenable、直连 HTTP 与 AnySearch；仍失败才回退 Exa/Tavily/Firecrawl。`fast` 模式同样先走免费顺序。

**为什么选它，而不是别的：**

- 对比 DeepSeek Search API：免费而非按次计费，公开基准上检索质量明显更好（FRAMES 证据召回 0.60 对 0.06、Answer Hit 0.50 对 0.40）；代价是延迟（约 4 秒对 0.4 秒），在 agent 异步工作流里无感。
- 对比单独对接一个后端（AnySearch、Keenable 等都有自家 DSH 插件）：单后端只有一份配额、一个单点故障。本插件把八份免费额度汇成一个池，自动故障切换，再对结果做合并、去重、BGE 重排与证据增强——模型只调用一个工具，不需要关心后端是谁。
- 代价也如实说：比裸付费 API 慢；社区维护而非厂商 SLA。

## 环境要求

- DeepSeek Harness `0.2.2-rc.3`（本插件实测版本）。
- Node.js `22.19+` 或 `24+`。
- 已挂载 `dsh-web` 的 profile；bundle patch 会启用第一方 `dsh-tool-web`。

## 安装

从代码检出安装：

```sh
git clone https://github.com/qikairo7/dsh-web-search.git
cd dsh-web-search
dsh plugin --profile desktop add "."
```

也可以用 Plugin Manager 安装该目录。安装后重启 DSH。

安装后打开 **Plugins → 已安装插件 → dsh-web-search → 配置**，填写各后端 API Key、启用或停用后端、设置搜索与抓取模式。Key 写入 DSH 凭据库，页面不会回显原值。

本插件仅从本仓库分发，不发布到 npm。

## 凭据

插件通过 DSH 凭据服务读取 API Key。把 Key 放进 `~/.dsh/.credentials.yaml`（或启动环境变量）：

```yaml
ANYSEARCH_API_KEY: "as_..."
KEENABLE_API_KEY: "keen_..."
EXA_API_KEY: "..."
TAVILY_API_KEY: "tvly-..."
FIRECRAWL_API_KEY: "fc-..."
ZHIHU_API_KEY: "..."
SILICONFLOW_API_KEY: "sk-..."
```

AnySearch 可以匿名使用；注册 Key 后额度更高。Keenable 没有 Key 也能匿名使用，配置 Key 后额度更高。Exa 需要 Key。知乎需要开放平台的 Access Secret。Tavily 和 Firecrawl 没有 Key 时会报告未就绪，自动路由会跳过它们。引用名可以通过 `*ApiKeyEnv` 字段修改。

## Provider

| Provider id | 搜索 | 抓取 | 默认角色 |
|---|---|---|---|
| `anysearch` | 是 | 是 | 英文/默认搜索补充；覆盖面广 |
| `keenable` | 是 | 是 | 免费额度首选；搜索 + 干净 Markdown 抓取 |
| `exa` | 是 | 是 | 语义搜索 + Contents 抓取；免费栈之后的免费深度回退 |
| `tavily` | 是 | 是 | 搜索兜底；新闻时效/官方文档补充；可选生成答案；PDF Extract |
| `firecrawl` | 是 | 是 | 仅 Fetch 最后兜底；SPA/PDF 抓取最强 |
| `zhihu` | 是 | 否 | 中文搜索首选；全网 + 站内补充 |
| `zhihu-site` | 是 | 否 | 单独选择时只搜知乎站内 |
| `aihot` | 是 | 否 | AI 新闻查询的精选源；匿名 |
| `http` | 否 | 是 | 直连 HTTP 抓取；fast 顺序中位于 Keenable 之后 |
| `auto` | 是 | 是 | 默认自动路由 |

默认顺序：

- 中文查询（包含任意汉字）：`zhihu → keenable → anysearch → exa → tavily → firecrawl`
- 其他查询：`keenable → anysearch → exa → tavily → firecrawl`
- 抓取：`keenable → http → anysearch → exa → tavily → firecrawl`

bundle patch 默认固定使用 `auto`；独立 Provider 也会注册，可以在「网页搜索与抓取」设置页里单独选择。

`searchMode` 默认是 **quality**：中文查询查知乎 + Keenable + AnySearch，英文查询查 Keenable + AnySearch，AI 新闻查询先查 AIHOT 再查该语言组合；按 URL 去重后重排。Exa 占免费深度位，不进入默认 quality 并发；Tavily / Firecrawl 只做付费兜底。设为 `fast` 则使用上面的单后端优先顺序。`fetchMode` 默认是 **fast**（直连 HTTP 优先）；设为 **clean** 会按 `keenable → anysearch → exa → http → tavily → firecrawl` 的顺序，优先免费抽取，Tavily/Firecrawl 只做兜底。`tool-web` 的摘要上限由 profile 的 agent preset 决定（DSH 标准 preset 默认 **800**，bundle patch 不能覆盖 preset 内的 `tool-web` 行；提高上限的 profile 级修法见[操作指南](docs/cookbook/raising-summary-cap.md)）；Provider 的 `maxSnippetChars` 默认是 4000，但进入 `web_search` 工具后仍按该上限截断。Tavily 搜索启用 `include_raw_content`；可选的 `tavily_search` 工具支持 `include_published_date`。

### 高级工具

| 工具 | 用途 |
|---|---|
| `anysearch_capabilities` | 查看 AnySearch 当前领域、垂直 tag 与参数定义 |
| `anysearch_search` | 用 `tag` / `params` / `zone` 做垂直或结构化搜索 |
| `anysearch_batch_search` | 一次并发执行 1–5 个独立搜索 |
| `tavily_search` | Tavily 高级搜索：depth/topic/time range/域名过滤/答案 |
| `tavily_extract` | 1–20 个 URL 的 Tavily 批量正文提取 |
| `aihot_latest` | AIHOT 今日/近一周精选 AI 新闻，匿名免费 |
| `aihot_hot` | AIHOT 当前热点，匿名免费 |

`anysearchMaxRenderedContentChars` 控制 `anysearch_search` / `anysearch_batch_search` 单次向模型展示的正文总量，默认 12000 字。

## 行为

### 路由

- **中文判定**：查询中出现任意汉字就使用中文顺序。
- **知乎补充**：中文查询先调 `global_search`；结果少于 `maxResults` 时再调 `zhihu_search`，按 URL 去重合并。英文查询不调站内接口。
- **意图路由**：本地规则把查询分成 `technical`、`news`、`chinese-community`、`general`，再决定后端组合和 fast 模式顺序。
- **语言路由**：项目只做中文和英文；含汉字为 `zh`，否则为 `en`，把 `language` 传给 Tavily/AnySearch；显式 `lang:` 优先。
- **新闻模式**：`news` 意图启用 Tavily `topic: news` + `time_range: week`、Firecrawl 新闻源 + `qdr:w`、知乎实时索引；AI 新闻查询用 AIHOT；已知中英文新闻域名获得额外排序加权，错语言的新闻源会被过滤，AIHOT 条目额外加权。非 AI 新闻查询的免费结果 7 天内带日期来源不足 3 条时，额外跑一次 Tavily news 搜索（`newsFreshnessEnabled`，默认开启）。
- **查询语法**：解析 `site:`、`lang:`、`after:`、`before:`，在 Tavily、Firecrawl、知乎支持的情况下转成对应过滤参数。

### 质量管线

- **质量搜索**：`searchMode: quality` 并行查询该语言的免费源（中文知乎 + Keenable + AnySearch；英文 Keenable + AnySearch；AI 新闻 AIHOT + 该语言组合），按 URL 去重，用 `BAAI/bge-m3` embeddings 去掉近似重复内容，再用 `BAAI/bge-reranker-v2-m3` 重排，并叠加域名权威加权（官方 docs、MDN、GitHub、StackOverflow 优先）。AnySearch 的正文会压缩成 800 到 1500 字的查询相关摘要。重排或 embedding 不可用时，回退到合并后的 Provider 顺序。
- **实时天气/汇率**：查询命中天气或汇率意图时，先调用 Open-Meteo（天气）或 ExchangeRate-API/Frankfurter（汇率），返回带数值和更新时间的单一来源；接口失败再回退普通搜索。无需 API Key。
- **证据增强**：前 5 条结果会走默认 Fetch 顺序取正文，并重新生成 800 到 1500 字摘要；技术/官方文档优先保留 API、参数、示例和代码块。
- **官方文档补充**：技术查询命中已知官方域名（`deepseek-harness.github.io`、`api-docs.deepseek.com`、`nodejs.org`、`developer.mozilla.org`、`react.dev`、`docs.python.org`、`go.dev`、`rust-lang.org`，以及 Docker、Kubernetes、AWS、Azure、GitHub、TypeScript、Java、NVIDIA 等已知厂商域名）时，只有免费结果未命中任何官方域，才额外跑一次限定域名的 Tavily 搜索，过滤 Node.js `/download/release/` 旧版本文档和旧 release blog 后合并结果。
- **Tavily 答案**：`tavilyIncludeAnswer` 默认开启，Tavily 的生成答案会作为 `web_search` 的可选 `content`。关闭后只返回来源。
- **知乎元数据**：`zhihuIncludeMetadata` 默认开启，summary 以 `作者：…；赞同 …；评论 …` 开头，给模型一个质量信号。

### 抓取与回退

- **直连 HTTP**：匿名抓取，最多 5 跳重定向（允许跨域），5 MB 响应上限，只接受 HTML/text/JSON/XML。PDF 和二进制会抛 `WEB_UNSUPPORTED_CONTENT_TYPE`，由路由回退到 API 抓取。小型 SPA 空壳由 `minDirectHtmlChars`（默认 2048）识别并触发回退。
- **回退边界**：只对可恢复错误回退：网络错误、超时、429、5xx、缺少凭据。用户取消和无效 URL 立即返回。直连 HTTP 的 404 是结果，不触发回退。
- **干净抓取**：`fetchMode: clean` 把顺序改为 `keenable → anysearch → exa → http → tavily → firecrawl`，优先免费抽取，Tavily/Firecrawl 只做兜底。
- **正文清洗**：API 抓取结果会去掉常见的导航、登录、页脚、面包屑、仓库导航和头像行，再返回 Markdown。
- **不限制内网**：直连 HTTP 可以访问回环地址和私有网段，与官方 `dsh-web-fetch-http` 行为一致。

### 缓存与熔断

搜索结果缓存 5 分钟 / 200 条，抓取缓存 10 分钟 / 100 条；某后端连续 3 次可恢复失败后冷却 5 分钟。

- **总时限**：一次搜索（实时应答、质量流水线或快速回退）以 3 × `requestTimeoutMs` 为上限，挂起的阶段不会超出调用方的工具超时。

## 配置

配置字段、默认值和说明见 [配置参考](docs/configuration.md)。

## 开发

```sh
pnpm install
git config core.hooksPath .githooks
pnpm docs:check
pnpm check
pnpm probe
pnpm benchmark
```

`pnpm check` 运行 guardrail 测试和文档检查；pre-commit hook 运行同一命令。`pnpm probe` 是日常实测探针：14 条固定查询 + 2 个抓取，带分后端遥测、清单健康信号、滚动 7 天聚合与 PASS/FAIL 判定（见[测试策略](docs/testing.md)）。`pnpm benchmark` 优先读已提交的 FRAMES/WebWalkerQA fixture，读取失败才回退到公开 rows API；`SAMPLE_SIZE` 控制每个基准的行数（默认 50）。基准数据变化时运行 `pnpm benchmark:refresh` 刷新。真实 API 验收需要上面的凭据。

## 社区与支持

- Bug 和功能请求请提交到 [GitHub Issues](https://github.com/qikairo7/dsh-web-search/issues)。
- 开 PR 前先读 [CONTRIBUTING.zh.md](CONTRIBUTING.zh.md)。
- 安全漏洞按 [SECURITY.zh.md](SECURITY.zh.md) 私下报告。

## 文档

- [架构](docs/architecture.md)
- [开发指南](docs/development.md)
- [测试策略](docs/testing.md)
- [新增 Provider](docs/cookbook/adding-a-provider.md)
- [架构决策](docs/adr/)
- [文档标准](docs/AGENTS.md)
- [贡献指南](CONTRIBUTING.zh.md)
- [版本日志](CHANGELOG.md)
- [基准规则](BENCHMARK.md)
- [基准报告](docs/benchmarks/)
- [项目术语](GLOSSARY.md)

## 许可证

MIT。第三方代码、依赖和基准数据见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；名称与兼容性说明见 [TRADEMARKS.zh.md](TRADEMARKS.zh.md)。
