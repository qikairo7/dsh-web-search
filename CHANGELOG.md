# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver. Releases before 0.8.0 have no tags — see git history.

条目一律中文，按 tech-doc-style-chinese 规范撰写；发版说明由发布流程自动取自对应版本节。

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

更早版本见 [docs/changelog-archive.md](docs/changelog-archive.md)
