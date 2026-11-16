---
name: pr-description
description: 为 dsh-web-search 写 PR 正文时使用：结构、证据纪律、徽章与验证命令，一处说清，链接权威来源。仓库内所有交付链（agent 或人）开 PR 前都过这里。
---

# PR 正文写作（本仓库）

写 PR 正文时遵循本 skill；机械门禁在 `scripts/check-pr-gate.mjs`（正文结构不过会被 CI 拒）。

## 结构（三节固定顺序 + 徽章）

1. `## Summary`——改了什么、为什么；用最小视图（diff 树/伪代码）；**正文末尾单独一行 `Closes #<issue>`**（GitHub 只认正文关键字，评论不算）。
2. `## Evidence`——Before/After 对照；**只写实际跑过的命令与输出**；not-run 的如实标 not-run + 原因 + 剩余风险；绝不把未验证写成已验证（审查会抽查）。
3. `## Merge Danger`——`Door:` one-way 或 two-way 单独成行；`Blast Radius:` 一句话影响面。
4. 结尾单独一段官方徽章：`[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)`

## 提交前验证

```sh
node scripts/check-pr-gate.mjs --body-file <正文路径>
```

## 纪律细节

- 自动 PR（dependabot/renovate）跳过整个正文门禁。
- 占位词（TODO/TBD/待补充/待确认）会被机械拒绝——写结论，不写计划。
- 范围裁剪（何者不做、为何）写在 Summary，让审查不必猜。
- 完成清单与验收对照见 `CODING_STANDARDS.md` §6；PR 流程语境见 `docs/agents/issue-tracker.md`。
