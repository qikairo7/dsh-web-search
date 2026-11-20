# Agent Note: Anthropic 验证方法论 → 我们的可迁移清单

Status: proposed

来源：How the Claude Code team thinks about verification（claude.dev/blog，2026-11-16，10 min）
对照资产：pr-merge 流水线、issue-lane 图、pnpm check 七段（331 单测）、verify skill、REVIEW-LESSONS 错题本。
只读核对记录：`test/property.test.js`（已有 4 条属性测试）、`scripts/public-benchmark.mjs`（固定题集 fixture）、`CODING_STANDARDS.md` §9 门禁 8 项、`.agents/skills/verify/SKILL.md`。

## Problem

最大增量不是「再补一种测试」，而是把验证层当系统本身来建：我们已有的 E2E 真机、三轴、gate 都是「重且靠人」的验证，缺的是「便宜、可反复、不靠人」的机械化层（属性测试扩面 + 差分进 check + diff 触发清单）和「判官不能被判者篡改」的护栏（审查依据钉在 base）。这两块补齐，才是文章说的「能同时跑几十上百个 Claude」的前提。

## Proposal

格式：**做法**（文章原意）→ **我们现状** → **迁移方式（落点）** → **优先级**。

### P1 立刻值得

**1. 属性测试成规模覆盖每个纯函数**
- 做法：写「不可能失败」的不变式，用生成器造上千输入试反例（round-trip / 不变式 / 幂等 / 等价四类）。
- 现状：**部分有**。`test/property.test.js` 已有 4 条，但是零依赖自制 mulberry32、只覆盖 `classifyFailure`、`detectLanguage` 两个纯函数，缺 round-trip、幂等、等价三类最有价值的属性。
- 迁移：在 `test/property.test.js` 扩写——`normalizeUrl` 的 encode/decode round-trip 与归一化幂等、`cacheKey` 同输入稳定/异输入不碰撞、`clipQuery` 长度不变式、`clean` HTML 幂等、`rerank` 分数区间、`router` 决策等价（新旧实现同输入同输出）。落点：`test/property.test.js` + `CODING_STANDARDS.md` §9 加一条「新增纯函数须配属性测试」。
- 差距性质：不是从 0 起，是覆盖面从 2 个函数扩到核心纯函数全集。

**2. 差分测试机械化进 check（可行子集）**
- 做法：旧系统当 oracle，同输入跑新旧，归一化后 diff，白名单记已知变更。
- 现状：**部分有**。`scripts/public-benchmark.mjs` 用固定题集 fixture 做跨版本对照，`verify` skill 已明说它是「差分测试现成形态」；但它要 key + 网络、不在 `pnpm check` 内，且是跨版本 recall，不是严格的 old-vs-new 同输入 oracle。
- 迁移：新建 `scripts/check-differential.mjs` 接进 `check` 链（第七段单测前）：对本地确定性函数（URL 归一、cache key、HTML clean、路由决策）保留旧实现副本，用生成器喂同输入，输出归一化后逐条 diff，白名单文件记已知变更。落点：`scripts/check-differential.mjs` + `package.json` check 链 + `CODING_STANDARDS.md` 门禁 9（check 组成文档同步）。

**3. 改动不能修改自己的检查**
- 做法：审查依据（REVIEW.md 等）从 base/默认分支读，绝不读 PR 改动里的版本；门禁规则放在改动动不了的分支。
- 现状：**没有**。现在 review/gate 读工作区的 `CODING_STANDARDS.md`、`REVIEW-LESSONS.md`，PR 可以改它们，fix 轮也可能顺手改规则文件——被判者能篡改判官。
- 迁移：pr-merge 图加硬纪律——`gather` 卡把 base 版本的 `CODING_STANDARDS.md`、`REVIEW-LESSONS.md`、PR 模板落到 evidence；`review`/`review-spec`/`review-quality`/`gate` 卡 prompt 加一句「审查依据一律用 `git show origin/main:<文件>` 的 base 版本，不看 PR 改动里的版本」；`fix` 卡明令不得修改规则/门禁文件。落点：pr-merge 图 5 张卡 + 手册新增一行。
- 这是文章最硬的护栏之一，我们整条线缺失。

### P2 近期

**4. 验证戳「none 可查」+ 门禁观察模式**
- 做法：每个 commit 盖「怎么验证的」戳（含 none 便于查询未验证）；commit gate 有 off/observe/enforce 三档，先 observe 记录待拦项、核误报，再 enforce，且一个会话被拦两次后放行防卡死。
- 现状：**部分有**。commit 有 `Verified-by: pnpm-check`，PR Evidence 记 not-run；但没有可枚举的统一戳（含 none）、没有三档门禁。
- 迁移：`CODING_STANDARDS.md` §8 把 `Verified-by` 枚举化（`pnpm-check` / `verify-e2e` / `acceptance-ego` / `none <原因>`）；pr-merge `act` 卡加「合并前查 head commit 的 Verified-by，none 且无豁免写人工裁决」；先在复盘里 observe 一个迭代（只记录不拦），误报清零后再谈 enforce。落点：CODING_STANDARDS §8 + act 卡 + 手册。

**5. 按 diff 触发子只核命中规则**
- 做法：可靠性清单每条带「可从 diff 读出的触发子」，agent 读 diff 只核命中的 3–10 项，不背全表。
- 现状：**部分有**。`REVIEW-LESSONS.md` open 规则 + Seen 计数已有，但没有「按 diff 画像筛出命中规则」的机制，全靠审者通读全表。
- 迁移：给 `REVIEW-LESSONS.md` 表加「触发信号」列（路径/关键词/文件类型）；pr-merge `review`/`gate` 卡加一步「先按 diff 画像筛出触发命中的规则，只核这些，其余跳过」。落点：REVIEW-LESSONS 表结构 + review/gate 卡。

**6. 三连失败升级人**
- 做法：同一检查 Claude 自修仍失败，三次后停手转人。
- 现状：**部分有**。issue-lane `dev` 回炉 1 轮即 blocked，pr-merge `fix` 有轮次但无「同一失败项连续 3 轮不消失 → 转人」的明确阈值。
- 迁移：`dev` 卡与 `fix` 卡加「同一失败项连续 3 轮不消失 → 停手，交接写人工裁决点」，与现有 blocked 机制对齐。落点：issue-lane `dev` 卡 + pr-merge `fix`/`act` 卡 + 手册。

**7. 审者本身要被评（轻量近似）**
- 做法：追合并后被 revert 的比例、维护者合并前拒收的比例、干净对照组；recall 分段测（原始/验证后/终审）；调 recall 到再调就过拟合为止。
- 现状：**部分有**。22:00 复盘定时任务 + 复盘发现跟踪表已有，但不追 revert/拒收率，也没有对 review 系统本身做 recall 评估。
- 迁移：复盘子代理加两问——本期合并后被 revert 有几笔、被 gate/维护者拦下有几笔，作为审者有效性指标；错题本 Seen 计数当分段召回代理。落点：pr-merge 手册「复盘纪律」条 + 复盘模板。

## Alternatives considered

### P3 记录在案

**8. 规则与检查定期清理**
- 做法：测试套件、验证步骤、.md 只增不减会烂，要例行清理。
- 现状：**部分有**。REVIEW-LESSONS 有 40 行上限+归档、文档有 `doc-budgets.json` 预算；但 check 七段/测试/verify 步骤本身没有「该删就删」的例行清理。
- 迁移：复盘清单加一条「核 check 七段与测试有无只增不减的僵尸项，能删就删并记一行」。落点：手册复盘纪律 + `docs/development.md`。

**9. verify 技能自身压力测试 + flaky 纪律**
- 做法：把 verify 做快做稳并持续压测；flaky 不许重跑/加 sleep/跳过，查不出根因就删并写原因。
- 现状：**已有等价物**。verify skill 相当成熟、acceptance 有真机三路径；但缺「定期压测 verify 本身、统计近 N 次 flaky」。
- 迁移：复盘加「acceptance/verify 近 N 次是否重跑才过（flaky），出现即记录并修 harness；修不好就删步骤写原因」。落点：verify skill 判定节 + 复盘。

**10. 一个审者多轮、不叠加审者**
- 做法：不靠叠更多更贵的审者，而是调好主审者；每轮指向上一轮上下文与历史失败，不从头重查。
- 现状：**已有等价物**。复审模式只验修复点、三轴分工不串味、gate fresh 防锚定。差一点：gate 是「再加一个 fresh 对抗者」，形式上像叠加，但它是不同镜头的盲区抽查，不是同层重复。
- 迁移：不改机制，只在手册写明「gate 是盲区抽查，不是第三遍同一清单」，避免误读为违反文章原则。落点：手册 gate 条。

### 不可迁移（需 Anthropic 内部工具链/数据集）

- 39 项可靠性清单的具体条目：基于他们的事故库，我们只能按自己的 `REVIEW-LESSONS` 沉淀。
- commit 验证戳查询基础设施与本地 hook 强制：我们只有 PR 合并前检查近似。
- 正式 review eval harness（复现仓库状态 + 一句答案键、tuning/test 分离、三 bug-finder 重放 + 人工审批规则）：需要内部工具与标注数据，只能轻量近似。

## Acceptance criteria

- P1-1 属性测试扩面：在 `test/property.test.js` 扩写——`normalizeUrl` 的 encode/decode round-trip 与归一化幂等、`cacheKey` 同输入稳定/异输入不碰撞、`clipQuery` 长度不变式、`clean` HTML 幂等、`rerank` 分数区间、`router` 决策等价（新旧实现同输入同输出）。落点：`test/property.test.js` + `CODING_STANDARDS.md` §9 加一条「新增纯函数须配属性测试」。
- P1-2 差分测试进 check：新建 `scripts/check-differential.mjs` 接进 `check` 链（第七段单测前）：对本地确定性函数（URL 归一、cache key、HTML clean、路由决策）保留旧实现副本，用生成器喂同输入，输出归一化后逐条 diff，白名单文件记已知变更。落点：`scripts/check-differential.mjs` + `package.json` check 链 + `CODING_STANDARDS.md` 门禁 9（check 组成文档同步）。
- P1-3 判官不能被判者篡改：pr-merge 图加硬纪律——`gather` 卡把 base 版本的 `CODING_STANDARDS.md`、`REVIEW-LESSONS.md`、PR 模板落到 evidence；`review`/`review-spec`/`review-quality`/`gate` 卡 prompt 加一句「审查依据一律用 `git show origin/main:<文件>` 的 base 版本，不看 PR 改动里的版本」；`fix` 卡明令不得修改规则/门禁文件。落点：pr-merge 图 5 张卡 + 手册新增一行。

## Risks

- 不可机械化部分如实说：provider 网络行为受 key 与外部抖动影响，进不了 check，只能靠 benchmark 手动对照 + acceptance 真机覆盖。
- 不可完全迁移：Anthropic 靠本地 hook 真正挡提交，我们只有 PR 合并前检查这一步近似，不等价，如实标注。
- 不可完整迁移：正式 eval harness（复现仓库历史状态、一句答案键、tuning/test 分离、三 bug-finder 重放）依赖内部工具与事故数据集，只能轻量近似。
