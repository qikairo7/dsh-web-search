# ADR-0012: 新增 GitHub provider——官方 API 搜索与结构化抓取

Status: Accepted. 决策于 2026-11-16 确定，先于实现；排期与验收见 #40。

## 背景

- 平台搜索缺位：模型查仓库、包名、报错原文只能走通用搜索，召回与精度不足。
- GitHub 官方 REST Search API 免 key 可用：匿名档 search 10 次/分钟、core 60 次/分钟（按 IP）；带 PAT 后 search 30 次/分钟、core 5000 次/小时。官方 API、公开数据，不涉及抓取灰区。
- github.com 页面是 JavaScript 重页面，通用抓取器（Keenable/Tavily 的 HTML 抽取）效果差；API 提供结构化等价物。
- 2026-11-16 免 key 实测（证据在 #40 评论）：仓库搜索、issue 搜索（「spawn EPERM」前三条全部高相关）、text-match 片段、README 与 raw 直取、`x-ratelimit-*` 头全部通过；匿名 code 搜索按预期 401。

## 决策

- 注册新标准 provider id `github`，能力 search 与 fetch。
- tier 定为 free（keyless-capable）：匿名可用；`GITHUB_TOKEN`（PAT，classic `public_repo` 或 fine-grained 只读公开仓库）提额，凭据走 DSH credentials 服务与 keyring 多 key。
- 搜索映射：repo → url、`full_name`、description + stars + language + topics，publishedAt 取 pushed_at；issue → url、title、body 摘录、state、comments 数，publishedAt 取 created_at；issue 搜索结果混有 PR，用 `pull_request` 字段区分或以 `is:issue` 过滤；code 搜索仅在有 token 时启用，snippet 用 text-match 片段。
- 查询限定符透传：`language:`、`stars:>`、`in:`、`repo:`、`label:`、`created:>` 与现有 `after:`/`before:` 算子（`lib/query.js`）对齐直译。
- fetch 映射（首版）：issue 页 → `GET /repos/{o}/{r}/issues/{n}` 正文；repo 主页 → `GET /repos/{o}/{r}/readme`（raw Accept）；blob/raw → raw.githubusercontent.com 直取。issue 评论二跳留二期。
- 路由：`site:github.com` 直接命中；technical intent 查询插入 fast 序；quality 的权威加权已含 github.com，官方域补充同受益。
- 限额感知：每响应 `x-ratelimit-*` 头进 quotaStore，设置页按当前凭据态显示额度。
- 失败语义：二级限流（403 + `Retry-After`）映射为可恢复错误进入回退链，并按 `Retry-After` 冷却。

### 放弃的替代方案

- 独立 `github_search` 工具而非 provider：不进 web_search 主路径，放弃路由、权威加权与回退链的全部好处。
- HTML 抓取 github.com：JS 重页面抽取质量差，且官方 API 可用。
- GraphQL v4：必须认证，匿名不可用；Discussions 搜索只有 GraphQL，首版因此不做。

## 后果

- 匿名限额按 IP：fast 链单查询一次调用不放大；quality fan-out 同样单次调用。
- 新增一个 provider 的维护面；GitHub API 的稳定性与文档质量高于本插件其余抓取类后端。
- fetch 侧对 github.com 域直接命中结构化结果，绕过 HTML 抽取。
- AGENTS.md 的标准 id 清单在实现 PR 中同步登记 `github`。
- 本文只记录决策；行为细节以 #40 与实现 PR 为准。
