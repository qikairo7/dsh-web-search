# Agent Note: 交付 PR 的作者身份由主账号改回（被拒绝）

Status: rejected — 维护者选择折中方案：commit 作者归主账号，PR 作者保持 bot（2026-11-17）

## Problem

交付链默认 bot（qikairo-review）开 PR，贡献图与 PR 列表均显示 bot，主账号（qikairo7）在仓库的可见贡献几乎为零。

## Proposal

改回主账号开 PR：交付链以主账号身份创建 PR，bot 只做审查。

## Alternatives considered

- **维持现状（bot 开 PR + 主账号终审批准）**：GitHub 规则要求的 approval 由主账号给出，分权最硬；主账号凭据不进自动化。落选原因：不解决贡献可见性问题。
- **主账号开 PR（本提案）**：贡献可见性最好。落选原因：终审批准退化为 bot 批准自己体系的产物——批准者=写代码者，GitHub 还禁止主账号批准自己的 PR，终审只能以评论形式留痕。
- **折中（采纳）**：仓库 `.git/config` 固定 `user.name=qikairo7` 与 `user.email`（主账号 noreply 邮箱）——commit author/committer 归主账号（GitHub 贡献图按 email 关联账号），推送认证、PR 作者、审查者仍是 bot；批准权留在主账号。分权看「谁批准」不看「谁提交」。

## Consequences

贡献图归主账号；若分支上已有旧身份提交，push 前统一 `git rebase --autostash origin/main --exec "git commit --amend --no-edit --reset-author"`。此决策路径见维护仓库 github-review-desktop 的 docs/DETAIL.md（与本仓库 docs/DETAIL.md 无关）角色与权限节。
