# Agent Note: Evidence enrichment shares the auto fetch stack

Status: implemented

## Problem

`lib/index.js` 为 Evidence enrichment 构造了第二个完整 `AutoFetchProvider`，唯一差别是 settings thunk 重释 `fetchMode: 'fast'`。两个实例各自持有 `TtlLruCache` 和 `ProviderRunner`（独立熔断器）：Keenable 在增强路径连续失败只烧增强实例的熔断，用户可见的 auto fetch 熔断保持绿色（反之亦然）；`cacheKey` 指纹含 `fetchMode`，clean 模式下同一 URL 落入两个永不相通的缓存分区。副作用无文档、无测试，GLOSSARY 承诺的 direct-HTTP-first 实际是「fast 模式解析成什么算什么」。

## Decision

- 删除第二个实例；`AutoFetchProvider.fetch(request, signal, { order })` 支持显式 order，覆盖 mode 派生顺序并计入缓存键（`fetchCacheKey` 第三参）。
- 增强经 `index.js` 的薄 fetcher 走同一实例：`autoFetch.fetch(request, signal, { order: settings().fetchOrder })`，与旧实现的解析结果一致（旧 fast 重释 ⇒ `settings.fetchOrder`）。
- 熔断器与缓存由此共享：这是接受的**行为变化**——增强路径的可恢复失败现在计入共享熔断（同一后端挂了，用户路径与增强路径一起跳过它），同 order 的抓取结果共享缓存条目。
- GLOSSARY 的 Evidence enrichment 定义不变；实现现在真正等于「按 `fetchOrder` 的直连优先路径」。

## Alternatives considered

- 保持双实例但合并缓存：落选，熔断分裂仍在，且需要在两个实例间穿针引线，比一个实例更复杂。
- 增强直接调 `ProviderRunner.run` 绕过 `AutoFetchProvider`：落选，失去抓取缓存收益，且把 order 策略知识搬进 quality 侧。
- 增强固定硬编码 `['keenable','http',...]` 字面量：落选，绕过用户对 `fetchOrder` 的自定义，改变默认行为。

## Consequences

- 行为差异：共享熔断（增强失败影响用户路径的后端跳过决策）、同 order 缓存复用；均为有意的收敛，测试覆盖「显式 order 胜过 mode 派生、键随 order 变化」。
- 新增 `fetch` 第三参 `{ order }` 是插件内部接口（ctx.web 只以两参调用），不影响 tool-web 契约。
