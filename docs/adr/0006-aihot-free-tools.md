# ADR-0006: AIHOT free curated-news tools

Status: Accepted.

## Context

AIHOT's agent endpoints are anonymous, free, read-only, and return ready-to-use Markdown. The existing AIHOT provider only exposes `/api/v1/items` through `web_search`, so the model cannot ask for today's curated news or current hot topics directly.

## Decision

- Add `aihot_latest` and `aihot_hot` under `lib/tools/`.
- `aihot_latest` exposes AIHOT's `window`, `category`, `mode`, and `limit` query parameters.
- `aihot_hot` exposes the current hot-topic list.
- Both return the Markdown produced by AIHOT; no local summarization or extra API calls.

## Consequences

- AI-news queries can use AIHOT directly without spending Tavily or Firecrawl credits.
- These tools depend on AIHOT's public agent contract; a breaking change is a provider error, not a silent fallback.
- No new credential or quota configuration is needed.
