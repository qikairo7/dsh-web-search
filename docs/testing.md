# 测试策略

本文件定义测试分层和运行时机；具体命令见 [开发指南](development.md) 的「日常命令」表。实现规则见 [CODING_STANDARDS](../CODING_STANDARDS.md) 的测试章节。

## 测试层级

| 层级 | 内容 | 何时运行 |
|---|---|---|
| 单元测试 | `test/*.test.js` 使用 `node:test` 和 `node:assert/strict`，按 lib 模块对应，不访问网络 | 每次代码改动 |
| 文档门禁 | `pnpm docs:check` 检查文档层级、链接、配置覆盖、默认值和 Agent Note 格式 | 每次文档改动；`pnpm check` 自动运行 |
| 日常探针 | `pnpm probe`（`scripts/daily-probe.mjs`）跑 14 条固定查询 + 2 个抓取，分后端遥测、清单健康信号、滚动 7 天聚合、PASS/FAIL 判定 | 每日一次；怀疑后端漂移时 |
| 基准 | `pnpm benchmark` 跑 FRAMES/WebWalkerQA，优先读 fixture，可选 live API | 改路由、摘要、Provider 行为或发布前 |
| 手动冒烟 | 安装到 DSH，重启后验证设置页、`web_search`（中英文）和 `web_fetch`；设置页管理路由（验证 / 拉模型 / 刷新额度）见维护者本地 verify skill 规程（见 [docs/AGENTS.md](AGENTS.md) 的「维护者本地文件」节）的「管理路由真机验证（web + ego）」节 | 改 Provider 注册、配置或默认行为 |

仓库没有覆盖率门禁，也不把 live API 调用放进单元测试。

## 写测试

- 测试名写成行为句，例如 `AutoSearchProvider uses the Chinese order and falls back on failure`。
- 新行为同时覆盖映射层和路由层：映射函数测输入到结果的转换，路由器测顺序、回退、缓存和熔断。
- 行为改动要有一个在改动前失败、改动后通过的测试；纯文档或格式化改动不需要新增测试。
- 测真实实现，不把实现逻辑复制进测试；用本地 stub provider，不引入 mock 库。需要拦截 HTTP 的适配器/客户端测试统一用 `test/helpers/withFetch.js`，不要在测试里手写保存和恢复 `globalThis.fetch`。
- 不要绕过或削弱 `test/architecture.test.js`：它扫描 `lib/` 和 `scripts/` 的付费 API 标记，只允许 `scripts/public-benchmark.mjs` 例外。

## 运行顺序

1. 单文件：`node --test --test-isolation=none test/<name>.test.js`。
2. 全量：`node --check lib/index.js && node --test --test-isolation=none`（DSH 沙箱）；CI 用 `pnpm check`。
3. 文档改动：`pnpm docs:check`，不需要跑测试。
4. 日常：`pnpm probe`，一分钟内完成，产出当日判定与滚动聚合。
5. Provider 行为或发布前：有凭据时跑 `pnpm benchmark`，或在 DSH 内做一轮真实冒烟。

## 日常探针

`pnpm probe` 是日常实测层，也是外部漂移（后端改版、配额收紧、清单腐烂）的第一道警报；统计功效来自逐日累积，而不是单轮大样本。结果写 `.research/daily-probe/<日期>.json`（gitignored）。

- **PASS 条件**：搜索成功 ≥ 13/14、金标 Top10 ≥ 12/14、抓取成功 ≥ 1/2、参与调用的后端没有全军覆没。任一不满足退出码为 1。
- **清单健康 WARN**（不判 FAIL，只提醒刷新）：新闻查询的已知新闻域占比 < 0.3 → 刷新 `lib/news.js` 域名清单；技术查询的官方域命中占比 < 0.6 → 检查 `lib/officialDocs.js` 域名规则。这两个信号就是手维护清单的「更新机制」：数据告诉你清单何时腐烂。
- **滚动聚合**：自动汇总最近 7 天文件，输出 goldTop10 / 延迟 / 新闻域占比的中位数；日常结论以滚动中位数为准，不以单日为准。

## 基准测试

`pnpm benchmark` 先读 `scripts/fixtures/public-benchmark-sample.json`，fixture 不足时才回退到公开 rows API。结果写 `.research/public-benchmark.json`（gitignored），不提交。当前报告见 `docs/benchmarks/`。

## 回放考卷

历史修复的回归题：`node scripts/replay-suite.mjs` 读场景库 `scripts/replay/scenarios.mjs`（15-25 条，逐条可追溯到修复 commit 或 CHANGELOG 条目），对每条两跑——干净树守卫须过（修复码 PASS），注入旧 bug 须红（旧码 FAIL），证明守卫仍抓得住旧坑。结果写 `.research/replay/<日期>.json` 与同名 `.md`，每周一行趋势追加到 `.research/replay/trend.md`（gitignored，同 `pnpm probe`）。

## 相关文档

- [开发指南](development.md)
- [架构](architecture.md)
- [基准报告](benchmarks/)
- [实现标准](../CODING_STANDARDS.md)
