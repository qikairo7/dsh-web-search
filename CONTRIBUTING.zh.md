# 贡献

[English](CONTRIBUTING.md) | 中文

本仓库是一个 DSH 插件，按开源产品维护：Issue 和 PR 欢迎提交，行为变化会记录在 [CHANGELOG.md](CHANGELOG.md)。参与本项目即表示同意遵守 [CODE_OF_CONDUCT.zh.md](CODE_OF_CONDUCT.zh.md)。开始贡献前按顺序读：

1. [AGENTS.md](AGENTS.md)：常驻硬规则和入口指针。
2. [CODING_STANDARDS.md](CODING_STANDARDS.md)：实现与 Review 标准。
3. [docs/AGENTS.md](docs/AGENTS.md)：文档层级、事实归属和写作标准。
4. [docs/architecture.md](docs/architecture.md)：组合、模块和请求流。

## 开发流程

- 环境、命令和排错见 [docs/development.md](docs/development.md)。
- 测试策略见 [docs/testing.md](docs/testing.md)。
- 新增 Provider 见 [docs/cookbook/adding-a-provider.md](docs/cookbook/adding-a-provider.md)。

## 提交与 PR

- 从 `origin/main` 切工作分支，PR 对 `main`。
- 分支名用 2 到 3 个短词、连字符分隔，例如 `fix-router-fallback`。
- 提交信息和 PR 标题用 `type(scope): summary`；`type` 取 `feat`、`fix`、`docs`、`chore`、`refactor`、`test`。
- 提交前运行 `pnpm docs:check` 和 `pnpm check`。DSH 沙箱的 `spawn EPERM` 处理见 [开发指南](docs/development.md) 的「DSH 沙箱」节。
- PR 正文：按 [docs/pr-gate.md](docs/pr-gate.md) 执行。

## Review

Review 先按 [docs/defensive-patterns.md](docs/defensive-patterns.md) 检查 artifact 级规则，再按 [CODING_STANDARDS.md](CODING_STANDARDS.md) 的 Review 门禁逐项确认。任何一项不满足即阻塞合并。
