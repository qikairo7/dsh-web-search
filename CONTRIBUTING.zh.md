# 贡献指南

本仓库是 DSH 的免费联网插件，为 `web_search` / `web_fetch` 提供免费的搜索与抓取后端。欢迎提交 issue 和 pull request。行为变化记录在 [CHANGELOG.md](CHANGELOG.md)。参与即表示你同意遵守 [CODE_OF_CONDUCT.zh.md](CODE_OF_CONDUCT.zh.md)。

开始前按顺序读 [AGENTS.md](AGENTS.md)、[CODING_STANDARDS.md](CODING_STANDARDS.md)、[docs/AGENTS.md](docs/AGENTS.md) 和 [docs/architecture.md](docs/architecture.md)。

## 我们重视什么

- 一个 pull request 只解决一个内聚问题，不夹带无关清理。
- 避免猜测式回退和提前抽象；只抽会被复用、有真实边界的逻辑。
- 删掉被替代的代码，不留死分支或兼容壳。
- 以上与 [CODING_STANDARDS.md](CODING_STANDARDS.md) 同源，以它为准。

## 开始之前

- 先搜已有 issue 和 pull request，避免重复。
- 报 Bug 前先用真实入口复现，记下实际输出。
- 改动会破坏配置或契约语义时，先开 issue 或写 ADR（[docs/adr/](docs/adr/)）再动手。

## 开发文档

- 开发流程与环境：[docs/development.md](docs/development.md)
- 测试：[docs/testing.md](docs/testing.md)
- 新增 Provider：[docs/cookbook/adding-a-provider.md](docs/cookbook/adding-a-provider.md)
- Review 门禁：[CODING_STANDARDS.md](CODING_STANDARDS.md#9-review-门禁) §9

## 安全边界

贡献前必读 [SAFETY.zh.md](SAFETY.zh.md)：不可信输入、凭据边界与风险模型以该文件为准；正常请求成功不能证明隔离有效。

## 提交与 PR

- 提交信息和 pull request 标题用 Conventional Commits 中文主题：`type(scope): 摘要`，`type` 取 `feat`、`fix`、`docs`、`chore`、`refactor`、`test`。
- 提交正文末尾带 `Verified-by: <方式>` 戳，如 `Verified-by: pnpm-check`；未验证写 `Verified-by: none <原因>`。
- PR 描述按 [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) 的各节填写。
- 分支从 `origin/main` 切出，PR 对 `main`；合并前 CI 与 `pnpm check` 必须全绿。

## 验证

- 提交前跑 `pnpm check`：语法、架构、order-doc 同步、文档代码块、翻译配对、docs:check、文档引用存活、单测共八段。
- 涉设置页或抓取行为的改动，按维护者本地 verify skill 规程（见 [docs/AGENTS.md](docs/AGENTS.md) 的维护者本地文件说明）做真机验证，把原始输出放进 PR 证据。
