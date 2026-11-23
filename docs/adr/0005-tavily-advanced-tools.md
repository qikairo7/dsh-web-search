# ADR-0005: Optional Tavily advanced tools

Status: Accepted.

## Context

Tavily's official API exposes Search filters (search depth, topic, time range, domain include/exclude, generated answer, raw content) and batch Extract (1–20 URLs) that `web_search` / `web_fetch` cannot express. The project needs the other backends' API capabilities, not only AnySearch's vertical search.

## Decision

- Add `tavily_search` and `tavily_extract` under `lib/tools/`.
- Keep `web_search` / `web_fetch` owned by `dsh-tool-web`; these tools are provider-specific escapes for parameters the generic schemas do not model.
- Reuse `TavilyProvider` for HTTP, credentials, error mapping, and formatting; do not add a second Tavily client.
- Cap per-call rendered extract content at 12000 characters until a dedicated setting is justified.

## Consequences

- Tavily users can request news/finance topics, publish-time windows, domain filters, and batch extraction without leaving DSH.
- The tool list grows by two; the default `web_search` / `web_fetch` path stays unchanged.
- `tavily_search` consumes the same Tavily credits as provider search; `tavily_extract` consumes extract credits per URL.
