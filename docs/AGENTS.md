# 文档标准

本文件是文档体系的唯一 schema 真源：层级、事实归属、写作规则、篇幅预算与机械检查。概要与规则在本文，明细表在子文件（见目录）。根 `AGENTS.md` 只放会话硬规则；实现规则在 `CODING_STANDARDS.md`，不重复。

## 目录

| 文件 | 内容 |
|---|---|
| [docs/schema-inventory.md](schema-inventory.md) | 文档层级明细：每个文件的唯一职责与排除项 |
| [docs/schema-sync-map.md](schema-sync-map.md) | 改代码时改哪份文档：映射表与开发顺序 |
| [docs/postmortem/](postmortem/README.md) | 事故叙事层：incident-scoped reference，一条事故一份；记时间线、影响、根因、教训 |
| [docs/writing-rules.md](writing-rules.md) | 写作判据：完整命题、覆盖分层、删字 vs 删事实 |

## 路由

按任务查文档去处：

| 任务 | 去处 | 触发时机 |
|---|---|---|
| 配置 / 配额 | [configuration.md](configuration.md) | 查配置 |
| 架构 / 调用关系 | [architecture.md](architecture.md)、[dsh-host-contract.md](dsh-host-contract.md) | 改代码/查调用/重建 |
| 标准 / Review | [CODING_STANDARDS.md](../CODING_STANDARDS.md)、[cookbook/adding-a-provider.md](cookbook/adding-a-provider.md) | 写/评审 |
| 文档 / 术语 / 决策 | 本文、[GLOSSARY.md](../GLOSSARY.md)、[adr/](adr/) | 文档/术语 |
| 发版 / 推前 / 排错 | [CHANGELOG.md](../CHANGELOG.md)、[development.md](development.md) | 发版/推前/排错 |

改功能必须同步改相关文档，PR 里文档与代码同 diff；同步映射与开发顺序见 [schema-sync-map.md](schema-sync-map.md)。

## 动手前先读什么

[docs/agents/domain.md](agents/domain.md) 给出领域文档与 ADR 的阅读顺序。

## 写作规则

- 写当前状态，不写变更史；历史放 ADR、提交或 CHANGELOG。
- 一个事实只有一个家；其他文档链接而来，不复制。
- 先判断文档类型：教程按步骤到结果，参考按查找范围定义当前行为。README 安装段是教程，Behavior 与 `configuration.md` 是参考。
- 中文段落一段一行，不按显示宽度硬换行；代码块、表格、列表保持结构。
- 代码围栏命令必须可执行；占位符写 `<...>`，别伪装真实值。
- 相对链接必须指向真实文件；不用提交号做当前引用。
- 不写实现状态注记（「已实现」「未来会」）、测试走读、评审过程或赘述代码。
- 正文中文，代码与标识符原样；英文镜像 README.en.md、DETAIL.en.md、法律文件；历史记录不改写，新条目从中文开始。
- 两份 README 同步；契约变化先写 ADR。
- 写作判据见 [写作判据](writing-rules.md)，ADR 写法见 [ADR 索引](adr/README.md)。

## 篇幅预算

- 预算在 `scripts/doc-budgets.json`，按 Unicode 字符数计算。
- `pnpm docs:check` 检查预算、必需文件、相对链接、代码围栏、尾随空格、`docs/configuration.md` 的 Config 字段覆盖、默认值一致性、双语结构，以及 `docs/subsystems/providers.md` 生成表与 `lib/catalog.js` 的新鲜度（`pnpm docs:gen` 重生成）。
- 预算重定基线只发生在「文档增长处置阶梯」第 3 级授权的时点；发布之间的增量先按阶梯处置。不要为让门禁变绿改预算或跳过检查。

## 文档增长处置阶梯

预算超标是结构信号，不是删减理由。按级处置，逐级无效才进下一级：

删字凑预算不属于任何一级处置；贴顶或超标的第一处置是第 2 级拆分，重定基线仅限第 3 级列明的授权时点。

1. 移除空操作：重复指令、失效引用（`pnpm check` 的文档引用存活检查自动抓）。
2. 渐进披露拆分：主文件留概要、目录与入口，细节移子文件；新子文件登记进本文目录与 `scripts/doc-budgets.json`。
3. 预算重定基线：发版时点，或文档改动获得维护者明示授权时；重定值按当前长度向上取整到千位。
4. 删减：最后手段；PR 须写明删的是冗余还是事实，删事实必须写明新归属。

## 机械检查

```sh
pnpm docs:check
pnpm check        # 语法 + 架构 + order-doc 同步 + 文档代码块 + 翻译配对 + docs:check + 文档引用存活 + node --test
```

`pnpm check` 是提交门禁；`docs:check` 可单独快速运行。
