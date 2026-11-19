# Agent Note: README 文本图形（mdxcn）在 GitHub 的中文对齐不可行（被拒绝）

Status: rejected — GitHub 等宽字体下 CJK 非精确双宽，中文虚线框错位，已撤回标准 Markdown（2026-11-19）

## Problem

旧版把 README 的 Status、Non-goals 与快速开始做成了 mdxcn 文本图形（虚线框 ASCII 盒），前提是等宽字体里每个 CJK 字符占 2 列、框线可以对齐。用户在 GitHub 上验收发现中文内容的框线全部错位，排版坏了。review-112 当时按「CJK=2 列」的假设验证过，但真实字体栈下这个假设不成立。

## Proposal

在 README（中英双语）用 mdxcn 文本图形呈现 Status、Non-goals 与快速开始三块，靠字符画换来更强的视觉分区（PR #112 已实施，后被撤回）。

## Alternatives considered

- **mdxcn 文本图形（本提案，已撤回）**：视觉分区强。落选原因：GitHub 等宽字体栈下 CJK 字符宽度不是精确 2 列，中文虚线框框线错位，用户验收截图实锤。
- **标准 Markdown（引用块 + sh 代码围栏，采纳）**：Status 与 Non-goals 用引用块，快速开始用 `sh` 代码围栏，跨字体稳定，并恢复 check-doc-code 对命令的 bash 语法校验。本 PR 已改回此方案。

## Consequences

mdxcn 文本图形只在纯 ASCII 内容上于 GitHub 成立；含中文的图形不可用。若未来 GitHub 等宽字体或渲染器变化（例如改用真正双宽 CJK 字体），可重新评估重试。
