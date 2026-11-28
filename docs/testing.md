# 测试策略

本文件定义测试分层和运行时机；具体命令见 [开发指南](development.md) 的「日常命令」表。实现规则见 [CODING_STANDARDS](../CODING_STANDARDS.md) 的测试章节。

## 测试层级

| 层级 | 内容 | 何时运行 |
|---|---|---|
| 单元测试 | `test/*.test.js` 使用 `node:test` 和 `node:assert/strict`，按 lib 模块对应，不访问网络 | 每次代码改动 |
| 手动冒烟 | 安装到 DSH，重启后验证设置页、`web_search`（中英文）和 `web_fetch` | 改 Provider 注册、配置或默认行为 |

仓库没有覆盖率门禁，也不把 live API 调用放进单元测试。

## 写测试

- 测试名写成行为句，例如 `AutoSearchProvider uses the Chinese order and falls back on failure`。
- 新行为同时覆盖映射层和路由层：映射函数测输入到结果的转换，路由器测顺序、回退、缓存和熔断。
- 行为改动要有一个在改动前失败、改动后通过的测试；纯文档或格式化改动不需要新增测试。
- 测真实实现，不把实现逻辑复制进测试；用本地 stub provider，不引入 mock 库。需要拦截 HTTP 的适配器/客户端测试统一用 `test/helpers/withFetch.js`，不要在测试里手写保存和恢复 `globalThis.fetch`。
- 不要绕过或削弱 `test/architecture.test.js`：它扫描 `lib/` 和 `scripts/` 的付费 API 标记。

## 运行顺序

1. 单文件：`node --test --test-isolation=none test/<name>.test.js`。
2. 全量：`node --check lib/index.js && node --test --test-isolation=none`（DSH 沙箱）；CI 用 `pnpm check`。

## 相关文档

- [开发指南](development.md)
- [实现标准](../CODING_STANDARDS.md)
