## Summary

- 三道工程门禁一次补齐（对齐 Claude Code 验证方法论的机械校验层）：
  - **文档代码块门禁** `scripts/check-doc-code.mjs`：提取全部 `js`/`mjs`/`sh`/`bash` 围栏逐块 `node --check` / `bash -n`——文档示例腐烂即 `pnpm check` 红。
  - **性能数量级门禁** `test/bench.test.js`：三个热路径函数 ops/s 下限（基线 1/10：200k / 1.5M / 2.5M）——只有数量级退化才红，随 `node --test` 进 CI。
  - **待办注释三级语义** CODING_STANDARDS §2：FIXME=发布阻塞 / 第二档=尽快 / XXX=someday。
- 终审处置：P2-1/P3 批量转单 [#78](https://github.com/qikairo7/dsh-web-search/issues/78)（引用本 PR 与 finding）；P2-2（README R-004 回潮）经 merge main 由 #45 的修复覆盖；P2-3 冲突已解（五文件，check 链融合为七段全量）。

## Evidence

- Before: 文档示例无机械校验、性能无回归门禁、待办注释无分级。
- After: `pnpm check` 全绿（七段链：syntax→architecture→order-sync→doc-code→pairing→docs→tests）；正文含 Revert 行与合并指引。

## Merge Danger

- Door: one-way
- Blast Radius: `pnpm check` 新增 doc-code 门 + bench 断言；写文档者需保证示例块可解析。
- Revert: git revert the squash commit（删除两脚本一节标准，无数据影响）；七段链回退需手工编辑 package.json。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
