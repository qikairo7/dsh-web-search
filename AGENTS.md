# dsh-web-search

DSH 插件：实现 `ctx.web` 的搜索/抓取 Provider，用免费后端替换收费的 DeepSeek Search/Fetch；通用 `web_search`/`web_fetch` 仍由第一方 `dsh-tool-web` 提供；AnySearch/Tavily/AIHOT 是可选高级工具。

## 硬边界

- `lib/` 不调用 DeepSeek 付费 Search/Fetch API。
- 不新增 MCP server 或 `@modelcontextprotocol/*` 依赖。
- 不提交真实密钥或 `.credentials.yaml`；key 只从环境变量或 gitignored `.env` 读，不写进 shell 命令。

## 指针

- 日常 `pnpm check`；命令与排错见 `docs/development.md`。
- 改代码：`docs/architecture.md`；DSH 集成：`docs/dsh-host-contract.md`。
- 写代码/Review/Provider：`CODING_STANDARDS.md`、`docs/cookbook/adding-a-provider.md`。
- 配置/配额：README Behavior、`docs/configuration.md`。
- 改文档：`docs/AGENTS.md`；术语与 ADR：`GLOSSARY.md`、`docs/agents/domain.md`。
- 决策：`docs/adr/`、`.agents/notes/`。
- 推前检查：`.agents/skills/`。
