## Summary

- 新增 `docs/review-rules.md` 审查规则库——每条 **WHEN → THEN → BECAUSE**，BECAUSE 引用真实 PR 编号（方法论源自 OpenViking `.pr_agent.toml`）。这是「审查反馈回收」的落地：真实审查与事故 → 结构化规则 → 下轮审查按 trigger 匹配对照。
- 覆盖 11 条：文档一致性（R1 已机械化）/ 配置三态（R2）/ 批准声明不可信（R3）/ 字符预算与 LF（R4，预算清单指向 doc-budgets.json）/ 新导出与术语（R5，方向检查注明 PR#45 状态）/ 凭据测试纪律（R6）/ 复审轻量（R7）/ 边界举证（R8）/ 大 PR 建议拆分（R9）/ 生成物不审（R10）/ 安全视角 trigger（R14，Tessl 借鉴）。R11–R13 空缺预留说明在维护节。
- 终审 F1–F4 全处置：R4 删 PM-0006 引用改 LF 提示、R5 改条件表述、正文计数改 11 条并如实标注 6/11 带编号、docs/AGENTS.md 层级表合并登记（274858b 合并 main 时压缩 docs/agents/ 行 −4 码点以守 3500 预算，当时 3500/3500；re-merge #48 后 3470/3500）。

## Evidence

- Before: 审查纪律是原则性文本，无规则锚定真实事件。
- After: 11 条规则、6 条带 PR 编号（R1–R5、R7）；`pnpm check` 全绿；正文含 Revert 行过 pr-gate。

## Merge Danger

- Door: one-way
- Blast Radius: 纯文档；审查纪律资源随后指向本库。
- Revert: git revert the squash commit（删除单文件与一行登记，无其它影响）。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
