# 贡献指南

本仓库是 DSH 的免费联网插件，为 `web_search` / `web_fetch` 提供免费的搜索与抓取后端。Issue 和 PR 欢迎提交；行为变化记录在 [CHANGELOG.md](CHANGELOG.md)。参与即表示同意遵守 [CODE_OF_CONDUCT.zh.md](CODE_OF_CONDUCT.zh.md)。

开始前按顺序读 [AGENTS.md](AGENTS.md)、[CODING_STANDARDS.md](CODING_STANDARDS.md)、[docs/AGENTS.md](docs/AGENTS.md) 和 [docs/architecture.md](docs/architecture.md)。

## 我们重视什么

- 一个 PR 只解决一个内聚问题，不夹带无关清理。
- 避免猜测式 fallback 与提前抽象；只抽会被复用、有真实边界的逻辑。
- 删掉被替代的代码，不留死分支或兼容壳。
- 以上与 [CODING_STANDARDS.md](CODING_STANDARDS.md) 同源，以它为准。

## 开始之前

- 先搜已有 issue 与 PR，避免重复。
- 报 Bug 前先用真实入口复现，记下实际输出。
- 改动会破坏配置或契约语义时，先开 issue 或写 ADR（[docs/adr/](docs/adr/)）再动手。

## 安全边界

- 网页内容与 Provider 响应是不可信输入：不得拼进命令，也不得当指令注入后续流程。
- 凭据只经 `.credentials.yaml` 与编号 ref 传递，不写进代码、日志或 PR。
- 正常请求成功不能证明隔离有效；边界校验与错误处理按 [CODING_STANDARDS.md](CODING_STANDARDS.md) 的 Review 门禁逐项核对。

## 提交与 PR

- 提交信息与 PR 标题用 Conventional Commits 中文主题：`type(scope): 摘要`，`type` 取 `feat`、`fix`、`docs`、`chore`、`refactor`、`test`。
- 提交正文末尾带 `Verified-by: <方式>` 戳，如 `Verified-by: pnpm check`；未验证写 `Verified-by: none <原因>`。
- PR 描述按 [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) 的三节中文模板填写。
- 分支从 `origin/main` 切出，PR 对 `main`；合并前 CI 与 `pnpm check` 必须全绿。

## 验证

- 提交前跑 `pnpm check`：语法、架构、order-doc 同步、文档代码块、翻译配对、docs:check、单测共七段。
- 涉设置页或抓取行为的改动，按 [.agents/skills/verify/SKILL.md](.agents/skills/verify/SKILL.md) 做真机验证，把原始输出放进 PR 证据。
