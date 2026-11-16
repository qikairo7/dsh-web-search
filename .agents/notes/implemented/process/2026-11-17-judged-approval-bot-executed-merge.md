# Agent Note: 终审判断/执行分离——主账号批准、bot 合并发版

Status: implemented

## Problem

终审合并动作（squash merge、删分支、打 tag）与批准动作此前都由主账号执行；主账号高权限凭据被自动化链路直接用于日常机械操作。

## Decision

判断与执行分离：**APPROVE（判断）永远主账号**；merge / 删分支 / tag 推送（执行）交给 PR 作者 bot（低权限 PAT，随时可吊销）。同步改了三处指令源：final-review 图 act 节点、webhook 规则 spawn prompt（见 PM-0005——指令源必须全源同步）、pr-gate 文档表述（PR #43）。

## Alternatives considered

- **全程主账号（旧态）**：一处凭据完成全部动作，简单。落选：高权限凭据进自动化，审计上「判断」与「执行」不可区分。
- **bot 全程含批准**：完全去主账号化。落选：批准者是写代码者，破坏 self-PR 分权（GitHub 也禁止自批）。
- **人点合并键**：每 PR 一次人工。落选：维护者明确不想手动合并。

## Consequences

审计链变为 bot 实现 → bot 审查（不自批）→ 主账号 approve → bot merge/tag——每个动作身份明确；主账号凭据只剩「判断」用途。outcome.md 必须标注各动作执行身份。
