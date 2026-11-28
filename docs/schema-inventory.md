# 文档层级明细

`docs/AGENTS.md` 的子文件：文档层级明细表。主文件放概要与规则，本文只放这张表。

| 文件 | 唯一职责 | 不放在这里 |
|---|---|---|
| `AGENTS.md` | 每回合加载的硬规则与指针 | 教程、示例、可推导细节 |
| `CODING_STANDARDS.md` | 实现与 Review 唯一标准：契约、实现原则、测试、完成门禁 | 当前默认值、行为说明 |
| `README.md`（中文主文档）/ `README.en.md` | 用户可见事实：安装、凭据、行为概览；两份同步 | 实现细节、决策史、配置表、Provider 矩阵与配额 |
| `docs/configuration.md` | 完整配置字段、默认值与说明；README 链接到此 | 行为教程、实现规则 |
| `docs/development.md` | 安装、命令、CI 与排错 | 实现规则、产品行为 |
| `docs/testing.md` | 测试层级与验收策略 | 命令清单、实现细节 |
| `docs/cookbook/` | 带步骤与验收清单的 how-to，如新增 Provider | 设计理由、行为说明 |
| `docs/defensive-patterns.md` | 按 artifact 展开的 Review 规则 | 决策史、配置默认值 |
| `docs/architecture.md` | 组合、模块与请求流地图 | 单函数细节、配置默认值 |
| `docs/feature-map.md` | 产品功能地图：控件、操作、期望反馈 | 实现规则 |
| `docs/subsystems/` | 子系统参考页：职责真源表、运行路径、约束与验证命令 | 行为教程、决策史、实现规则 |
| `docs/dsh-host-contract.md` | DSH 宿主契约、tool-web 渲染与 preset 作用域、内部排查路径 | 插件行为、配置默认值 |
| `docs/adr/` | 已接受的契约级决策；一条一份，历史不改写 | 当前行为、迁移计划 |
| `docs/postmortem/` | 事故叙事唯一归属层：单次事故的时间线、影响、根因与教训 | 当前行为说明 |
| `GLOSSARY.md` | 项目术语唯一写法 | 实现细节 |
| `docs/agents/` | 领域文档阅读顺序 | 产品行为 |
| `SAFETY.md` / `SECURITY.md` / `TRADEMARKS.md` / `THIRD_PARTY_NOTICES.md` | 风险模型、漏洞报告、项目身份与第三方归属 | 使用教程、实现规则 |
| `CHANGELOG.md` | 面向用户的版本变化公告，每个已发版一条 | 实现细节、决策理由、未发版重构 |
| `docs/AGENTS.md` | 文档体系 schema 主文件：概要、目录、写作规则、预算与检查 | 实现规则、明细表 |
| `docs/schema-inventory.md` | 本表：文档层级明细 | 写作规则、实现规则 |
| `docs/schema-sync-map.md` | 改代码时改哪份文档的映射与开发顺序 | 写作规则、实现规则 |
