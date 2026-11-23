# Changelog archive

本文件归档 `CHANGELOG.md` 中更早的版本节，保留原始条目。最新版本见 [CHANGELOG.md](../CHANGELOG.md)。

## 历史版本线

本文件是旧版本线（0.8.0 到 0.13.14）的归档层：各版本节正文保留原样，不改写、不删除。主线已重开为 v0.0.x 递增线，最新版本与发版记录见 [CHANGELOG.md](../CHANGELOG.md)。

## 0.13.14 — 2026-11-21

### 变更

- `scripts/verify-docs.mjs` 新增双语镜像链接语言配对守卫：中英镜像对互相引用时校验链接目标语言，跨语言指错即让 `docs:check` 变红（#181，修复 #173）。
- 新增预算贴顶预警：文档体量余量低于 `minHeadroom`（默认 10）时先出 `WARN`，不改退出码（#181，修复 #173）。
- `docs/AGENTS.md` 文档增长处置阶梯补一句收紧：删字凑预算不属于任何一级处置，贴顶或超标先做第 2 级拆分（#181）。

## 0.13.13 — 2026-11-21

### 修复

- 六个搜索映射器（Exa、Tavily、知乎、Keenable、Firecrawl、AIHOT）的坏响应失败分类统一为 `WEB_INVALID_RESPONSE`。此前抛裸 `Error` 会归到 `unknown`，用户只配置对坏响应回退时不触发（#176，修复 #172）。
- `docs/feature-map.md` 补上 keyless 后端 `bing`，并把 `web_search` 回退顺序写实为「fast 前缀 + bing 地板 + 付费尾」（#176）。

## 0.13.12 — 2026-11-21

- issue 模板标准化：新增治理/审计表单与来源标注，PR 模板增补 Scope 与验证口径。

## 0.13.11 — 2026-11-21

### 变更

- 错题本 `REVIEW-LESSONS.md` 建立归档机制：满足归档触发（已晋升、Seen=1 且连续 30 天无增量、连续 90 天无 Seen 增量）的教训整行移入新建的 `REVIEW-LESSONS-archive.md`，主表只留 open 条目、预算固定 3000 靠归档腾位；`docs/AGENTS.md` 的文档增长阶梯第 3 级同步改为按归档机制控预算，不再扩预算（#167，修复 #150）。

## 0.13.10 — 2026-11-20

### 修复

- `anysearchClient` 解析响应体改用全仓统一的 `readResponseText`，按 10MB 上限流式读取，超限在读取阶段即中止；此前直接调用 `response.json()`，一次性读入且无上限，可绕过限制把超大响应体整段缓冲进内存（#162，修复 #139）。

## 0.13.9 — 2026-11-20

### 变更

- 仓库中文文档标准由 `tech-doc-style-chinese` 切换为 `zh-tech-writing`，`CODING_STANDARDS.md`、`docs/AGENTS.md` 等处的技能引用随之替换；接入 autocorrect，新增 `.autocorrectrc`、`.autocorrectignore` 与 `pnpm lint:zh`，以 observe 方式单跑、不并入 `pnpm check`，历史文件不改写。
- `README.md`、`README.en.md` 去掉装饰性 emoji，重录 `docs/translation-pairs.json`；活文档按机械排版与行文抽查两层清理，`docs/development.md` 预算由 3500 调到 4000。

## 0.13.8 — 2026-11-20

### 变更

- 文档超预算处置改为四步阶梯（移除空操作 → 渐进披露拆分 → 预算重定基线 → 删减作最后手段），删减须写明删的是冗余还是事实；以 `docs/AGENTS.md` 自举拆出 `docs/schema-inventory.md`、`docs/schema-sync-map.md` 两份子文件（#151，修复 #149）。
- 注释纪律写进 `CODING_STANDARDS.md`（只写 WHY、禁行内复述与位置注释）；`README.md` / `README.en.md` 新增「文档索引」节，按使用/原理/开发/深入/治理五组补齐 `docs/` 可发现性。

## 0.13.7 — 2026-11-20

### 新增

- 新增 `scripts/check-doc-refs.mjs` 并接入 `pnpm check`（文档体量校验之后）：扫描仓库全部 md 的行内代码，核对相对文件路径与 `node <path>`、`pnpm <script>` 目标是否存在，失效即让门禁变红（#147，修复 #146）。
- 新增 8 条用例，覆盖路径与命令解析、报错格式、代码围栏排除；`CONTRIBUTING.md`、`docs/development.md`、`docs/AGENTS.md` 的 check 组成描述同步为八段。

## 0.13.6 — 2026-11-20

### 修复

- quality 模式内部超时不再让整条搜索以 `WEB_ABORTED` 失败：语义去重、rerank、官方文档补充、新闻补充遇内部 deadline 时降级返回已合并结果，只有调用方真实取消才向上抛（#144，修复 #137）。
- 新增 6 条用例（quality 5 条 + router 入口层 1 条），覆盖各阶段内部超时降级返回，以及调用方取消在 rerank、补充阶段仍抛 `WEB_ABORTED`。

## 0.13.5 — 2026-11-20

### 变更

- 把设置页保存 Key 的真实路径 `saveKey` 抽成模块级函数并暴露给单测：门在 busy 之前，成功或失败都复位 busy，界面行为不变（#133，修复 #123）。
- 新增 3 个接线级用例，锁住「非法输入不进入保存中状态」与 busy 复位；此前的守卫只覆盖 `beginKeySave` 单体，`saveKey` 里把 `setBusy` 提前仍可全绿。

## 0.13.4 — 2026-11-20

### 变更

- `docs/changelog-archive.md` 在 `scripts/doc-budgets.json` 登记 8000 字符预算，纳入 `verify-docs` 的体量检查。
- 归档导航行从 0.13.0 节移到 `CHANGELOG.md` 文件头，作为文件级导航；版本节结构不变。

## 0.13.3 — 2026-11-20

### 变更

- bug / feature 两个 issue 表单新增「预估改动面」下拉，作为审查分档的前置信息，默认「不确定」。
- `CHANGELOG.md` 瘦身回基线下：只保留最近三节，更早条目移入 `docs/changelog-archive.md`；该文件已加入发布包 `files` 白名单随包发布。

## 0.13.2 — 2026-11-19

### 变更

- 设置页多 Key 保存：把非法输入判定抽成门函数 `beginKeySave`（可注入 `setBusy`），新增 2 条单测锁住「非法输入绝不进入保存中状态」；对外行为不变（#121，Refs #117）。

## 0.13.1 — 2026-11-19

### 修复

- 设置页多 Key 保存清理：删除不可达防御分支、overflow/empty 判定前置，消除保存按钮瞬时闪烁（#118，修复 #117）。

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
- Cookbook: [raising the web_search summary cap](cookbook/raising-summary-cap.md), profile-level fix for the 800-character default.
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
