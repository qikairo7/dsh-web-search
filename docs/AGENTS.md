# 文档标准

本文件是文档体系的唯一 schema：层级、事实归属、写作规则、篇幅预算与机械检查。根 `AGENTS.md` 只放会话硬规则；实现规则在 `CODING_STANDARDS.md`，不重复。

## 文档层级

| 文件 | 唯一职责 | 不放在这里 |
|---|---|---|
| `AGENTS.md` | 每回合加载的硬规则与指针 | 教程、示例、可推导细节 |
| `CODING_STANDARDS.md` | 实现与 Review 唯一标准：契约、实现原则、测试、完成门禁 | 当前默认值、行为说明 |
| `REVIEW-LESSONS.md` | 错题本：教训证据、Seen 计数与晋升机制 | 正式实现标准、决策史 |
| `README.md`（中文主文档）/ `README.en.md` | 用户可见事实：安装、凭据、行为概览；两份同步 | 实现细节、决策史、配置表、Provider 矩阵与配额 |
| `docs/configuration.md` | 完整配置字段、默认值与说明；README 链接到此 | 行为教程、实现规则 |
| `docs/development.md` | 安装、命令、CI 与排错 | 实现规则、产品行为 |
| `docs/testing.md` | 测试层级与验收策略 | 命令清单、实现细节 |
| `docs/upgrade/` | 版本升级指南 | 迁移与决策理由 |
| `docs/cookbook/` | 带步骤与验收清单的 how-to，如新增 Provider | 设计理由、行为说明 |
| `docs/defensive-patterns.md` | 按 artifact 展开的 Review 规则 | 决策史、配置默认值 |
| `docs/architecture.md` | 组合、模块与请求流地图 | 单函数细节、配置默认值 |
| `docs/feature-map.md` | 产品功能地图：控件、操作、期望反馈 | 实现规则 |
| `docs/subsystems/` | 子系统参考页：职责真源表、运行路径、约束与验证命令 | 行为教程、决策史、实现规则 |
| `docs/dsh-host-contract.md` | DSH 宿主契约、tool-web 渲染与 preset 作用域、内部排查路径 | 插件行为、配置默认值 |
| `docs/adr/` | 已接受的契约级决策；一条一份，历史不改写 | 当前行为、迁移计划 |
| `.agents/notes/` | 保留「为什么、放弃了什么」的决策记录；格式见目录 README | 当前行为、任务清单、测试走读 |
| `GLOSSARY.md` | 项目术语唯一写法 | 实现细节 |
| `docs/agents/` | 代理工作流：领域文档 | 产品行为 |
| `docs/benchmarks/` | 历史基准报告与复现命令；数字与日期不改写 | 当前配置默认值 |
| `CONTRIBUTING.md` / `CONTRIBUTING.zh.md` | 贡献入口与阅读顺序 | 详细实现规则 |
| `SAFETY.md` / `SECURITY.md` / `TRADEMARKS.md` / `THIRD_PARTY_NOTICES.md` | 风险模型、漏洞报告、项目身份与第三方归属 | 使用教程、实现规则 |
| `CHANGELOG.md` | 面向用户的版本变化公告，每个已发版一条 | 实现细节、决策理由、未发版重构 |
| `BENCHMARK.md` | 基准入口、运行规则与指标说明 | 历史报告数据 |
| `docs/AGENTS.md` | 本文件：结构、写作、预算、检查 | 实现规则 |
| `.agents/skills/` | 仓库内 skill | 成文流程复制 |

## 改代码时改哪份文档

| 改动 | 须同步到 |
|---|---|
| Provider 行为、配额、Provider 表 | 行为：`README.md` 与 `README.en.md`；配额与配置表：`docs/configuration.md`；能力矩阵：`docs/architecture.md`；代码事实：`lib/settings.js` 的 `DEFAULT_SETTINGS`；随包默认：`cordis.patch.yml` |
| 模块、依赖方向、请求流、扩展点 | `docs/architecture.md` |
| 开发流程、环境变量、CI 或排错 | `docs/development.md` |
| 测试层级、运行时机或真实 API 验收 | `docs/testing.md` |
| 新增 Provider 或其他扩展步骤 | `docs/cookbook/` |
| Review 的 artifact 级细节 | `docs/defensive-patterns.md` |
| 契约级决策（provider id、能力缝、持久格式） | `docs/adr/` 新增 ADR，不改写已接受 ADR |
| 需保留理由与被放弃方案 | `.agents/notes/{lifecycle}/{class}/yyyy-mm-dd-topic.md` |
| 术语 | `GLOSSARY.md` |
| 基准结果 | `docs/benchmarks/`；保留原始数据与复现命令 |
| 实现规则、Review 门禁 | `CODING_STANDARDS.md` |
| 版本发布 | `CHANGELOG.md` 加对应版本段，写明用户可见影响 |

## 开发顺序

1. 先确定改动改变哪条事实、找到唯一 home；需要新决策先写 ADR 或 Agent Note。
2. 先改文档中的目标行为（信息不足标「待确认」），再改代码与测试。
3. 最后同步 README、架构文档或 Agent Note，并跑机械检查。

## 写作规则

- 写当前状态，不写变更史；历史放 ADR、Agent Note、提交或基准报告。
- 一个事实只有一个家；其他文档链接而来，不复制。
- 先判断文档类型：教程按步骤到结果，参考按查找范围定义当前行为。README 安装段是教程，Behavior 与 `configuration.md` 是参考。
- 中文段落一段一行，不按显示宽度硬换行；代码块、表格、列表保持结构。
- 代码围栏命令必须可执行；占位符写 `<...>`，别伪装真实值。
- 相对链接必须指向真实文件；不用提交号做当前引用。
- 不写实现状态注记（「已实现」「未来会」）、测试走读、评审过程或赘述代码。
- 所有文档（含模板、术语表、ADR 与 Agent Note 新条目）撰写/编辑前必须加载 `tech-doc-style-chinese`；正文一律中文，代码、命令、标识符与机器可读内容原样；英文镜像仅 `README.en.md`、`DETAIL.en.md` 与法律文件对；历史记录（已发版 `CHANGELOG.md` 节、既有 ADR、基准报告、Agent Note 正文）不改写，新条目从中文开始。
- 两份 README 同步；契约变化先写 ADR。

## 篇幅预算

- 预算在 `scripts/doc-budgets.json`，按 Unicode 字符数计算。
- `pnpm docs:check` 检查预算、必需文件、相对链接、代码围栏、尾随空格、`docs/configuration.md` 的 Config 字段覆盖、默认值一致性和双语结构，及 Agent Note 格式。
- 发版时把每个预算重定基线为当前长度向上取整到千位；发布之间的增量先压缩或迁移。不要改 `doc-budgets.json` 或跳过检查来让门禁变绿。

## 机械检查

```sh
pnpm docs:check
pnpm check        # 语法 + 架构 + order-doc 同步 + 文档代码块 + 翻译配对 + docs:check + node --test
```

`pnpm check` 是提交门禁；`docs:check` 可单独快速运行。
