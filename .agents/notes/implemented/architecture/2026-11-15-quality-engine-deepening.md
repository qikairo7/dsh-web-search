# Agent Note: Quality engine deepening (single interface, one-attempt rerank degrade)

Status: implemented

## Problem

`qualitySearch()` 的 interface 是 9 个字段的 options 对象：调用方（router）只负责把自己构造函数的依赖原样转发进去，测试必须 stub runner 并传三个 `undefined` 槽位。资格判定在 `quality.js` 内联重写了 `ProviderRunner.candidates()`；rerank 降级梯（`rerankScored` → `rerank` → 权威序）在降级路径会重复调用一次 SiliconFlow rerank API，因为 `rerank()` 内部再调 `rerankScored()`。官方文档补充用 `find(officialDocs === true)` 单槽查找 + duck-typed 方法探测，ADR-0009 承重的 gating 无直接测试。

## Decision

- `lib/quality.js` 改为 `QualityEngine` 类：构造期注入 `{ settings, providers, runner, reranker, embeddings, fetcher }`，唯一调用入口 `search(request, signal)`；intent/language/syntax 优先读 `request.routing` 注记，缺失时自行推导。
- 资格判定复用 `runner.candidates('search', pair)`，删除内联过滤。
- 降级梯收敛为一次 `reranker.rerankScored()` 调用：返回数组则按分数加权威排序，返回 `undefined`/不可用则降级为提供方优先序 + 权威加权和。删除 `SiliconFlowReranker.rerank()` 方法，接口只剩 `rerankScored()`。
- 官方文档补充改为按 catalog 的 `domainSearch` 能力声明查找 Provider；gating（免费结果缺官方域、无 `site:`、可用且就绪）保持不变；补充仍绕过 runner，失败不计入熔断、不触发回退——这是有意行为，防止补充搜索的失败惩罚正常搜索路径的 Provider。
- GLOSSARY 新增 Routing annotation 术语。

## Alternatives considered

- 保留 `rerank()` 作为降级梯中间层：落选，它在降级路径重复发起 HTTP 调用，且与第三分支（权威序）产出等价。
- 引擎内自行分类 intent 而不读注记：落选，路由事实每请求解析一次（router 侧），引擎与适配器都消费同一注记，避免同一查询分类漂移。
- 给 Exa 也实现 `searchWithDomains` 让缝有两个 adapter：落选，属于推测性扩展；catalog 能力声明已让缝可测（fake provider 即第二个 adapter）。

## Consequences

- Quality 管线行为对输入不变，唯一差异是降级路径少一次重复 rerank 调用（对应测试断言调用数恰为 1）。
- ADR-0009 的官方文档 gating、降级梯、免费集合断言现在都能经 `QualityEngine.search()` 直接测试。
- `lib/rerank.js` 对外只剩 `rerankScored()`；需要排序的调用方自持排序责任（引擎用 `sortByAuthority`）。
