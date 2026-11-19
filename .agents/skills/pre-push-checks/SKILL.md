---
name: pre-push-checks
description: 在 dsh-web-search 推送分支前使用：按改动面选最小够用的检查，不全量重跑、不重复已过的检查。CI 负责穷尽覆盖与平台矩阵。
---

# 推前检查（本仓库）

推分支前按**改动面**匹配证据，不默认全量、不为提交仪式重复跑已过的检查。

## 按改动面选

| 改了什么 | 跑什么 |
|---|---|
| `lib/providers/*` 或路由 | 相关单测文件 + 全量 `pnpm check`（顺序/架构/文档门禁都在里面）|
| 纯文档（*.md） | `pnpm docs:check`（预算 + configuration.md 顺序默认值对 roles.js 的机械对账 + 双 README 互对账；README 粘贴链对账在 check-order-sync，含于 `pnpm check`）；改顺序表述必跑 |
| `scripts/` 门禁脚本 | 对应测试文件 + 一次全量 check（门禁本身影响全局）|
| 配置（SETTINGS_SPEC/patch.yml） | 全量 check + 确认 `docs/configuration.md` 与双 README 同步（verify-docs 会查）|
| 只有测试 | 只跑该测试文件 |

## 硬规矩

- 汇报只写**实际跑过的**命令与结果。
- 按上表选检查省的是证据轮；`.githooks/pre-push` 每次推送仍无条件全量 `pnpm check` 兜底，中途多笔提交只过语法门。
- 基准（`pnpm benchmark`）永远手动：调外部 API，噪声大，不做门禁；性能下限有 `test/bench.test.js` 的量级 floor 自动门禁。
- CI 才负责三配置矩阵（ubuntu-latest×node 22/24、windows-latest×node 24）、CodeQL、穷尽覆盖；本地不重复排练。
