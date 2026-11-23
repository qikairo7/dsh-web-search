# ADR-0003: Free-tier-first provider backends

Status: Accepted.

## Context

The project replaces the paid DeepSeek Search and Fetch APIs with a self-contained DSH provider bundle. The target user is a developer who needs fresh web information and reliable page extraction during normal project work. The selected backends expose free allowances that are sufficient for daily use.

## Decision

- Do not call DeepSeek Search or Fetch APIs.
- Keep the first-party `dsh-tool-web` tool layer; implement only `ctx.web` providers.
- Use AnySearch, Zhihu, Tavily, Firecrawl, AIHOT, direct HTTP, and the SiliconFlow free allowance as the backend set.
- Keep `quality` mode multi-source and authority-aware; keep `fast` mode as the low-quota path.
- Treat additional MCP servers and third-party DSH plugins as non-goals.

## Consequences

- No paid official API dependency and no extra runtime service.
- Tavily and Firecrawl budgets are finite: quality mode uses one Tavily credit per selected search query, plus up to five fallback fetch credits when the top results cannot be fetched directly. Heavy use should use fast mode or the cache.
- Provider failures degrade through fallback order and the circuit breaker instead of failing the tool call.
- Quota accounting is documented in the README and must be updated when defaults change.
