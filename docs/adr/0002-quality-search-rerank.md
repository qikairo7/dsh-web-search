# ADR-0002: Quality search mode with multi-provider merge and BGE rerank

Status: Accepted.

## Context

Single-provider search results vary by query type. In live probes, AnySearch returned canonical MDN results for an English technical query, Zhihu returned better Chinese community context, and Tavily supplied long summaries and a generated answer. A quality mode that queries multiple providers covers more of these cases than any single backend.

SiliconFlow exposes `BAAI/bge-reranker-v2-m3` with a free allowance and enough throughput for interactive use. The native `WebSearchResult` shape tolerates the extra latency when the user explicitly values quality.

## Decision

- Make `searchMode: quality` the default.
- Select the provider set by intent; the current implementation uses three providers per query:
  - Chinese: Zhihu + AnySearch + Tavily.
  - English: AnySearch + Tavily + Zhihu.
  - AI news: AIHOT + Tavily + AnySearch.
- Run the providers in parallel, merge sources round-robin, deduplicate by normalized URL, and send titles, summaries, and URLs to SiliconFlow `BAAI/bge-reranker-v2-m3`.
- If reranking fails or the credential is missing, return the merged provider order.
- Keep `searchMode: fast` available for the single-provider priority behavior.
- Cache quality results for 5 minutes and trip a per-provider breaker after 3 recoverable failures.

## Consequences

- Quality mode makes three search calls plus one rerank call per query; latency is roughly the slower provider plus rerank.
- It depends on a free SiliconFlow credential for the best ordering, but degrades safely without it.
- Fast mode remains the cheap fallback for latency-sensitive or quota-constrained use.
- Cross-provider merging can surface sources that a single provider would miss, but it also increases the chance of near-duplicate or lower-authority sources; URL dedup and reranking are the first-line controls.
