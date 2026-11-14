# @qikairo7/dsh-web-search

Self-contained multi-backend web search and fetch providers for DeepSeek Harness (DSH).

This bundle replaces the paid official web providers while keeping the first-party
`dsh-tool-web` tool layer. The model still calls `web_search` and `web_fetch`; only the
backends change.

## Why

- The legacy `deepseek-official` search runs a full model turn for every search.
- The DeepSeek Search and Fetch APIs charge per successful request.
- This bundle uses the free quotas and direct HTTP where possible:
  - **AnySearch** — anonymous access, or 1000 searches/day with a registered key.
  - **Zhihu** — 5000 global searches/day and 5000 site searches/day.
  - **Tavily** — 1000 credits/month on the free plan.
  - **Firecrawl** — 1000 credits/month on the free plan, reserved for hard pages.
  - **Direct HTTP** — no API cost for static pages.

No MCP server and no third-party DSH plugin is required.

## Requirements

- DeepSeek Harness `0.2.2-rc.3` (the version this bundle was verified against).
- Node.js `22.19+` or `24+`.
- A profile that mounts `dsh-web`; the bundle patch enables the first-party `dsh-tool-web` row.

## Install

From this checkout:

```sh
dsh plugin --profile desktop add "D:\\网页搜索和提取"
```

Or install the local package directory with the Plugin Manager. Restart DSH after installing.

## Credentials

The plugin reads API keys through the DSH credentials service. Put them in
`~/.dsh/.credentials.yaml` (or export them in the launching environment):

```yaml
ANYSEARCH_API_KEY: "as_..."
TAVILY_API_KEY: "tvly-..."
FIRECRAWL_API_KEY: "fc-..."
ZHIHU_API_KEY: "..."
SILICONFLOW_API_KEY: "sk-..."
```

AnySearch works without a key in anonymous mode; a registered key raises the daily quota.
Zhihu requires an Access Secret from the Zhihu Open Platform. Tavily and Firecrawl providers
report themselves not ready when their key is missing, so the router skips them.

The exact reference names are configurable with the `*ApiKeyEnv` fields.

## Providers

| Provider id | Search | Fetch | Default role |
|---|---|---|---|
| `anysearch` | yes | yes | English/default search first; broad coverage |
| `tavily` | yes | yes | Second search choice; optional generated answer; PDF Extract |
| `firecrawl` | yes | yes | Last search choice; strong Scrape for SPA/PDF |
| `zhihu` | yes | no | Chinese search first; global search + site supplement |
| `zhihu-site` | yes | no | Zhihu site-only search when selected explicitly |
| `aihot` | yes | no | Curated AI news for AI-news queries; anonymous |
| `http` | no | yes | Direct HTTP fetch first |
| `auto` | yes | yes | Default router for both capabilities |

Default orders:

- Chinese query (contains at least one Han character):
  `zhihu → anysearch → tavily → firecrawl`
- Other query:
  `anysearch → tavily → zhihu → firecrawl`
- Fetch:
  `http → tavily → firecrawl → anysearch`

The default `auto` provider is pinned by the bundle patch. Individual providers are also
registered so they can be selected directly in the Web search and fetch settings page.

`searchMode` defaults to **quality**: the router queries three providers (Chinese: Zhihu +
AnySearch + Tavily; English: AnySearch + Tavily + Zhihu), merges and deduplicates by URL,
then reranks with SiliconFlow `BAAI/bge-reranker-v2-m3`. AI-news queries use AIHOT + Tavily +
AnySearch. Set `searchMode: fast` for the single-provider priority order above. `fetchMode`
defaults to **fast** (direct HTTP first); set it to **clean** to prefer Tavily/Firecrawl
Markdown extraction. The bundle patch sets `tool-web.searchSummaryMaxChars` to **4000**
(the native default is 800) and the provider `maxSnippetChars` to 4000; Tavily search uses
`include_raw_content` so summaries can use the page body instead of a short snippet.

## Behavior details

- **Chinese detection**: any Han script character in the query selects the Chinese order.
- **Zhihu supplement**: for a Chinese query, `zhihu` calls `global_search` first. If it
  returns fewer than `maxResults` sources, it calls `zhihu_search` and merges the results
  by URL. English queries do not call the site endpoint.
- **Tavily answer**: when `tavilyIncludeAnswer` is on (default), Tavily's generated answer
  becomes the optional `web_search` `content`. Turn it off to return sources only.
- **Zhihu metadata**: when `zhihuIncludeMetadata` is on (default), each summary starts with
  `作者：…；赞同 …；评论 …`, giving the model a quality signal without extending the
  provider-neutral source shape.
- **Direct HTTP**: anonymous, up to 5 redirects (cross-origin allowed), 5 MB response cap,
  HTML/text/JSON/XML only. PDFs and other binary content throw
  `WEB_UNSUPPORTED_CONTENT_TYPE` so the router falls back to an API provider. Small
  client-rendered app shells are detected by `minDirectHtmlChars` (default 2048) and also
  trigger a fallback.
- **Fallback**: only recoverable failures trigger the next provider: network errors,
  timeouts, 429, 5xx, and missing credentials. Caller cancellation and invalid URLs return
  immediately. A 404 from direct HTTP is returned as a result, not a fallback trigger.
- **Quality search**: `searchMode: quality` queries three providers in parallel, merges by
  URL, removes near-duplicates with `BAAI/bge-m3` embeddings, then reranks with
  `BAAI/bge-reranker-v2-m3` and adds a domain-authority prior (official docs, MDN, GitHub,
  StackOverflow first). If the reranker or embedding service is unavailable, the merged
  provider order is returned.
- **Intent routing**: simple local rules classify a query as `technical`, `news`,
  `chinese-community`, or `general`, then choose the provider pair and fast-mode order.
- **Cache and circuit breaker**: search results are cached for 5 minutes (200 entries),
  fetch results for 10 minutes (100 entries). A provider with 3 consecutive recoverable
  failures is skipped for 5 minutes.
- **Query syntax**: `site:`, `lang:`, `after:`, and `before:` are parsed and forwarded to
  Tavily, Firecrawl, and Zhihu where their APIs support the corresponding filter.
- **Official docs supplement**: for technical queries with known official domains
  (`deepseek-harness.github.io`, `api-docs.deepseek.com`, `nodejs.org`, `developer.mozilla.org`,
  `react.dev`, `docs.python.org`, `go.dev`, `rust-lang.org`), quality mode runs one extra
  Tavily search restricted to those domains, drops archived Node.js `/download/release/`
  docs, and merges the results.
- **Language routing**: the project scope is Chinese and English only; a query with Han
  characters is `zh`, otherwise `en`, and that value is passed to Tavily/AnySearch as the
  `language` hint. An explicit `lang:` wins.
- **News mode**: `news` intent enables Tavily `topic: news` + `time_range: week`, Firecrawl
  news sources + `qdr:w`, Zhihu realtime index, and AIHOT for AI-news queries. Known
  Chinese/English news domains get a small ranking bonus.
- **Content cleaning**: API fetch providers strip common navigation, sign-in, footer and
  breadcrumb lines from Markdown before returning it.
- **Clean fetch**: `fetchMode: clean` changes the order to
  `tavily → firecrawl → http → anysearch` for cleaner Markdown at the cost of API credits.
- **No private-network blocking**: direct HTTP can reach loopback and private-network hosts,
  matching the shipped `dsh-web-fetch-http` behavior.

## Configuration

The settings page is generated from the plugin's `Config` schema. All fields are
optional; the defaults below match the verified setup.

| Field | Default | Meaning |
|---|---|---|
| `searchMode` | `quality` | `quality` = two-provider merge + rerank; `fast` = single-provider priority order |
| `fetchMode` | `fast` | `fast` = direct HTTP first; `clean` = Tavily/Firecrawl first |
| `intentRouting` | `true` | Apply technical/news/Chinese-community routing rules |
| `languageRouting` | `true` | Detect query language and pass `language` to Tavily/AnySearch |
| `officialDocsEnabled` | `true` | Add a domain-restricted Tavily search for known official docs |
| `aihotEnabled` | `true` | Enable the AIHOT AI-news provider |
| `aihotBaseURL` | `https://aihot.news` | AIHOT API base |
| `chineseSearchOrder` | `zhihu,anysearch,tavily,firecrawl` | Fast-mode search order for queries with Han characters |
| `defaultSearchOrder` | `anysearch,tavily,zhihu,firecrawl` | Fast-mode search order for other queries |
| `fetchOrder` | `http,tavily,firecrawl,anysearch` | Fast fetch fallback order |
| `cleanFetchOrder` | `tavily,firecrawl,http,anysearch` | Clean fetch order |
| `anysearchEnabled` | `true` | Enable AnySearch |
| `anysearchApiKeyEnv` | `ANYSEARCH_API_KEY` | AnySearch credential reference |
| `anysearchBaseURL` | `https://api.anysearch.com` | AnySearch API base |
| `tavilyEnabled` | `true` | Enable Tavily |
| `tavilyApiKeyEnv` | `TAVILY_API_KEY` | Tavily credential reference |
| `tavilyBaseURL` | `https://api.tavily.com` | Tavily API base |
| `tavilyIncludeAnswer` | `true` | Map Tavily's answer to `web_search.content` |
| `firecrawlEnabled` | `true` | Enable Firecrawl |
| `firecrawlApiKeyEnv` | `FIRECRAWL_API_KEY` | Firecrawl credential reference |
| `firecrawlBaseURL` | `https://api.firecrawl.dev` | Firecrawl API base |
| `zhihuEnabled` | `true` | Enable Zhihu providers |
| `zhihuApiKeyEnv` | `ZHIHU_API_KEY` | Zhihu Access Secret reference |
| `zhihuBaseURL` | `https://developer.zhihu.com` | Zhihu API base |
| `zhihuIncludeMetadata` | `true` | Add author/vote/comment to Zhihu summaries |
| `httpEnabled` | `true` | Enable the direct HTTP fetch provider |
| `siliconflowEnabled` | `true` | Enable SiliconFlow reranking |
| `siliconflowApiKeyEnv` | `SILICONFLOW_API_KEY` | SiliconFlow credential reference |
| `siliconflowBaseURL` | `https://api.siliconflow.cn/v1` | SiliconFlow API base |
| `siliconflowRerankModel` | `BAAI/bge-reranker-v2-m3` | Rerank model |
| `siliconflowEmbeddingsEnabled` | `true` | Enable semantic duplicate removal |
| `siliconflowEmbeddingModel` | `BAAI/bge-m3` | Embedding model |
| `semanticDedupThreshold` | `0.95` | Cosine similarity threshold for duplicate removal |
| `requestTimeoutMs` | `30000` | Per-request timeout |
| `maxFetchChars` | `200000` | Maximum characters returned by `web_fetch` |
| `maxSnippetChars` | `4000` | Maximum characters per search summary |
| `minDirectHtmlChars` | `2048` | SPA-shell detection threshold |
| `searchCacheTtlMs` | `300000` | Search cache TTL |
| `searchCacheMaxEntries` | `200` | Search cache entry cap |
| `fetchCacheTtlMs` | `600000` | Fetch cache TTL |
| `fetchCacheMaxEntries` | `100` | Fetch cache entry cap |
| `breakerFailureThreshold` | `3` | Consecutive failures before cooldown |
| `breakerCooldownMs` | `300000` | Provider cooldown |

Advanced deployments can also override `anysearchBaseURL`, `tavilyBaseURL`, and
`firecrawlBaseURL` in the profile patch; they are intentionally not part of the normal
settings flow.

## Development

```sh
pnpm install
node --test
node --check lib/index.js
```

The unit tests cover response mapping, the Chinese Zhihu supplement, the auto router, and
direct HTTP behavior. Live API verification requires the four credentials above.

## License

MIT
