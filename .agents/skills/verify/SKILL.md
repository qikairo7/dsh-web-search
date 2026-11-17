---
name: verify
description: 在 dsh-web-search 里提交/交付前做端到端冒烟时使用：装包后的真实 web_search 验证规程（keyless 路径可全自动）。机器审查 Evidence 里标 not-run 的装包冒烟，由本 skill 收口。
---

# 端到端验证（verify）

"难以欺骗的测试——整个功能要么行要么不行"（Claude Code 验证方法论）。本仓库的 E2E = 装包后真实 `web_search` 走一遍，而不是只有单测绿。

## 何时跑

- provider 或路由改动合并前后（对应 PR Evidence 的 not-run 项）
- 版本发布前（tag 前）
- 大重构后（quality 管线、router、errors）

## 规程（keyless 全自动，无需凭据）

冒烟范围（设置页、`web_search` 中英文、`web_fetch`）以 [docs/testing.md](../../../docs/testing.md) 的「手动冒烟」行为准；本节只补增量：

1. 仓库根 `pnpm pack` 产出 tgz，装载后重启 DSH（或新 profile）。
2. 依次验证并记录**原始输出摘录**：`web_search` 中文查询（如「Node.js 文件读取」）——期望多来源结果，含中文信源；英文技术查询（如 `site:nodejs.org fs.readFile`）——期望官方文档靠前。

## 判定与记录

- 每步贴原始输出进 Evidence（不是"通过"两个字）。
- keyless 冒烟失败 = 阻塞（P1）；带 key provider 的失败 = P2 记录并转 followup。
- 结果追加进 PR Evidence。

## 边界

- 不在 CI 跑（外部 API 抖动会教坏 agent"重跑代替修复"——flaky 纪律）；pre-push 手动跑。
- 差分场景（重构前后对比）用 `pnpm benchmark` 的对照表——它就是差分测试的现成形态（固定题集 FRAMES/WebWalkerQA 当 oracle，新旧版本同题对比），不需要另建框架。
