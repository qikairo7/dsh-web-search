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
- pstack 的 skill 和 playbook 里点名的执行者、模型、工具，按本机换。子代理一律用 subagent，模型和思考档查路由表。skill 里要派的子代理类型没有名字的，照它的意图派一路。两份子代理定义的原文在 docs/agents/ 下，派单时照原文用，模型按路由表。
- 单子按类型挑一份 playbook，带 bug 标签走 Bug fix，增强走 Feature，任务和重构走 Refactoring，开 PR 走 Opening a PR，盯 PR 走 Babysit，合并走 Shipping。playbook 在 poteto-mode skill 的 playbooks 目录下。
- 工具、执行者、模型怎么换，见 [docs/playbook-mapping.md](docs/playbook-mapping.md)。
- 对外的东西走流程。动 GitHub 之前加载 `github-roles`。评论和评审开头 @ 对方。说要开单，先开单再回复。开的人和验收的人各核一遍作者，读作者用 GraphQL 的 `author{login}`。
- PR 正文用 pr skill 的三节，节名用中文，概要、证据、合并风险。证据一节并排放改前和改后的输出。标题用 issue-tracker.md 里的格式。以 .github/PULL_REQUEST_TEMPLATE.md 为准。
- 不设评审环节。一张 PR 开出来走三样：确定性检查，`pnpm check` 和 CI；真跑一遍，由一个没写过这份代码的子代理做，照那张单的复现步骤跑，或者照 `.agents/skills/verify/` 驱动应用；跑过了用评审账号对着当前 head 发 approve，证据贴在 PR 上，跑不过发打回。三样齐了才合。合并前读 GitHub 上的真状态，不读子代理说它做了什么。
- 评论分两档。受理、关单、合并、进度、回应评审是填空，照 [docs/issue-tracker.md](docs/issue-tracker.md) 的话术表填，不读口吻材料。裁决、打回、范围重定才读维护者的口吻 DNA，只读那一份。文档不读 DNA，中文用 zh-tech-writing，英文用 google-dev-style。lieflat 整个不用。
- 发对外文本之前跑 `node scripts/check-outbound.mjs <正文文件> --at <对方账号>`；开头不是 @对方、含内部词、含 ASCII 引号或破折号，退出码 1，红了不发。检查和发送分两步跑。
- 派实现类单子之前先查占用：`gh pr list` 加 `git ls-remote origin 'refs/heads/issue-*'`，要开的分支名已经在就停。子代理每做完一个阶段往自己的实录末尾追加一行，写时间和做到哪；实录文件一开工就建。
- 三个图谱工具分工。改 `lib/` 之前跑 `codegraph affected <文件>`，它列出的测试全绿才算完，这一步只有 codegraph 管。谁调谁、架构概览、跨仓库、文档连代码，用 codebase-memory-mcp：先 `index_repository`，再 `trace_path` 或 `get_architecture`。它的测试收窄只支持 C 和 C++，`node --test` 的项目回 `run_all`，不拿它替 codegraph affected。graphify 不用。提交前想看改动落在哪几个社区、要不要拆提交，用 `git log` 和 codegraph，不过模型。
- 改了界面的单子只用宿主原生组件库 `@deepseek-ai/dsh-client-ui-primitives`，不加构建：`client.js` 里 `require` 它走宿主模块表，JSX 写成 `h(Comp, props)`。不吃全局那套设计系统。界面验收用 ego 起隔离实例截图，加 impeccable 和 anti-ui-slop 各过一遍。
- `ocr review --from main` 是开 PR 后可选的第一道筛子，意见当线索不当结论。两三天一次 `ocr review --from <上次的位置> --analysis --effort high` 全量过一遍，意见进攒着的表，重复出现的才动手。
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
