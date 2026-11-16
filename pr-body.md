## Summary

- 借鉴 DSH「AGENTS.md 是路由层、流程知识活在 `.agents/skills/` 仓库内 skill 库」的架构，新增两个种子 skill：
  - `.agents/skills/pr-description/SKILL.md`——本仓库 PR 正文写作（结构、Evidence 纪律、Closes 行、徽章、验证命令），链回权威来源。
  - `.agents/skills/pre-push-checks/SKILL.md`——推前检查按改动面选最小集（表格化：改 providers/纯文档/门禁脚本/配置/只有测试各跑什么），不默认全量、不重复已过的检查；CI 负责穷尽覆盖。
- `AGENTS.md` 指针节路由化：两处改为 skill 链接引用；指针节措辞压缩（事实零丢失）+ 预算 2000→2100（新增流程路由是真实内容，按预算政策"内容真实需要时提上限"）。

## Evidence

- Before: 流程知识活在用户目录与外部 bundle 文档，仓库自身不带——fork/换机即丢。
- After: `.agents/skills/` 两个 SKILL.md 落库；AGENTS.md 2071/2100；`pnpm --config.node-linker=hoisted check` 全绿（含 docs 预算门禁过）。

## Merge Danger

- Door: one-way
- Blast Radius: 纯文档与预算一行；后续新 skill 按此模式长在 `.agents/skills/` 下即可。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
