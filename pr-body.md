## Summary

- 新增 `docs/agents/code-review.md`：本仓库自动审查链的**贡献者/agent 视角**文档（对齐 DSH `maintaining-dsh-code-review` 模式）——此前审查链对仓库文档完全隐形。
- 内容四节：触发与三步流程（audit 审查→主账号终审→bot 合并，含三身份分工）、PR 上会看到什么、写 PR 的配合（机械门禁清单、证据纪律、错题本从重）、人工介入路径。
- 终审 P2/P3 全处置：F1 审查者身份改 `qikairo-audit[bot]`（含可 APPROVE 说明）；F2 门禁括注改为真实机械检查项并链接 `docs/pr-gate.md`；F4 触发条件补 `allowedAuthors`；F5 域导航入口；F6 五门/遗留清单更新。

## Evidence

- Before: 自动审查链知识只在维护侧 DETAIL.md，仓库无一处提及。
- After: `pnpm check` 全绿（含新并 main 的五道门禁）；正文含 Revert 行过 pr-gate。

## Merge Danger

- Door: one-way
- Blast Radius: 纯文档新增；审查链行为不变。
- Revert: git revert the squash commit（删除单文件，无其它影响）。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
