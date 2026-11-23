# ADR-0001: Provider-only plugin with standard backend ids

Status: Accepted.

## Context

`dsh-tool-web` already owns the model-facing `web_search` and `web_fetch` tools, including their schemas, prompt guidance, result formatting, and Web UI cards. The official backends charge per request: the legacy `deepseek-official` provider runs a full model turn per search, and the DeepSeek Search/Fetch API bills successful requests.

The plugin must replace those backends without a second tool layer, an MCP server, or third-party DSH plugins. The profile previously mounted a separate AnySearch plugin that occupied the `anysearch` provider id.

## Decision

- Implement only `ctx.web` providers and reuse `dsh-tool-web`; do not register model-facing tools.
- Use the standard ids `anysearch`, `tavily`, `firecrawl`, `zhihu`, `zhihu-site`, `http`, and `auto`.
- Uninstall the separate AnySearch plugin so the `anysearch` id is free.
- Disable the shipped `web-fetch-http` provider in the bundle patch; this plugin owns the `http` fetch id and its redirect and SPA-shell policy.
- Keep API keys in the DSH credentials service, referenced through `*ApiKeyEnv` fields.
- Keep the first-party `dsh-tool-web` row enabled through the bundle patch.

## Consequences

- The plugin stays small; the native tool contract and UI cards are unchanged.
- It depends on `dsh-tool-web` being present; the patch enables that row.
- It cannot coexist with another plugin that registers the same ids.
- No custom client half is needed; the settings page comes from `Config`.
- Direct HTTP redirect, size, content-type, and SPA-shell behavior are part of this repository's contract.
