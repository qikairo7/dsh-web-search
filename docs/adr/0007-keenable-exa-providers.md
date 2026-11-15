# ADR-0007: Keenable and Exa providers

Status: Accepted.

## Context

Keenable publishes an official DeepSeek Harness plugin (`@keenable/dsh-keenable`, MIT) with keyless-capable search and clean Markdown fetch and a 100,000-request monthly allowance with a key. Exa exposes REST `/search` and `/contents`; an Exa key with a monthly balance was available for verification. Both should participate in the existing multi-backend router without replacing it.

## Decision

- Register `keenable` and `exa` as standard provider ids.
- Keenable implements search and fetch, ported from the official plugin; it is first in the default search and fetch orders because its quota is large and free.
- Exa implements search and `/contents` fetch as a balance-based supplement; it stays behind free providers and is not in the default quality pair.
- Resolve keys through `KEENABLE_API_KEY` and `EXA_API_KEY` credentials; keyless Keenable remains usable without a key.
- Do not add Keenable- or Exa-specific model tools; their capabilities fit the existing `web_search` / `web_fetch` seam.

## Consequences

- Default search and fetch become Keenable-first; AnySearch/Zhihu/AIHOT remain free fallbacks and quality sources.
- Exa balance is consumed only when the free search order reaches it or the router needs its Contents fetch.
- The plugin now depends on two more upstream contracts; provider errors degrade through the existing fallback chain.
