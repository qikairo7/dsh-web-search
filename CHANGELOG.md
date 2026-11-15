# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver. Releases before 0.8.0 have no tags — see the git history.

## Unreleased

### Added

- Web settings page on the bundle page: provider keys, provider switches, and search/fetch modes in one form.
- `pnpm probe` (`scripts/daily-probe.mjs`): daily live probe over the fixed query set with per-provider telemetry, news/official-domain list-health signals, a rolling 7-day aggregate, and PASS/FAIL verdicts. Daily live evidence moves from the heavy FRAMES/WebWalkerQA run to this probe; the benchmark stays release-time validation.
- `pnpm probe --full`: direct health checks against every backend, including the ones the routed probe never reaches on a healthy day (exa, tavily, firecrawl, zhihu-site, http). Costs a handful of paid credits; meant for weekly or on-suspicion use.
- Cookbook: [raising the web_search summary cap](docs/cookbook/raising-summary-cap.md), the profile-level fix for the 800-character preset default.
- This changelog.

### Fixed

- Direct HTTP fetch enforces the 5 MB cap while reading and decodes the declared charset.
- Advanced tools respect the provider `*Enabled` switches instead of spending quota after a provider is disabled.
- Quality mode no longer returns wrong-language news, misreads "go" as Go docs, or treats `AUD` inside "audit" as a currency.
- Cancellation and the internal quality deadline no longer send unnecessary requests or discard already-ranked results.

### Changed

- Probe files use the local calendar date instead of UTC.
- Documentation budgets re-baseline with each release instead of forcing migration at a fixed cap; `docs/architecture.md` budget raised to 7000.
- `docs:check` now also compares the total table row count between the two READMEs.

## 0.10.0 — 2026-11-16

### Changed

- Provider role matrix redesign (ADR-0010): `lib/roles.js` is now the single routing-role table; quality sets, fast prefixes, and the four default orders derive from it.
- English quality searches drop Zhihu: the English set is Keenable + AnySearch (two-round arm comparison showed no gold-metric loss; Chinese sets are unchanged). English fast orders lose only Zhihu.
- Exa reclassified from paid to free tier on its recurring monthly allowance (official docs: $10 credits/month plus a one-time $10 bonus); the paid search/fetch tails become Tavily → Firecrawl with Exa as free depth. Positions in all fetch orders are unchanged.

### Added

- News freshness supplement: non-AI news queries whose free results carry fewer than 3 sources dated within 7 days trigger one Tavily news search outside the circuit breaker. Gated by `newsFreshnessEnabled` (default on); AI-news queries never trigger it.

### Verified

- Benchmark 50+50 (zero errors): FRAMES evidence recall 0.52→0.60, MRR 0.299→0.340, answer hit 0.48→0.50; WebWalkerQA evidence recall 0.60→0.64.

## 0.9.0 — 2026-11-15

### Fixed

- Audit fixes for Tavily answer mapping, news routing, and the search budget.
- The news year list rebuilds when the year rolls over, so year-bearing queries keep classifying as news.
- The ResultCache TTL test pins the clock instead of racing real time.

## 0.8.1 — 2026-11-15

### Changed

- Architecture deepening: provider operation skeleton (`providerOperation`), routing-fact single home, cache policy owner, catalog/quality-engine/fetch-stack deepening, and domain-matching consolidation. Intent-order semantics decided and documented (intent-derived orders are the quota protection layer; `intentRouting: false` is the escape hatch).

## 0.8.0 — 2026-11-15

### Added

- Multi-backend search and fetch router with free-tier-first providers (Keenable, AnySearch, Zhihu, Zhihu-site, AIHOT, direct HTTP; Exa/Tavily/Firecrawl as paid supplements at the time), quality mode with BGE rerank, evidence enrichment, realtime weather/FX, and the AnySearch / Tavily / AIHOT advanced tools.
