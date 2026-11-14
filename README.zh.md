# @qikairo7/dsh-web-search

DeepSeek Harness（DSH）的自包含多后端网页搜索与抓取 Provider 插件。

它替换官方收费的网页 Provider，但保留第一方的 `dsh-tool-web` 工具层。模型仍然调用
`web_search` 和 `web_fetch`，只是后端换了。

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
- **不限制内网**：直连 HTTP 可以访问 loopback 和私有网段，与官方
  `dsh-web-fetch-http` 行为一致。

## 配置

设置页由插件的 `Config` schema 自动生成。所有字段可选，默认值如下：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `chineseSearchOrder` | `zhihu,anysearch,tavily,firecrawl` | 含汉字查询的搜索顺序 |
| `defaultSearchOrder` | `anysearch,tavily,zhihu,firecrawl` | 其他查询的搜索顺序 |
| `fetchOrder` | `http,tavily,firecrawl,anysearch` | 抓取回退顺序 |
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
| `requestTimeoutMs` | `60000` | 单次请求超时 |
| `maxFetchChars` | `200000` | `web_fetch` 最大字符数 |
| `maxSnippetChars` | `800` | 每条搜索 summary 最大字符数 |
| `minDirectHtmlChars` | `2048` | SPA 空壳判定阈值 |

高级部署可以在 profile patch 里覆盖 `anysearchBaseURL`、`tavilyBaseURL`、
`firecrawlBaseURL`，这些地址不放进常规设置页。

## 开发

```sh
pnpm install
node --test
node --check lib/index.js
```

单元测试覆盖响应映射、知乎中文补充、auto 路由和直连 HTTP 行为。真实 API 验收需要
上面四个凭据。

## 许可证

MIT
