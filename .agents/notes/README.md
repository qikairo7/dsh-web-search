# Agent Notes

Agent Note 记录代码和文档无法承载的决策理由：为什么这样做、放弃了什么、以后怎么判断它仍然成立。它不替代 README 的当前行为说明，也不替代 ADR 的契约级决策。

## 目录与命名

路径格式：`{lifecycle}/{class}/yyyy-mm-dd-topic.md`。

- `lifecycle`：`proposed`、`implemented`、`rejected`、`archived`。
- `class`：`feature`、`bug-fix`、`simplification`、`architecture`、`process`、`testing`。
- 日期是主题首次提出的日期。不要新增集中式 `INDEX.md`。

## 什么时候写

- 决策会影响后续维护，且代码、测试和现有文档解释不了「为什么」与「放弃了什么」。
- 尚未实施的较大改动写 `proposed`；已经落地的决策写 `implemented`。
- 机械修改、局部 UI 调整、纯格式化不需要 Agent Note。
- 决策被推翻时新增一份并互相链接，不把旧 note 改写成相反的决策。

## 文件格式

`implemented` 使用：

```markdown
# Agent Note: <title>

Status: implemented

## Problem

## Decision

## Alternatives considered

## Consequences
```

`proposed` 使用 `## Problem`、`## Proposal`、`## Alternatives considered`、`## Acceptance criteria`、`## Risks`。`rejected` 保留提案内容，并在 `Status:` 行写一行拒绝原因。

每份 note 必须有 `## Alternatives considered`：列出真实考虑过的方案，以及各自为什么落选。不要编造未发生过的备选。

新笔记正文用中文；代码、路径、标识符与机器可读内容原样保留。

## 维护

- `implemented` 记录要与实际落地的路径、名称、默认值和机制同步；只改事实，不改决策。
- `proposed` 记录提案和实施前的验收标准；落地后移入 `implemented/`，拒绝后移入 `rejected/`。
- `rejected` 记录拒绝原因和备选方案，保留到不再有参考价值为止。
- `archived` 是冻结历史，不再作为当前行为依据，不再编辑。
- 当前记录：[2026-11-14 文档驱动开发](implemented/process/2026-11-14-doc-driven-development.md)。
