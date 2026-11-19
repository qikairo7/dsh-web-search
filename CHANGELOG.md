# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver. Releases before 0.8.0 have no tags — see git history.

条目一律中文，按 tech-doc-style-chinese 规范撰写；发版说明由发布流程自动取自对应版本节。

## 0.13.0 — 2026-11-19

### 新增

- 免 Key 的 Bing 搜索地板（ADR-0011）：Bing 公开 HTML SERP 位于免费栈与付费尾接之间，无需 Key、不占配额；空结果或无关 SERP 自动交给下一个 provider。新设置：`bingEnabled`、`bingBaseURL`、`bingMarket`。
- `fallbackFailureClasses` 配置：失败按 quota / auth / bot-wall / transient / invalid-response / unknown 分类，该字段决定哪些类别可以回退到下一个 provider（默认全部六类；显式空列表表示在首个失败处停止）。空内容失败（Tavily/AnySearch extract、HTTP SPA 壳）现在抛 `WEB_INVALID_RESPONSE`。
- GitHub Release 附带可安装的 `.tgz` 包与 `SHA256SUMS` 校验和。

### 修复

- 桌面版（`dsh-app://`）设置页的「验证」「拉取模型」「刷新额度」不再统一返回 `403 same-origin request required`：信任判定改由宿主 Connection 栅栏决定，真实失败会显示服务端返回的 `code` 与 `message`。

### 变更

- README 凭据示例：手改 `~/.dsh/.credentials.yaml` 时 Key 须嵌套在 `refs` 之下；推荐用设置页的「添加 Key」。
- README 重构为中文主文档（`README.md`），英文版移至 `README.en.md`。

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
