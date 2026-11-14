# ADR-0001: Provider-only plugin with standard backend ids

## Status

Accepted.

## Context

DSH already ships the first-party `dsh-tool-web` package, which owns the model-facing
`web_search` and `web_fetch` tools, their schemas, prompt guidance, result formatting, and
Web UI cards. The official search backends charge per request: the legacy
`deepseek-official` provider runs a full model turn for each search, and the DeepSeek
Search/Fetch API bills successful requests.

The plugin must replace those paid backends without adding a second tool layer, an MCP
server, or a stack of third-party DSH plugins. The profile also previously mounted an
AnySearch provider plugin that occupies the `anysearch` provider id.

## Decision

- Implement only `ctx.web` providers. Reuse the first-party `dsh-tool-web` tool layer and
  do not register model-facing tools.
- Use standard provider ids: `anysearch`, `tavily`, `firecrawl`, `zhihu`, `zhihu-site`,
  `http`, and `auto`.
- Uninstall the separate AnySearch plugin so the `anysearch` id is free.
- Make the bundle patch disable the shipped `web-fetch-http` provider, because this plugin
  owns the `http` fetch id and its own redirect and SPA-shell policy.
- Keep API keys in the DSH credentials service, referenced through `*ApiKeyEnv` fields.
- Keep the first-party `dsh-tool-web` row enabled through the bundle patch.

## Consequences

- The plugin stays small and keeps the native tool contract and UI cards unchanged.
- The plugin depends on `dsh-tool-web` being present in the composition; the patch enables
  that row.
- Standard ids make the plugin a drop-in replacement, but it cannot coexist with another
  plugin that registers the same ids.
- No custom client half is needed in v1; the settings page comes from the `Config` schema.
- Direct HTTP is owned by this plugin, so its redirect, size, content-type, and SPA-shell
  behavior are part of this repository's contract rather than the shipped provider's.
