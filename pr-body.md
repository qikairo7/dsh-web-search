## Summary

- 新增 `scripts/translation-pairing.mjs`——轻量版 `.i18n.yaml` 配对：README 与 DETAIL 双语按节序（含 preamble）配对，节哈希（含标题）记录基线；**单侧改动未同步另一侧即漂移**，check 红；修复=翻译配对节后 `--record` 重建。双侧同改而不重录基线同样红。
- 终审处置（head e3dca08 起）：F2 已 rebase main——文档触点全部取 main 版、check 链并入 pairing 门、AGENTS.md 用 main 骨架、基线按新算法重录；F3 错题本改动已回退（R-012/R-013 让位 #68，R-0004 以 main 为准）；F4 本正文数字已更正；F5 仅落地 loadRecord 区分 ENOENT，heading trim 与 JSDoc 未做（#83 跟踪）。
- rebase main@8156e18（#48 后）：check 链融合两段为七段（syntax→architecture→order-sync→doc-code→pairing→docs→tests），README 双语组成句、docs/AGENTS.md 注释、docs/development.md 组成句+表格+EPERM 回退命令按融合链序重写，README Development 双语同步后重录配对基线，错题本 R-003/R-010 行取 main 版。
- 冒烟实测：单侧改词 → `1 drift(s)` exit 1；还原转绿。

## Evidence

- Before: 双语一致性只有结构对称检查，段落级单侧漂移无人发现。
- After: 测试 9/9（序号配对含 preamble、单侧漂移、双侧同改须重录、不对称拒录、单侧改标题、R-013 标题哈希）；`pnpm check` 七段链全绿。

## Merge Danger

- Door: one-way
- Blast Radius: `pnpm check` 新增 pairing 门；此后单语改 README/DETAIL 被拒（设计意图）。
- Revert: git revert the squash commit（删脚本与基线文件；check 链回退需手工编辑 package.json）。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)