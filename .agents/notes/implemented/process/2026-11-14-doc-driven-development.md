# Agent Note: 文档驱动开发

Status: implemented

## Problem

文档分散在 README、CODING_STANDARDS、ADR、docs/agents 和 docs/benchmarks；没有统一的事实归属、篇幅预算和机械检查。改代码时容易漏文档，文档之间也容易重复和漂移。

## Decision

- 根 `AGENTS.md` 只保留常驻硬规则和指针。
- `docs/AGENTS.md` 定义文档层级、事实归属、写作规则、预算和检查。
- `docs/architecture.md` 提供组合、模块、请求流和扩展点的有序地图。
- `.agents/notes/` 记录需要保留理由与被放弃方案的决策；ADR 继续记录契约级决策。
- `scripts/verify-docs.mjs` 检查必需文件、相对链接、代码围栏、尾随空格、README 的 Config 字段覆盖和默认值一致性；`pnpm check` 纳入该检查。
- 中文文档继续以 `tech-doc-style-chinese` 为标准。

## Alternatives considered

- **继续维护单一长 AGENTS.md**：所有规则和参考资料混在一个文件，常驻上下文成本高，且无法区分当前行为与历史决策；放弃。
- **完整照搬 DSH 的文档树**：本仓库只有 10 个 lib 模块，没有 subsystem、generated catalog、i18n 站点；照搬会增加空目录和维护成本；放弃。
- **只写文档不加机械检查**：文档会再次漂移，无法阻止 README 配置表与 `DEFAULT_SETTINGS` 脱节；放弃。

## Consequences

- 文档有了固定入口、事实归属和预算；改代码时需要同步更新对应的唯一文档。
- `pnpm check` 多一个无网络文档门禁；文档改动可以单独跑 `pnpm docs:check`。
- README 仍是用户可见行为与配置的唯一事实来源；ADR 与 Agent Notes 不复制当前值。
