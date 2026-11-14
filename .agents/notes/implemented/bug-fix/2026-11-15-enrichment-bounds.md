# Agent Note: Enrichment bounds are internal to the module

Status: implemented

## Problem

Evidence enrichment 是 quality 管线里唯一整段零测试的行为。GLOSSARY 承诺的「800–1500 字符有界」活在组合处：settings 缺 `enrichSummaryMinChars`/`MaxChars` 键时 `Math.max(NaN, 1) = NaN`，NaN 使 summarize 的所有门槛比较永假，无界摘要被接受并覆盖 provider 原摘要，且无测试会变红。

## Decision

- `lib/enrich.js` 的 `summaryBounds()` 在模块内兜底：复用 `positiveInteger` + `DEFAULT_SETTINGS`（800/1500 单一来源），保证 1 ≤ min ≤ max；接受阶梯三行语义逐字不变。
- 新 `test/enrich.test.js`（15 用例）经 `enrichSources()` 公共 interface 用假 fetcher 钉住整条阶梯；quality.test.js 加一条引擎→enrich 链路用例。

## Alternatives considered

- 信任 `resolveSettings` 恒补全键、只在测试里修：落选，enrich 的 interface 是任意 settings 形状（测试与直接库调用都传部分对象），有界性是模块承诺，不应依赖调用方记忆。
- 顺手把 `enrichTopN` 的 NaN（fail-closed，静默跳过整个 enrichment）也兜底：落选，fail-closed 不产生无界输出，且生产路径键恒存在；留待有真实缺口再收。

## Consequences

- 部分 settings 不再能击穿有界性；「开 enrich 即得 800–1500 有界摘要」一句话成立。
- 假 fetcher 即第二个 adapter，enrichment 的 fetch seam 经测试成立。
