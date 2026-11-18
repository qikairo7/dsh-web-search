# 文档标准

本文件定义本仓库的文档层级、事实归属、写作规则、篇幅预算和机械检查。根 `AGENTS.md` 只放每次会话都需要的硬规则；实现规则在 `CODING_STANDARDS.md`；本文件不重复两者。

## 文档层级

| 文件 | 职责 | 不放在这里 |
|---|---|---|
| `AGENTS.md` | 每次会话都需要的硬规则和入口指针，每条 1 到 3 行 | 教程、示例、可推导的细节 |
| `CODING_STANDARDS.md` | 实现与 Review 的唯一标准：契约、实现原则、测试、完成门禁 | 当前默认值、行为说明 |
| `AI-REVIEW-LESSONS.md` | P0/P1 错题本和晋升候选；规则正文在第 10 节 | 实现规则、行为说明 |
| `README.md` / `README.zh.md` | 用户可见事实：安装、凭据、Provider、行为、配额；两份同步 | 内部实现细节、决策历史、完整配置表 |
| `docs/configuration.md` | 完整配置字段、默认值与说明；README 链接到这里 | 行为教程、实现规则 |
| `docs/development.md` | 贡献者安装、日常命令、CI、环境变量和排错 | 实现规则、产品行为 |
| `docs/testing.md` | 测试层级、运行时机和真实 API 验收策略 | 具体命令清单、实现细节 |
| `docs/pr-gate.md` | PR 交付门禁、正文结构和提交前检查 | 实现规则、产品行为 |
| `docs/cookbook/` | 带步骤和验收清单的 how-to，例如新增 Provider | 设计理由、当前行为说明 |
| `docs/defensive-patterns.md` | 按 artifact 展开的 Review 规则 | 决策历史、配置默认值 |
| `docs/architecture.md` | 组合、模块职责、请求流、扩展点的有序地图 | 单函数细节、配置默认值 |
| `docs/dsh-host-contract.md` | DSH 宿主契约、tool-web 渲染与 preset 作用域、内部排查路径 | 当前插件行为、配置默认值 |
| `docs/adr/` | 已接受的契约级决策；一条决策一份，历史记录不改写 | 当前行为说明、迁移计划 |
| `.agents/notes/` | 需要保留「为什么、放弃了什么」的决策记录；格式见目录 README | 当前行为说明、任务清单、测试走读 |
| `GLOSSARY.md` | 项目术语的唯一写法 | 实现细节 |
| `docs/agents/` | 代理工作流：领域文档、Issue/PR 操作 | 产品行为 |
| `docs/benchmarks/` | 历史基准报告与复现命令；数字和日期不改写 | 当前配置默认值 |
| `CONTRIBUTING.md` / `CONTRIBUTING.zh.md` | 贡献入口和阅读顺序 | 详细实现规则 |
| `SAFETY.md` / `SECURITY.md` / `TRADEMARKS.md` / `THIRD_PARTY_NOTICES.md` | 风险模型、漏洞报告、项目身份与第三方归属 | 使用教程、实现规则 |
| `CHANGELOG.md` | 面向用户的版本变化公告，每个已发版一条 | 实现细节、决策理由、未发版的重构 |
| `BENCHMARK.md` | 基准入口、运行规则和指标说明 | 历史报告数据 |
| `docs/AGENTS.md` | 本文件 | 实现规则 |
| `.agents/skills/`、`docs/review-rules.md` | skill 与审查规则库 |

## 改代码时改哪份文档

| 改动 | 必须同步 |
|---|---|
| Provider 行为、配额、Provider 表 | `README.md` 与 `README.zh.md` 的 Behavior / 行为与免费额度说明；配置字段、默认值与说明的完整表在 `docs/configuration.md`；代码事实是 `lib/settings.js` 的 `DEFAULT_SETTINGS`；需要改随包默认时同步 `cordis.patch.yml` |
| 模块、依赖方向、请求流、扩展点 | `docs/architecture.md` |
| 开发流程、环境变量、CI 或排错 | `docs/development.md` |
| 测试层级、运行时机或真实 API 验收 | `docs/testing.md` |
| 新增 Provider 或其他扩展步骤 | `docs/cookbook/` |
| Review 的 artifact 级细节 | `docs/defensive-patterns.md` |
| 契约级决策，例如 provider id、能力缝、持久格式 | `docs/adr/` 新增 ADR；不改写已接受 ADR 的决策 |
| 需要保留理由与被放弃方案的决策 | `.agents/notes/{lifecycle}/{class}/yyyy-mm-dd-topic.md` |
| 术语 | `GLOSSARY.md` |
| 基准结果 | `docs/benchmarks/`；保留原始数据与复现命令 |
| 实现规则、Review 门禁 | `CODING_STANDARDS.md` |
| Issue 与 PR 流程 | `docs/agents/issue-tracker.md` |
| 版本发布 | `CHANGELOG.md` 增加对应版本段落，行为变化写明对用户可见的影响 |

## 开发顺序

1. 先确定这次改动改变哪条事实，找到它的唯一 home；需要新决策先写 ADR 或 Agent Note。
2. 先改文档中的目标行为（信息不足时标「待确认」），再改代码和测试。
3. 最后同步 README、架构文档或 Agent Note，运行 `pnpm docs:check` 和 `pnpm check`。

## 写作规则

- 写当前状态，不写变更史；历史放 ADR、Agent Note、提交信息或基准报告。
- 一个事实只有一个家；其他文档链接到它，不复制。
- 先判断文档类型：教程按步骤到结果，参考按查找范围定义当前行为。README 的安装段是教程，Behavior 与 `docs/configuration.md` 是参考。
- 中文段落一段一行，不在源文件里按显示宽度硬换行；代码块、表格、列表保持结构。
- 代码围栏中的命令必须可执行；占位符写成 `<...>`，不要伪装成真实值。
- 相对链接必须指向真实文件；不要用提交号做当前引用。
- 不写实现状态注记（「已实现」「未来会」）、测试走读、评审过程或显而易见的代码复述。
- 中文文档先加载 `tech-doc-style-chinese`：直角引号「」、中西文留白、事实保真。术语按 `GLOSSARY.md`。
- 两份 README 同步；契约变化先写 ADR。

## 篇幅预算

- 预算在 `scripts/doc-budgets.json`，按 Unicode 字符数计算。
- `pnpm docs:check` 检查预算、必需文件、相对链接、代码围栏、尾随空格、`docs/configuration.md` 的 Config 字段覆盖、默认值一致性和双语结构，以及 Agent Note 的格式。
- 发版提交时把每个预算重定基线为当前长度向上取整到千位；发布之间的增量先压缩或迁移。不要通过修改 `doc-budgets.json` 或跳过检查来让门禁变绿。

## 机械检查

```sh
pnpm docs:check
pnpm check        # 语法 + 架构 + order-doc 同步 + 文档代码块 + docs:check + node --test
```

`pnpm check` 是提交门禁；`docs:check` 可以单独快速运行。
