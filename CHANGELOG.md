## 0.13.13 — 2026-11-21

### 修复

- 六个搜索映射器（Exa、Tavily、知乎、Keenable、Firecrawl、AIHOT）的坏响应失败分类统一为 `WEB_INVALID_RESPONSE`。此前抛裸 `Error` 会归到 `unknown`，用户只配置对坏响应回退时不触发（#176，修复 #172）。
- `docs/feature-map.md` 补上 keyless 后端 `bing`，并把 `web_search` 回退顺序写实为「fast 前缀 + bing 地板 + 付费尾」（#176）。

## 0.13.12 — 2026-11-21

- issue 模板标准化：新增治理/审计表单与来源标注，PR 模板增补 Scope 与验证口径。

# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver. Releases before 0.8.0 have no tags — see git history.

条目一律中文，按 zh-tech-writing 规范撰写；发版说明由发布流程自动取自对应版本节。

更早版本见 [docs/changelog-archive.md](docs/changelog-archive.md)

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
