# Glossary

## Backend

A remote search or fetch service that the plugin calls directly over HTTPS. The v1 backends are AnySearch, Tavily, Firecrawl, and Zhihu.

## Provider

A DSH `ctx.web` capability implementation. A search provider answers `search()`; a fetch provider answers `fetch()`. A provider is not a model-facing tool.

## Tool layer

The first-party `dsh-tool-web` package that defines the `web_search` and `web_fetch` tools, their schemas, prompt guidance, output formatting, and Web UI cards. This plugin reuses the tool layer instead of reimplementing it.

## Auto router

A provider that tries the enabled backends in a configured order and falls back when a recoverable error occurs.

## Chinese query

A search query that contains at least one Han script character. Chinese queries use the `chineseSearchOrder` and enable the Zhihu site supplement.

## Zhihu supplement

The Zhihu provider's behavior of calling `zhihu_search` after `global_search` when a Chinese query returns fewer than the requested number of sources, then merging the results by URL.

## Direct HTTP fetch

A fetch strategy that requests the target URL from the DSH host and returns the response body to the tool layer for HTML-to-markdown conversion.

## Credentials reference

An environment-variable-shaped name such as `TAVILY_API_KEY` that the plugin resolves through the DSH credentials service, with the launch environment as a fallback.
