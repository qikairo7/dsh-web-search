# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver. Releases before 0.8.0 have no tags — see git history.

## 0.13.0 — 2026-11-19

### Added

- Keyless Bing search floor (ADR-0011): Bing's public HTML SERP sits between the free stack and the paid tail with no key or quota; empty or unrelated SERPs hand to the next provider. New settings: `bingEnabled`, `bingBaseURL`, `bingMarket`.
- `fallbackFailureClasses` config: failures are classified as quota / auth / bot-wall / transient / invalid-response / unknown, choosing which classes may fall back to the next provider (default all six; an explicit empty list stops at first failure). Empty-content failures (Tavily/AnySearch extract, HTTP SPA shells) now throw `WEB_INVALID_RESPONSE`.
- GitHub Releases now attach an installable `.tgz` package.

### Fixed

- Desktop (`dsh-app://`) settings page: verify, load models, and refresh quota no longer return `403 same-origin request required`; the host Connection fence now decides trust, and real failures show the server `code`/`message`.

### Changed

- README Credentials example: hand-edited `~/.dsh/.credentials.yaml` nests keys under `refs`; prefer **Add key**.

## 0.12.0 — 2026-11-16

### Added

- Keenable quota: cache `credits_remaining` from responses; **Refresh quota** runs one minimal search to read latest.
- Provider key editor: masked rows with per-key **Delete** and **Add key**, up to eight keys per provider.

## 0.11.0 — 2026-11-16

### Added

- Web settings page: provider keys, switches, and search/fetch modes.
- Settings page: multi-key rotation and Zhihu quota.
- `pnpm probe` (`scripts/daily-probe.mjs`): daily per-provider health probe with news/official-domain signals, 7-day aggregate, and PASS/FAIL; heavy benchmarks stay release-time.
- `pnpm probe --full`: direct checks for every backend the routed probe skips; costs a few paid credits, weekly use.
- Cookbook: [raising the web_search summary cap](docs/cookbook/raising-summary-cap.md), profile-level fix for the 800-character default.
- This changelog.

### Fixed

- AnySearch: `maxResults` capped at 10; 55s HTTP deadline; Extract timeouts map to `WEB_FETCH_TIMEOUT`; warns if the profile lacks `@deepseek-ai/dsh-tool-web`; client id follows the package version.
- Direct HTTP enforces the 5 MB cap while reading and decodes the declared charset.
- Advanced tools respect the provider `*Enabled` switches instead of spending quota after disable.
- Quality mode no longer returns wrong-language news, misreads "go" as Go docs, or treats `AUD` in "audit" as currency.
- Cancellation and the internal quality deadline no longer send needless requests or discard ranked results.

### Changed

- Probe files use local calendar date instead of UTC.
- Documentation budgets re-baseline each release instead of a fixed cap; `docs/architecture.md` budget raised to 7000.
- `docs:check` also compares total table rows between the READMEs.

## 0.10.0 — 2026-11-16

### Changed

- Provider role matrix redesign (ADR-0010): `lib/roles.js` is the sole routing-role table; quality sets, fast prefixes, and default orders derive from it.
- English quality searches drop Zhihu: the English set is Keenable + AnySearch (two-round comparison showed no gold-metric loss; Chinese sets unchanged). English fast orders lose only Zhihu.
- Exa reclassified from paid to free tier on its monthly allowance ($10 credits/month plus a one-time $10 bonus); paid tails become Tavily → Firecrawl with Exa as free depth. Fetch-order positions unchanged.

### Added

- News freshness supplement: non-AI news queries whose free results carry under 3 sources dated within 7 days trigger one Tavily news search outside the breaker. Gated by `newsFreshnessEnabled` (default on); AI-news queries never trigger it.

### Verified

- Benchmark 50+50 (zero errors): FRAMES evidence recall 0.52→0.60, MRR 0.299→0.340, answer hit 0.48→0.50; WebWalkerQA evidence recall 0.60→0.64.

## 0.9.0 — 2026-11-15

### Fixed

- Audit fixes for Tavily answer mapping, news routing, and search budget.
- The news year list rebuilds on year rollover, so year-bearing queries keep classifying as news.
- The ResultCache TTL test pins the clock instead of racing time.

## 0.8.1 — 2026-11-15

### Changed

- Architecture deepening: provider operation skeleton (`providerOperation`), routing-fact single home, cache policy owner, catalog/quality-engine/fetch-stack deepening, and domain-matching consolidation. Intent-order semantics documented (intent-derived orders are the quota protection layer; `intentRouting: false` is the escape hatch).

## 0.8.0 — 2026-11-15

### Added

- Multi-backend search and fetch router with free-tier-first providers (Keenable, AnySearch, Zhihu, Zhihu-site, AIHOT, direct HTTP; Exa/Tavily/Firecrawl as paid supplements then), quality mode with BGE rerank, evidence enrichment, realtime weather/FX, and the AnySearch / Tavily / AIHOT advanced tools.
