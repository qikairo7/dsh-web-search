# dsh-web-search

免费后端实现 `ctx.web` 搜索/抓取 Provider，替换收费 DeepSeek Search/Fetch；`web_search`/`web_fetch` 由 `dsh-tool-web` 提供；AnySearch/Tavily/AIHOT 可选高级工具。

本文件是 AI 指令唯一权威；规则不落其他工具文件。

## 硬边界

- `lib/` 不调用 DeepSeek 付费 Search/Fetch API。
- 不新增 MCP server 或 `@modelcontextprotocol/*` 依赖。
- 不提交真实密钥或 `.credentials.yaml`；key 只从环境变量或 gitignored `.env` 读，不写进 shell 命令。

## 路由

确定性命令：`pnpm check`

|任务 | 去处 | 触发时机|
|---|---|---|
|配置/配额|docs/configuration.md|查配置|
|架构|docs/architecture.md、docs/dsh-host-contract.md、codegraph_explore、codegraph init|改代码/查调用/重建|
|标准/Review|CODING_STANDARDS.md、docs/cookbook/adding-a-provider.md|写/评审|
|文档/术语/ADR/决策|docs/AGENTS.md、GLOSSARY.md、docs/agents/domain.md、docs/adr/、.agents/notes/|文档/术语|
|发版/推前/排错|CHANGELOG.md、.agents/skills/、docs/development.md|发版/推前/排错|

改功能必同步改相关文档（去处见上表），PR 里文档与代码同 diff；只改代码不改文档的 PR 退回。
