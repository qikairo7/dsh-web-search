# Agent Note: Intent-routed orders should honor user-configured search orders

Status: rejected — intent 派生顺序就是 ADR-0009 的配额保护层；`intentRouting: false` 已提供「全部尊重自定义顺序」的逃生口，改行为只增加付费配额风险而不新增能力（2026-11-15 决策，含 configuration.md 措辞修正）

## Problem

`intentRouting: true`（默认）时，`fastOrder()` 对 news/technical 查询返回硬编码顺序（现为由 catalog 派生的免费前缀 + 付费尾），用户配置的 `chineseSearchOrder` / `defaultSearchOrder` 只在 general/chinese-community 分支生效。`docs/configuration.md` 描述这两个设置是「Fast-mode search order」，与实际行为不符；`test/intent.test.js` 目前把该绕过固化断言为契约。这是 2026-11-15 架构评审候选 A 中唯一未随结构深化落地的行为语义。

## Proposal

intent 命中的分支改为以用户配置顺序为骨架重排：保留 intent 语义（如 AI 新闻把 aihot 提前、news 启用新闻路由）只做「提升/降级」调整，而不是整体替换顺序；或提供独立的 intent order 设置。需先决定哪个语义是产品意图，再同步 `docs/configuration.md`、两份 README 与测试。

## Alternatives considered

- 保持现状（intent 字面量优先）：已选为过渡——本次深化保持行为不变，只把顺序知识收归 catalog 单一来源，让后续行为决策变成一张表上的改动。
- 为每个 intent 增加可配置顺序字段：落选于本轮，设置面扩大需要用户价值论证。

## Acceptance criteria

- `intentRouting: true` 时自定义 `chineseSearchOrder` / `defaultSearchOrder` 对 news/technical 查询有可解释的生效方式（完全生效或文档化的调整规则）。
- `docs/configuration.md` 与两份 README 的 Behavior 描述与实现一致；测试从「固化绕过」改为「固化新语义」。
- 默认行为（未自定义顺序）与现状逐字节一致。

## Risks

- 用户依赖现有 intent 顺序绕过行为（例如特意把某付费后端排前）会被语义变化影响，需要在 README 变更说明中明示。
