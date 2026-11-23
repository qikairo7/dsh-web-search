# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver. 条目一律中文，按 zh-tech-writing 规范撰写；发版说明由发布流程自动取自对应版本节。

## 0.0.0003 — 2026-11-23

### 变更

- `qualityMaxEngines` 默认值从 3 调到 4。中文报错类、仓库类查询现在能扇出到 GitHub，中文 AI 新闻查询也会保留知乎（PR #10，修复 #3）。

## 0.0.0002 — 2026-11-23

### 新增

- 首个版本。dsh-web-search 是 DeepSeek Harness 的免费网页搜索与抓取 Provider，替代官方计费的 Search/Fetch。
- `web_search` 和 `web_fetch` 支持多引擎自动路由与失败回退，不配 Key 也能用。
- 可选接入 AnySearch、Tavily 等高级源提升质量，按需自配 Key；不配就走免费后端。
- 安装：先 `git clone` 仓库，进入目录后跑 `pnpm install`；包未发布到 npm，不用 npm 安装命令。
