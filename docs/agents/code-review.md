# 自动代码审查（本仓库的交付链）

本仓库的 PR 由一套自动化审查链把门：PR 开出后无需人工安排审查，机器审查 → 独立终审 → 合并全程自动推进。本文写给贡献者和 agent 会话：链怎么触发、结果在哪看、人如何介入。

## 触发与流程

PR 满足以下条件即自动进入审查（webhook 监听 `pull_request` opened/ready_for_review/reopened/synchronize）：

1. **审查**（bot `qikairo-review`）：并行三轴审查（标准对照 / 需求对照 / 质量视角），产出中文 review 正文与行内评论；有阻塞项时自动修复并重审（最多 3 轮）。
2. **终审**（仓库 owner 身份）：独立取证（CI 全表、互补抽查、发版信号）→ 四条合并门 → approve。
3. **合并**：squash + 删分支；PR 正文含 `Closes #N` 时 issue 自动关闭；版本已 bump 则打 tag 自动发版。

## 你会在 PR 上看到什么

- bot 的 review：结论（可批准 / 要求修改）、严重度表（P0-P3）、逐条发现带证据与最小修复建议。
- `dsh-review` check：审查完成的标记（CI 必过项）。
- 终审的 approve 正文即判定记录（证据五节）。

## 写 PR 时的配合

- 正文过 `scripts/check-pr-gate.mjs`（结构三节 + Evidence 只写实跑输出 + 徽章 + `Closes` 行）——CI 会机械拒绝不合格正文。
- 审查不信任正文声明：Evidence 写「已验证」的项会被抽查，not-run 项如实标注反而减分项更少。
- 历史惯犯规则在 `AI-REVIEW-LESSONS.md`，同规则再犯严重度从重；3 犯晋升进 `CODING_STANDARDS.md` 成为正式标准。

## 人工介入

- 在 AI 审查线程下直接回复即可（bot 会响应评论线程）。
- 紧急情况 owner 可随时手动合并/关闭；机器永不合并 CI 未绿的 PR。
