# DeepSeek API vs this plugin — 2026-11-14

Local comparison against the DeepSeek Search/Fetch API using the DSH account token. DeepSeek is not a backend of this plugin; the results are reference data for routing and roadmap decisions.

## Search

DeepSeek was called with `count: 5`; the plugin's default quality mode returned 10 results after three-provider merge and rerank.

| Query | DeepSeek Search API | Plugin quality mode |
|---|---|---|
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件开发 | 469ms; first result is the official cookbook; average summary 2128 chars; 5/5 with body content | 2221ms; 10 results; first result is a Zhihu article; summary cap 4000 in the current config (native default 800) |
| `Node.js fetch AbortSignal timeout` | 309ms; first result is a StackOverflow feed; average summary 1209 chars | 2888ms; 10 results; first result is a Node.js timeout blog; MDN and StackOverflow are also present |
| `2026年11月 AI 行业新闻` | 259ms; first result is a Sohu AI weekly; average summary 1559 chars | 1787ms; 10 results; first result is a Sohu AI daily |

## Fetch

| URL | DeepSeek Fetch API | Plugin clean fetch mode |
|---|---|---|
| `https://example.com` | 112ms; 916B clean text | 435ms; 958B clean text |
| `https://react.dev/learn` | 105ms; 12,060B Markdown | 1461ms; 17,448B Markdown |
| `https://arxiv.org/pdf/1706.03762` | 404 — failed | 439ms; 40,580B via Tavily Extract |
| `https://github.com/deepseek-ai/deepseek-harness` | 93ms; 7,706B Markdown | 429ms; 17,821B Markdown |
| `https://developer.zhihu.com/docs?key=zhihu_search` | 404 — failed | 3508ms; 4,229B via Firecrawl |

## Takeaways

- DeepSeek Search is faster and has strong official-index authority, especially for DeepSeek's own documentation and technical queries.
- The plugin wins on Chinese community coverage (Zhihu), English canonical sources (AnySearch/MDN), and fetch coverage (Tavily/Firecrawl handle PDF and SPA pages that DeepSeek Fetch rejects).
- Quality mode trades latency for broader source coverage and reranking; fast mode keeps the lower-latency single-provider path.
- The plugin does not include the DeepSeek Search/Fetch API as a backend by decision.
