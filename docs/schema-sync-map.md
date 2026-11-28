# 文档同步映射

`docs/AGENTS.md` 的子文件：改代码时须同步的文档映射与开发顺序。

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
| 需保留理由与被放弃方案 | 同上，写进该 ADR |
| 术语 | `GLOSSARY.md` |
| 实现规则、Review 门禁 | `CODING_STANDARDS.md` |
| 版本发布 | `CHANGELOG.md` 加对应版本段，写明用户可见影响 |

## 开发顺序

1. 先确定改动改变哪条事实、找到唯一 home；需要新决策先写 ADR。
2. 先改文档中的目标行为（信息不足标「待确认」），再改代码与测试。
3. 最后同步 README 或架构文档，并跑机械检查。
