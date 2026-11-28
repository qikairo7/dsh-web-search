# dsh-web-search

免费后端实现 `ctx.web` 搜索/抓取 Provider，替换收费 DeepSeek Search/Fetch；`web_search`/`web_fetch` 由 `dsh-tool-web` 提供；AnySearch/Tavily/AIHOT 可选高级工具。

包管理器用 pnpm，门禁命令 `pnpm check`；提交前退出码必须为 0。

## 硬边界

- `lib/` 不调用 DeepSeek 付费 Search/Fetch API。
- 不新增 MCP server 或 `@modelcontextprotocol/*` 依赖。
- 不提交真实密钥或 `.credentials.yaml`；key 只从环境变量或 gitignored `.env` 读，不写进 shell 命令。

实现与评审标准见 [CODING_STANDARDS.md](CODING_STANDARDS.md)，安全边界与风险模型见 [SAFETY.zh.md](SAFETY.zh.md)，文档标准与目录见 [docs/AGENTS.md](docs/AGENTS.md)，领域文档阅读顺序见 [docs/agents/domain.md](docs/agents/domain.md)。

## 协作

- 一个 PR 只解决一个内聚问题，不夹带无关清理。
- 动手前先搜已有 issue 和 PR；报缺陷先按真实入口复现，记下实际输出。
- 删掉被替代的代码，不留死分支或兼容壳。
- 行为变化记录在 [CHANGELOG.md](CHANGELOG.md)。
- PR 正文写清改了什么、`Fixes #单号`、验证命令与输出；没跑的标 not-run。

开、关、评论、标记 issue 或 PR 之前见 [docs/issue-tracker.md](docs/issue-tracker.md)。
