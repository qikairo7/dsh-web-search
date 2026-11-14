# Glossary

## Backend

A remote search or fetch service that the plugin calls directly over HTTPS. The v1 backends are AnySearch, Tavily, Firecrawl, and Zhihu.

## Provider

A DSH `ctx.web` capability implementation. A search provider answers `search()`; a fetch provider answers `fetch()`. A provider is not a model-facing tool.

## Tool layer

The first-party `dsh-tool-web` package that defines the `web_search` and `web_fetch` tools, their schemas, prompt guidance, output formatting, and Web UI cards. This plugin reuses the tool layer instead of reimplementing it.

## Auto router

A provider that runs the configured search or fetch strategy and falls back when a recoverable error occurs.

## Fast mode

`searchMode: fast` or `fetchMode: fast`. Uses one search provider in priority order, or direct HTTP first for fetch. This is the low-latency, free-first mode.

## Quality mode

`searchMode: quality`. Queries three search providers in parallel, merges by URL, and reranks with SiliconFlow `BAAI/bge-reranker-v2-m3`. This is the default search mode.

## Rerank

The quality-mode step that sends candidate titles, summaries, and URLs to a cross-encoder model and returns the candidates in relevance order.

## Semantic dedup

The quality-mode step that embeds candidate titles and summaries with `BAAI/bge-m3` and removes candidates whose cosine similarity is above `semanticDedupThreshold`.

## Authority boost

A small domain prior added to a reranker score so official docs, MDN, GitHub, StackOverflow, and academic/government pages rank above generic pages when relevance is close.

## Official docs supplement

An extra Tavily search restricted to known official-document domains for technical queries, merged into quality-mode results so the official source is not missed by the general index.

## Language routing

Detection of the query language (`zh` or `en`) used as a provider `language` hint; an explicit `lang:` operator wins.

## News mode

The routing rule for `news` queries: Tavily news topic/time range, Firecrawl news sources, Zhihu realtime index, known news-domain ranking, and AIHOT for AI-news queries.

## AIHOT

An anonymous, read-only AI-news API used as an optional search-only provider for AI-news queries.


## Intent routing

Local query classification (`technical`, `news`, `chinese-community`, `general`) used to choose the provider pair and fast-mode order.

## Chinese query

A search query that contains at least one Han script character. Chinese queries use the `chineseSearchOrder` and enable the Zhihu site supplement.

## Zhihu supplement

The Zhihu provider's behavior of calling `zhihu_search` after `global_search` when a Chinese query returns fewer than the requested number of sources, then merging the results by URL.

## Direct HTTP fetch

A fetch strategy that requests the target URL from the DSH host and returns the response body to the tool layer for HTML-to-markdown conversion. `fetchMode: fast` uses this first; `fetchMode: clean` uses Tavily/Firecrawl first.

## Query syntax

The provider-neutral `site:`, `lang:`, `after:`, and `before:` operators parsed from a search query and forwarded to providers that support the corresponding filters.

## Credentials reference

An environment-variable-shaped name such as `TAVILY_API_KEY` that the plugin resolves through the DSH credentials service, with the launch environment as a fallback.
