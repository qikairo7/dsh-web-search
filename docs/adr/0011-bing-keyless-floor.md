# ADR-0011: Bing keyless floor tier

Status: Accepted.

## Context

The search chain is free-tier-first (ADR-0003) with intent-aware routing (ADR-0009, ADR-0010): free providers answer first, and the paid tail (`tavily → firecrawl`) spends credits only when the free stack fails or returns empty. Between the two there is no floor: when every free allowance is exhausted, missing a key, or down, the chain jumps straight to paid credits or fails outright.

Bing's public SERP (`https://www.bing.com/search`) is reachable without a key and has no metered quota. The sibling project [DDDMUC/dsh-free-search](https://github.com/DDDMUC/dsh-free-search) (MIT) has shipped this engine and measured its failure modes: empty SERP containers from rate-shaped or flagged egress IPs (made worse, not better, by retrying), and unrelated cached pages served for zero-result queries.

## Decision

- Extend the catalog tier vocabulary to three classes: `free` (anonymous access or a recurring monthly allowance, such as Exa's), `keyless` (no key, no metered quota, scrape-based), and `paid` (scarce monthly credits, fallback-only). ADR-0003/0009/0010 stand; this adds a class between free and paid.
- Register the standard provider id `bing`: search-only, tier `keyless`, no operators, credentials-free, placed in catalog registration order after `exa`. Add `keylessSearchFallback()` to `lib/catalog.js`, mirroring `paidSearchFallback()`.
- Bing never joins the quality fan-out or the `SEARCH_ROLES` table. The role table stays free-only, preserving the four-free-provider quality cap from ADR-0009/0010; a floor answers last, it is not another parallel source. The keyless tier is derived per id in the two default search orders and in intent fast orders, always positioned after the free stack (including Exa free depth) and before the paid tail.
- Zero relevant results is a recoverable failure, not a success: the mapper maps both an empty SERP (zero `b_algo` blocks) and a batch that fails a token-overlap relevance gate to zero sources, and `search()` throws a recoverable `WEB_PROVIDER_ERROR` so the fallback chain advances. The runner ends the chain on any successful return, so an empty floor must throw. One request per search, no retry: the reference measured that retrying empty SERPs doubles requests and invites harder rate shaping.
- Do not send `mkt` by default (overseas egress plus `mkt=zh-CN` returns empty SERP containers); the `bingMarket` setting sends it only when non-empty. `accept-language` follows the routed language.

Alternatives considered, none registered this round:

- Tencent Yuanbao (`yuanbao`): credential-gated API with promotional allowances — a free-allowance class, not a keyless floor; the maintainer declined it on 2026-11-16.
- Crawl4AI Cloud (`crawl4ai`): key-gated, 1000 free credits/month; its value is a Google SERP path and a cheaper scrape tail. Future candidate, separate issue.
- Exa anonymous MCP endpoint (`mcp.exa.ai`): keyless depth for the existing `exa` id. Evaluated only; would need its own decision.

## Consequences

- An empty or irrelevant Bing result counts as a recoverable failure in the circuit breaker (3 consecutive → 5-minute cooldown); during cooldown the chain skips Bing and the paid tail answers. The breaker absorbs a persistently empty SERP from a flagged egress IP without user action.
- SERP scraping depends on Bing's HTML shape (`<li class="b_algo">` blocks, `bing.com/ck/a` `u`-parameter redirects). A layout change degrades to recoverable errors and fallback, not tool failures.
- Quality mode is unchanged: same free fan-out, same supplements, no new credits spent on the normal path.
- No new npm dependency. Parsing, the `ck/a` unwrap, and the relevance gate are adapted from DDDMUC/dsh-free-search (MIT), disclosed in `THIRD_PARTY_NOTICES.md`.
