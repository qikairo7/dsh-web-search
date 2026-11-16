# AI Review Lessons

这是 AI review 的错题本。只记录 P0/P1；P2/P3 留在 review 评论里，不进入本文件。

## 记录格式

| ID | 规则 | 为什么 | 证据 | Seen | 状态 |
|---|---|---|---|---|---|
| R-001 | 示例：临时 worktree 安装依赖时必须使用 hoisted 布局 | 默认布局在 Windows junction 下找不到 `@deepseek-ai/schemastery` | PR #23 的 `pnpm check` 失败输出 | 0 | open |

字段说明：

- `规则`：一句话说明下次必须怎么做。
- `为什么`：说明错误后果，不写空泛原则。
- `证据`：写实际观察到的命令输出、文件位置或失败现象。没有实际证据时不要新增记录。
- `Seen`：同一规则在不同 review 中出现的次数；同一 PR 的重复评论只算一次。
- `状态`：`open`、`promoted` 或 `obsolete`。

## 晋升规则

1. 每次 review 发现 P0/P1，先在临时 worktree 的 `AI-REVIEW-LESSONS.md` 中新增或更新一行。
2. 同一规则 `Seen` 达到 3 时，在 `CODING_STANDARDS.md` 第 10 节增加一条可执行规则，并把该行状态改为 `promoted`。
3. 晋升和修复一起提交；如果没有代码修复，就在 review 正文中说明建议晋升的规则，不单独改 main。
4. 不记录密钥、token、用户隐私或无法复现的猜测。
