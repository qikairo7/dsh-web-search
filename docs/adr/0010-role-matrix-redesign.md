# ADR-0010: Role-matrix redesign — language-scoped quality sets, Exa free tier, news freshness supplement

Status: Accepted.

## Context

The provider role matrix had four structural and behavioral problems, measured on 2026-11-16:

- Role knowledge lived in five places: `lib/catalog.js` (tier, paid fallback), `lib/settings.js` (four hand-written orders, each embedding the paid tail), `lib/intent.js` (`FAST_FREE_PREFIXES`, `qualityPair`), ADR-0009 text, and `cordis.patch.yml` (shipped defaults). One role change required synchronized edits everywhere.
- `qualityPair()` was invariant to language value: Zhihu sat in every English quality set although its declared role is Chinese-first. A two-round live arm comparison (`.research/en-quality-arms.json`, `.research/en-quality-arms-r1.json`; 7 English queries × {keenable+anysearch, +zhihu, +exa}; gold Top3/Top10 saturated) showed the two-source set never lost a gold hit and the third source added none while losing one in round 2; the Exa arm was slowest both rounds.
- ADR-0007 classified Exa as a balance-based paid backend. Current official pricing ([docs.exa.ai](https://docs.exa.ai/reference/rate-limits)) grants every team a recurring monthly allowance on the Free tier ($10 credits per month, plus a one-time $10 onboarding bonus); pricing trackers additionally record a March 2026 change to 1,000 free requests per month. A recurring monthly allowance is the same quota class as Tavily/Firecrawl's 1,000 credits per month, not a pure balance. This premise change supersedes ADR-0007's Exa classification.
- News timeliness was the weakest measured intent (daily-use comparison: 28% dated coverage; `en-news` 3/10 dated) while the set's best news capability (Tavily `topic: news` + `time_range`) was unreachable in quality mode. AI news is already served by AIHOT, the `ai-news` lead.

## Decision

- Add `lib/roles.js` as the single routing-role table: `SEARCH_ROLES` (quality set and fast free prefix per language × routed intent) and `DEFAULT_SEARCH_ORDERS` (settings-level defaults derived from the table plus the catalog paid tail). `lib/settings.js` defaults, `lib/intent.js` routing, and `cordis.patch.yml` ship values derived from or identical to this table.
- English quality sets lose Zhihu: `keenable + anysearch`; English `ai-news` is `aihot + keenable + anysearch`. Chinese sets are unchanged (`zhihu + keenable + anysearch`; `ai-news` adds aihot first). Zhihu keeps its role for Chinese queries only.
- Reclassify Exa as tier `free`. It becomes the free depth hop (last free position) in fast prefixes and the default search orders; its fetch positions are unchanged. The paid search and fetch tails become `tavily → firecrawl`.
- Add the news freshness supplement: for `news`-intent queries that are not AI queries, when the free results contain fewer than `NEWS_FRESHNESS_MIN_DATED` (3) sources dated within `NEWS_FRESHNESS_WINDOW_DAYS` (7), quality mode runs exactly one Tavily news search outside the circuit breaker and merges its sources. `newsFreshnessEnabled` (default `true`) gates it. AI-news queries never trigger it because AIHOT already leads that intent.
- Tavily declares `newsSupplement: true` in the catalog, the single selection fact for the supplement seam (mirroring `domainSearch` for official docs and `newsBoost` for AIHOT).

## Consequences

- Behavior deltas versus 0.9.0: English queries stop fanning out to Zhihu (quality and fast); Exa keeps identical positions but a free label; non-AI news queries with stale free results spend one Tavily credit.
- Chinese search sequences stay byte-identical; English fast sequences lose only Zhihu. `cleanFetchOrder` no longer places a paid backend before the free direct-HTTP hop, because Exa is free.
- Exa's monthly allowance (~1,000–2,500 free searches at listed rates) is burned only when free providers ahead of it fail; it still does not join default quality fan-out, per the arm comparison.
- ADR-0007's "balance-based" classification and ADR-0009's quality-pair and fetch-order lines are superseded where they conflict with this ADR.
