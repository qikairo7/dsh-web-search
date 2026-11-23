# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver. 条目一律中文，按 zh-tech-writing 规范撰写；发版说明由发布流程自动取自对应版本节。

## 0.0.0005 — 2026-11-23

### 修复

- 配了多个 GitHub Key 时，某个 Key 触发限流（403/429）进入冷却后，调度不再把它当可用一直打，冷却期内直接跳过，冷却结束自动回到轮转（PR #11，修复 #2）。

维护者拍板：你来决策就可以了（2026-11-23，授权 Lead 代决）。

## 0.0.0004 — 2026-11-23

### 修复

- PR 模板「是否有人参与」改为默认勾「有」，勾「无」须全程零用户消息证据（参与决策链——下令/拍板/纠错/终审——即算有人参与）。

## 0.0.0003 — 2026-11-23

### 变更

- `qualityMaxEngines` 默认值从 3 调到 4。中文报错类、仓库类查询现在能扇出到 GitHub，中文 AI 新闻查询也会保留知乎（PR #10，修复 #3）。

## 0.0.0002 — 2026-11-23

### 新增

- 首个版本。dsh-web-search 是 DeepSeek Harness 的免费网页搜索与抓取 Provider，替代官方计费的 Search/Fetch。
- `web_search` 和 `web_fetch` 支持多引擎自动路由与失败回退，不配 Key 也能用。
- 可选接入 AnySearch、Tavily 等高级源提升质量，按需自配 Key；不配就走免费后端。
- 安装：先 `git clone` 仓库，进入目录后跑 `pnpm install`；包未发布到 npm，不用 npm 安装命令。
