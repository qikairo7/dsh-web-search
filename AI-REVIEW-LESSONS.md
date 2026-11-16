# AI Review Lessons

这是 AI review 的错题本。只记录 P0/P1；P2/P3 留在 review 评论里，不进入本文件。记录从表格最后一行下方追加，不在表格行之间插入其他内容。

## 记录格式

| ID | 规则 | 为什么 | 证据 | Seen | 状态 |
|---|---|---|---|---|---|
| R-001 | 相关性门不得让单一信号一票否决整批判 0 | 2–3 字母查询词难进 title 强词表，误杀触发付费尾接答 | PR#33 bing.js:75「go 2」配 2 条 go.dev 结果判 0 抛 WEB_PROVIDER_ERROR | 1 | open |
| R-002 | 分类判据须对每个错误来源核对真实字段名 | 读不到状态落 unknown，白名单收窄后回退立即中止 | PR#34 errors.js:97 读不到 providers/http.js status 与 anysearch httpStatus | 1 | open |
| R-003 | 规则正文写当前状态，不嵌决策日期或变更史 | 执行规则不需要日期，决策史已有 ADR 与 notes 专属位置 | PR#43 pr-gate.md:53 行内嵌（判断/执行分离，2026-11-17） | 1 | open |

字段说明：

- `规则`：一句话说明下次必须怎么做。
- `为什么`：说明错误后果，不写空泛原则。
- `证据`：写实际观察到的命令输出、文件位置或失败现象。没有实际证据时不要新增记录。
- `Seen`：同一规则在不同 review 中出现的次数；同一 PR 的重复评论只算一次。
- `状态`：`open`、`promoted` 或 `obsolete`。

## 晋升

每次 review 发现 P0/P1 时，在临时 worktree 的本文件中新增或更新一行；同一规则 `Seen` 达到 3 后，按 `CODING_STANDARDS.md` 第 10 节晋升。晋升和修复一起提交；没有修复时在 review 正文说明。不记录密钥、token、用户隐私或无法复现的猜测。
