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
- **No private-network blocking**: direct HTTP can reach loopback and private-network hosts,
  matching the shipped `dsh-web-fetch-http` behavior.

## Configuration

The settings page is generated from the plugin's `Config` schema. All fields are
optional; the defaults below match the verified setup.

| Field | Default | Meaning |
|---|---|---|
| `chineseSearchOrder` | `zhihu,anysearch,tavily,firecrawl` | Search order for queries with Han characters |
| `defaultSearchOrder` | `anysearch,tavily,zhihu,firecrawl` | Search order for other queries |
| `fetchOrder` | `http,tavily,firecrawl,anysearch` | Fetch fallback order |
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
| `requestTimeoutMs` | `60000` | Per-request timeout |
| `maxFetchChars` | `200000` | Maximum characters returned by `web_fetch` |
| `maxSnippetChars` | `800` | Maximum characters per search summary |
| `minDirectHtmlChars` | `2048` | SPA-shell detection threshold |

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
