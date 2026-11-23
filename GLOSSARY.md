# 术语表

在 issue、测试、文档和代码注释中统一使用这些术语。

| 术语 | 定义 |
|---|---|
| 后端（Backend） | 插件通过 HTTPS 调用的远程搜索或抓取服务，另含宿主直连 HTTP 抓取。共 11 个 provider：anysearch、keenable、tavily、firecrawl、zhihu、zhihu-site、aihot、exa、bing、github 和 http。 |
| 提供方（Provider） | 一种 DSH `ctx.web` 能力实现。搜索提供方实现 `search()`，抓取提供方实现 `fetch()`。提供方不是面向模型的工具。 |
| 工具层（Tool layer） | 第一方 `dsh-tool-web` 包，拥有 `web_search` 和 `web_fetch` 工具及其 schema、提示词指引、输出格式化和 Web UI 卡片。本插件复用它。 |
| 自动路由器（Auto router） | 一种运行已配置搜索或抓取策略、并在出现可恢复错误时回退的提供方。 |
| 快速模式（Fast mode） | `searchMode: fast` 或 `fetchMode: fast`。按优先级顺序使用一个搜索提供方；抓取遵循 `fetchOrder`（Keenable，然后直连 HTTP）。这是低延迟、免费优先的模式。 |
| 质量模式（Quality mode） | `searchMode: quality`。并行查询该语言的免费质量集合（中文：Zhihu + Keenable + AnySearch；英文：Keenable + AnySearch；AI 新闻先加上 AIHOT），按 URL 合并，再用 SiliconFlow `BAAI/bge-reranker-v2-m3` 重排。这是默认搜索模式。 |
| 重排（Rerank） | 质量模式的步骤：把候选的标题、摘要和 URL 发给交叉编码器模型，按相关度顺序返回候选。 |
| 语义去重（Semantic dedup） | 质量模式的步骤：用 `BAAI/bge-m3` 对候选的标题和摘要做嵌入，删除余弦相似度高于 `semanticDedupThreshold` 的候选。 |
| 权威度加权（Authority boost） | 加到重排分数上的小声望先验，使官方文档、MDN、GitHub、StackOverflow 和学术、政府页面在相关度接近时排在普通页面之前。 |
| 官方文档补充（Official docs supplement） | 针对技术查询、限定在已知官方文档域名上的额外 Tavily 搜索，合并进质量模式结果，避免官方来源被通用索引漏掉。 |
| 新闻时效补充（News freshness supplement） | 当非 AI 新闻查询返回的 7 天内来源少于 3 个时，合并进质量模式结果的额外 Tavily 新闻搜索（一次请求，在熔断器之外）。AI 新闻查询从不触发，该意图由 AIHOT 主导。 |
| 语言路由（Language routing） | 检测查询语言（`zh` 或 `en`），用作提供方的 `language` 提示；显式的 `lang:` 操作符优先。 |
| 新闻模式（News mode） | `news` 查询的路由规则：Tavily 新闻主题和时间范围、Firecrawl 新闻源、Zhihu 实时索引、按语言区分的新闻域名排序、错误语言新闻过滤，以及 AI 新闻查询使用 AIHOT。 |
| 证据增强（Evidence enrichment） | 质量模式的步骤：按默认抓取顺序抓取前 5 个结果页，并以 800–1500 字符重新生成其摘要。技术页和官方文档页优先取 API 签名、参数、示例和代码块。 |
| AIHOT | 一个匿名、只读的 AI 新闻 API，作为 AI 新闻查询的可选、仅搜索的提供方。 |
| 意图路由（Intent routing） | 本地查询分类（`technical`、`news`、`chinese-community`、`general`），用于选择提供方集合和快速模式顺序。 |
| 中文查询（Chinese query） | 至少包含一个汉字字符的搜索查询。中文查询使用 `chineseSearchOrder` 并启用 Zhihu 站点补充。 |
| Zhihu 补充（Zhihu supplement） | Zhihu 提供方的行为：中文查询返回的来源少于请求数量时，在 `global_search` 之后调用 `zhihu_search`，再按 URL 合并结果。 |
| 直连 HTTP 抓取（Direct HTTP fetch） | 一种抓取策略：从 DSH 宿主请求目标 URL，把响应体返回工具层做 HTML 转 Markdown。`fetchMode: fast` 让它排在顺序前面（Keenable 优先）；`fetchMode: clean` 把它移到 Keenable、AnySearch、Exa 之后。 |
| 查询语法（Query syntax） | 从搜索查询中解析出的、提供方中立的 `site:`、`lang:`、`after:` 和 `before:` 操作符，转发给支持相应过滤的提供方。 |
| 路由注解（Routing annotation） | 自动路由器每次搜索解析一次的路由事实：意图、解析后的语言提示、解析出的查询语法，以 `request.routing` 附加到请求。提供方读取它，在未被传入时回退到自行推导。 |
| 提供方分级（Provider tier） | 目录声明的提供方配额类别：`free`（匿名、慷慨的免费额度，或如 Exa 的每月循环额度）、`keyless`（无密钥、无计量配额，Bing 的 HTML SERP 兜底，介于免费与付费之间），或 `paid`（稀缺的每月额度，仅作回退）。默认顺序和质量配对据此推导 keyless 兜底与 paid 尾部。 |
| 凭据引用（Credentials reference） | 形如 `TAVILY_API_KEY` 的环境变量名，插件通过 DSH 凭据服务解析，回退到启动环境。 |
