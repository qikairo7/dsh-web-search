# ADR-0004: Optional AnySearch advanced tools

Status: Accepted. Supersedes the provider-only part of ADR-0001.

## Context

ADR-0001 kept this plugin provider-only because `dsh-tool-web` owns the generic `web_search` and `web_fetch` tools. The official `@anysearch/anysearch-dsh` package also exposes three AnySearch-specific tools: `anysearch_capabilities`, `anysearch_search`, and `anysearch_batch_search`. This multi-backend project ports them to keep the advanced AnySearch capabilities available.

## Decision

- Keep `dsh-tool-web` as the owner of `web_search` and `web_fetch`.
- Register the three AnySearch-specific tools from `lib/tools/` when `ctx.tools` is available.
- Add `@deepseek-ai/dsh-tools` as a peer dependency; do not add a generic tool layer or a second provider seam.
- Cap model-visible content from `anysearch_search` and `anysearch_batch_search` through `anysearchMaxRenderedContentChars` (default 12000).
- Other providers stay provider-only.

## Consequences

- The plugin now has one optional model-facing surface, limited to AnySearch advanced search.
- `inject` includes `tools`; a profile without the tool registry will not activate the plugin.
- The three tools can be used without changing the `web_search` / `web_fetch` contract.
- ADR-0001 remains authoritative for every other backend id and for the generic tool layer.
