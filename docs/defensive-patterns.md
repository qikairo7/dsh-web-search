# 防御性 Review 规则

本文件按 artifact 列出 Review 时最容易漏掉的规则。[CODING_STANDARDS](../CODING_STANDARDS.md) 的 Review 门禁是总清单；这里是展开说明。

## Provider

- 每个 provider 实现 `id`、`title`、`description`、`available()`、`ready()`，按能力实现 `search()` / `fetch()`。
- mapper 只在入口校验一次：坏条目丢弃，业务 envelope 错误才 throw；内部函数不再重复判型。
- 边界统一抛 `WEB_*` 错误；取消立即返回，不进入回退。
- Provider 不直接读 `process.env` 或 `ctx.config`；凭据走 `resolveKey`，配置走 `settings()`。
- `description` 保持 `{ en, zh }` 双语；不要只写一种语言。

## Router

- 只有可恢复错误触发下一个 provider：网络、超时、429、5xx、凭据缺失。
- 取消和非法 URL 立即返回；直连 HTTP 的 404 作为结果返回，不触发回退。
- 熔断只统计可恢复失败且属于允许回退的类别；连续失败达到阈值后跳过冷却期。
- quality 模式正常路径最多 4 个免费搜索 provider（AI 新闻组合）+ 1 次 official-docs 搜索（仅免费结果缺官方域时）+ embedding/rerank + 最多 5 次证据抓取。
- 缓存 key 必须覆盖所有影响结果的设置；新增会影响结果的配置时同步加入 key。
- 合并、去重、重排和循环必须有界。

## 直连 HTTP

- 最多 5 跳重定向，允许跨域；超过上限抛 `WEB_REDIRECT_BLOCKED`。
- 5 MB 响应上限；只接受 HTML/text/JSON/XML，PDF 和二进制抛 `WEB_UNSUPPORTED_CONTENT_TYPE`。
- 小型 SPA 空壳由 `minDirectHtmlChars` 判定并回退到 API provider。
- 直连 HTTP 可以访问回环和私有网段，这是与官方 `dsh-web-fetch-http` 一致的行为，不要擅自加网络封锁。

## 配置

- 每个字段同时出现在 `Config`、`DEFAULT_SETTINGS`、`resolveSettings`。
- `*ApiKeyEnv` 使用 `.role('credential-ref')`。
- 代码里不藏开关常量；部署差异走配置。
- 默认值或配额变化时，两份 README 和 `cordis.patch.yml` 同步。

## 文档

- 遵守 [docs/AGENTS.md](AGENTS.md)：一个事实一个家、当前状态、篇幅预算、相对链接、中文文风。
- 改 README 时两份同步；改契约先写 ADR；改实现规则更新 `CODING_STANDARDS.md`。

## 测试

- 新行为有改动前失败、改动后通过的测试。
- 测真实实现，不复制实现逻辑；单元测试不访问网络。
- `test/architecture.test.js` 的付费 API 与 MCP 守卫不得削弱。

## Review 顺序

1. 先看契约和错误边界。
2. 再看回退、配额、缓存和循环。
3. 最后看配置、测试、文档与依赖方向。
