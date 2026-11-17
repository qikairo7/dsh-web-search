# AI Review Lessons

这是 AI review 的错题本。只记录 P0/P1；P2/P3 留在 review 评论里，不进入本文件。记录从表格最后一行下方追加，不在表格行之间插入其他内容。

## 记录格式

| ID | 规则 | 为什么 | 证据 | Seen | 状态 |
|---|---|---|---|---|---|
| R-001 | 相关性门不得让单一信号一票否决整批判 0 | 2–3 字母查询词难进 title 强词表，误杀触发付费尾接答 | PR#33 bing.js:75「go 2」配 2 条 go.dev 结果判 0 抛 WEB_PROVIDER_ERROR | 1 | open |
| R-002 | 分类判据须对每个错误来源核对真实字段名 | 读不到状态落 unknown，白名单收窄后回退立即中止 | PR#34 errors.js:97 读不到 providers/http.js status 与 anysearch httpStatus | 1 | open |
| R-003 | 规则正文写当前状态，不嵌决策日期或变更史 | 执行规则不需要日期，决策史已有 ADR 与 notes 专属位置 | PR#43 pr-gate.md:53 行内嵌（判断/执行分离，2026-11-17） | 2 | open |
| R-004 | 改钩子/门禁行为须同步 README 与 development.md | 文档与实现矛盾误导贡献者，自动检查拦不住 | PR#48 check 加 check-doc-code 后 AGENTS.md:14 等 4 处仍写旧三段 | 4 | promoted |
| R-005 | lint 执行的规则须先有成文出处 | 门禁放行未成文豁免，声明与事实不符 | PR#45 check-architecture.mjs:16 lib/tools 归层未成文 | 1 | open |
| R-006 | 门禁 spawnSync 外部 checker 须分流 result.error | 进程没跑成会被误报成内容语法失败，掩盖环境问题 | PR#48 check-doc-code.mjs:54 ENOENT 时 status=null 被判失败报 parse error | 1 | open |
| R-007 | 非发版不得上调 doc-budgets 让门禁变绿 | 成文政策要发版才重定基线，增量应压缩或迁移 | PR#49 doc-budgets.json AGENTS.md 2000→2100，head 实测 2071 | 1 | open |
| R-008 | skill 引用的测试或脚本必须真实存在 | 虚构守护测试让读者误以为已有自动门禁 | PR#49 pre-push-checks:24 引 test/bench.test.js 不存在 | 1 | open |
| R-009 | 流程细节不复制成文文档，链接权威来源 | 复制必漂移，一个事实只有一个家 | PR#49 pr-description/SKILL.md 大段复制 pr-gate.md 且已漂移 | 1 | open |
| R-010 | PR 正文 Evidence 只写实际验证过的结果 | 不实证据误导审查与合并决策 | PR#49 正文称仓库不带流程知识，base 已有 docs/pr-gate.md | 1 | open |
<<<<<<< HEAD
| R-011 | 版本文档声称的门禁/断言须在合并目标分支逐项核实 | 把计划或未合并的门写成已有，贡献者误信 CI 会拦 | PR#50 0.13.0.md:27 称架构方向门与性能下限断言，origin/main 均无 | 1 | open |
| R-012 | `--record` 重建基线前须核结构对称，失败拒写盘 | 结构不对称时静默丢整对基线，此后单侧漂移不报警 | PR#51 translation-pairing.mjs:85 EN 多一节 --record 仍报 recorded: 2 files | 1 | open |
| R-013 | 按序号配对的门禁须校验录制后节结构未变 | 插删节后 ordinal 错位、单侧改节标题逃逸，均漏报 | PR#51 translation-pairing.mjs:79 双侧插节后单侧改英文仍 exit 0 | 1 | open |
=======
>>>>>>> origin/main

字段说明：

- `规则`：一句话说明下次必须怎么做。
- `为什么`：说明错误后果，不写空泛原则。
- `证据`：写实际观察到的命令输出、文件位置或失败现象。没有实际证据时不要新增记录。
- `Seen`：同一规则在不同 review 中出现的次数；同一 PR 的重复评论只算一次。
- `状态`：`open`、`promoted` 或 `obsolete`。

## 晋升

每次 review 发现 P0/P1 时，在临时 worktree 的本文件中新增或更新一行；同一规则 `Seen` 达到 3 后，按 `CODING_STANDARDS.md` 第 10 节晋升。晋升和修复一起提交；没有修复时在 review 正文说明。不记录密钥、token、用户隐私或无法复现的猜测。
