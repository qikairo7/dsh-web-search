## Summary

- 激活 `.agents/notes/` 决策记录体系，补落两篇当晚最重要的决策：
  - `rejected/process/2026-11-16-main-account-pr-author.md`——「交付 PR 改回主账号作者」提案及拒绝原因（批准者=写代码者破坏分权），含三个真实备选与折中方案（`user.name`+`user.email` 双固定，贡献图按 email 关联）。
  - `implemented/process/2026-11-17-judged-approval-bot-executed-merge.md`——判断/执行分离决策（主账号 approve、bot merge/tag），指令源三处同步（维护侧标注：图/规则/复盘均属维护仓库，仓库侧仅 pr-gate）。
- 终审 3 项 P3 全处置：P3-1 补 `user.email`；P3-2 维护侧归属标注；P3-3 维护仓库路径写明（与本仓库 docs/DETAIL.md 区分）。

## Evidence

- Before: 当晚重大决策只活在维护侧文档与会话记录，仓库决策体系零新增。
- After: 两篇 note 按模板落库（Status+四节+真实备选）；`pnpm check` 全绿；正文含 Revert 行过 pr-gate。

## Merge Danger

- Door: one-way
- Blast Radius: 纯文档；后续决策按此路径落 note。
- Revert: git revert the squash commit（删除两个 note 文件，无其它影响）。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
