# ADR-0009: Quota-aware quality and fallback routing

Status: Accepted.

## Context

Keenable and AnySearch have large free allowances; Zhihu and AIHOT are also free. Tavily and Firecrawl have tight monthly budgets. Quality mode previously queried Tavily for every query and always ran an extra Tavily official-docs search, which spent paid credits even when free sources were enough.

## Decision

- `qualityPair()` contains free providers only: Chinese Zhihu + Keenable + AnySearch; English Keenable + AnySearch + Zhihu; AI news AIHOT + Keenable + AnySearch + Zhihu.
- Tavily and Firecrawl stay in the fast fallback order and fetch fallback chain; they do not join default quality searches.
- The official-docs Tavily supplement runs only when merged free results do not contain any known official domain.
- `fetchOrder` is Keenable → HTTP → AnySearch → Exa → Tavily → Firecrawl; `cleanFetchOrder` is Keenable → AnySearch → Exa → HTTP → Tavily → Firecrawl.
- Normal `TavilyProvider.search()` does not force `include_published_date`; only the optional advanced search tool exposes publication-date filtering.

## Consequences

- Daily quality searches use free allowances first; paid providers are spent only on empty results, missing official docs, or fetch failures.
- The quality pair has up to four free providers for AI news; the old three-provider review cap no longer applies.
- If all free providers return empty, the router falls through to the fast order so Tavily/Firecrawl can still answer.
