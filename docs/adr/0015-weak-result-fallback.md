# ADR-0015: fast 链弱结果回退——空结果或空正文沿免费栈再试一次

Status: Accepted.

## Context

fast 模式下 `ProviderRunner.run()` 首个成功即返回，空结果也算成功。当第一个免费后端对某次查询返回 0 条（搜索）或抽不出正文（抓取）时，用户直接拿到空答案，排在后面的免费后端（AnySearch、Exa 等）没有机会。付费尾此时也不该被触发。改动落在 `lib/providerRunner.js` 的 `run()` 与 `lib/providers/router.js` 的搜索、抓取调用处，由 #35 于 2026-11-21 提出。

## Decision

- 定义弱结果：搜索为 `sources.length === 0`；抓取为抽取正文为空或空壳，即 `body.content` 按 `kind` 去标签后为空白。
- 强结果立即返回。弱结果不结束链，按原 fast 顺序继续试下一个免费 Provider，额外尝试上限 `MAX_WEAK_FALLBACKS = 1`。treg 的 waterfall 允许 2 次，这里取保守值 1。
- 弱回退只在免费家之间进行：只有 `tier !== 'paid'` 的候选能被弱回退走到。下一个候选若是付费尾（`tavily` / `firecrawl`），直接返回已有弱结果，不调用付费。付费尾保持 fallback-only，只在免费栈以错误收场时进入。
- 弱结果不计熔断失败：它是空结果，不是错误，`ProviderHealth` 不受影响。弱结果也不写缓存，下一次调用仍会重试整条链。
- 弱回退与失败回退是两条独立判定：弱回退看结果轴（空结果 / 空正文），失败回退看错误轴（抛出的错误类别）。`fallbackFailureClasses` 只管错误轴，不参与弱回退。弱回退途中某家抛错时仍按普通失败处理：落在允许类里就继续下一家，落在允许类之外（例如收窄到 `['quota','auth']` 时的 unknown）就整条链抛错中止，后续免费后端不再获得机会。
- 判定、上限与免费限定集中在 `run()` 的 `weak` 策略参数（`isWeak`、`isFree`、`maxFallbacks`），由 `router.js` 按能力注入。`weak` 缺省时行为与旧版一致。

## Consequences

- fast 搜索或抓取在出现弱结果后，最多多打一个免费后端。最坏每次查询多 1 次免费调用，付费调用数不变。
- 全链皆弱时返回最后一个弱结果，不报错、不缓存。用户看到的仍是空结果，但多试了一次机会。
- quality 模式不受影响：它仍在合并为空时返回 `undefined`，由路由器回落到 fast 序。
- 付费尾定位不变：错误回退仍可达 `tavily` / `firecrawl`；弱结果永远不触发付费。

## Rejected

- 允许 2 次额外免费尝试（对齐 treg 的 `MAX_WEAK_FALLBACKS=2`）：免费栈通常 2 到 4 家，2 次会多抬高一跳延迟，收益边际，取 1 更稳妥。
- 让弱结果也触发付费兜底：与 ADR-0009 / ADR-0010 的付费尾 fallback-only 定位冲突，且空结果常见，会持续烧配额。
- 把弱结果记为熔断失败：弱结果是「空」不是「错」，计入会误熔断健康后端。
