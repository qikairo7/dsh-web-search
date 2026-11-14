# Agent Note: Cache policy has an owner; search-order purity is guarded

Status: implemented

## Problem

`TtlLruCache` 的 interface 太浅：TTL 与容量是每个调用点的义务（router.js 5 处各自捞 settings 字段名），`set` 在容量 <1 时静默不写且无任何说明。另有一条无主不变量：`searchCacheKey` 不含 provider order，正确性押在「fastOrder/classifyIntent/qualityPair 是 (query, settings) 纯函数」上，未来让 intent 参考熔断或时钟就会静默串台缓存，现有测试全绿。

## Decision

- `lib/cache.js` 新增 `ResultCache(capability)`：TTL/容量字段映射的唯一声明处，「容量 <1 = 关闭写入」在此显式文档化；router 调用点只剩「key 来源 + 空结果是否写」。
- search key 保持不含 order，纯度前提写进 `searchCacheKey` JSDoc，并由 `test/routing-purity.test.js` 守护：patch `Date.now`/`Math.random` 后三个派生函数输出与基线 deepEqual，同参两次调用确定。

## Alternatives considered

- 把派生 order 纳入 search key（与 fetch 同形）：落选，order 是 settings 的纯函数，指纹已覆盖全部相关设置；入 key 只会让同义 key 膨胀，真正的风险（引入外部状态）由性质测试拦截更直接。
- 容量 <1 时抛错替代静默：落选，容量 0 是文档化的关闭缓存手段（router 测试依赖），静默本身不是错，散落与无主才是。

## Consequences

- 缓存策略改动集中一处；三条写条件策略（search 空不写 / fetch、realtime 无条件）保持原位，属 search/fetch 语义而非缓存机制。
- 任何让路由派生参考时间、随机或健康状态的改动会被纯度测试立刻拦下。
