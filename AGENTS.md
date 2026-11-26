# dsh-web-search

免费后端实现 `ctx.web` 搜索/抓取 Provider，替换收费 DeepSeek Search/Fetch；`web_search`/`web_fetch` 由 `dsh-tool-web` 提供；AnySearch/Tavily/AIHOT 可选高级工具。

包管理器用 pnpm，门禁命令 `pnpm check`；提交前退出码必须为 0。

## 硬边界

- `lib/` 不调用 DeepSeek 付费 Search/Fetch API。
- 不新增 MCP server 或 `@modelcontextprotocol/*` 依赖。
- 不提交真实密钥或 `.credentials.yaml`；key 只从环境变量或 gitignored `.env` 读，不写进 shell 命令。

实现与评审标准见 [CODING_STANDARDS.md](CODING_STANDARDS.md)，安全边界与风险模型见 [SAFETY.zh.md](SAFETY.zh.md)，文档标准与目录见 [docs/AGENTS.md](docs/AGENTS.md)，领域文档阅读顺序见 [docs/agents/domain.md](docs/agents/domain.md)。

## 工作方式

- 主会话只做规划，澄清、拆解、定契约、派活、验收、记决策日志。要写的文件超过一个，或者要对外写，就派子代理。例外是只读问答、复盘结论合并、单文件小脚本、收尾操作。
- 动手前先查三处，本地笔记、本地 skill、上游。三处都没有才自己写，并在派单里写明查过哪三处。
- 派活前查 `~/.dsh/MODEL-ROUTING.md`，调 `subagent` 时 `provider` 填 `magpie`，派之前跑一次 `list_subagent_models`。
- 派单末尾带一段固定的四行，在 `.agents/notes/takeover/dispatch-fixed.md`。那份文件被 gitignore，所以这里把四行原样抄一遍，以仓库里这份为准：
  - 模型照 `~/.dsh/MODEL-ROUTING.md`，派之前跑一次 `list_subagent_models`。
  - 动 GitHub 之前加载 `github-roles`，改 `lib/` 之前先跑 `codegraph affected <文件>`。
  - 环境坑读 `~/.dsh/TOOLS.md`。
  - 交活前加载 `retro` 做复盘，读自己的上下文，按七个类别找候选。
- 对外的东西走流程。动 GitHub 之前加载 `github-roles`。评论和评审开头 @ 对方。说要开单，先开单再回复。开的人和验收的人各核一遍作者，读作者用 GraphQL 的 `author{login}`。
- 只报真结果。没跑的说没跑。错了追加一条更正，不改老行。
- 每个子代理交活前加载 `retro` 做复盘，读自己的上下文，按七个类别找候选，写在交付文件的末节。只读的也做。
- 验收只认用 npm 装的 `dsh` 起的隔离 web 实例加 ego 浏览器。桌面端有 token 鉴权，ego 拿不到。
- 决策日志只写飞书。本地不再记。

## 协作

- 一个 PR 只解决一个内聚问题，不夹带无关清理。
- 动手前先搜已有 issue 和 PR；报缺陷先按真实入口复现，记下实际输出。
- 删掉被替代的代码，不留死分支或兼容壳。
- 行为变化记录在 [CHANGELOG.md](CHANGELOG.md)。
- PR 正文写清改了什么、`Fixes #单号`、验证命令与输出；没跑的标 not-run。

开、关、评论、标记 issue 或 PR 之前见 [docs/issue-tracker.md](docs/issue-tracker.md)。
