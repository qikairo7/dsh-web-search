# Agent Note: Routing-fact derivation has a single home

Status: implemented

## Problem

「routing 注记缺失时如何自行推导」的优先级规则以 5 份、两种答案存在：`router.js` 的 `routingFacts`（私有、权威）之外，tavily/firecrawl/zhihu/anysearch 各自内联 `routing?.X ?? 推导` 子集，anysearch 的 language 链不认 `lang:` 算子，`quality.js` 的本地回退漏了 `languageRouting` kill-switch 一层。规则零测试。

## Decision

- 新 `lib/routing.js`：`routingFacts(query, settings, intent)` 从 router 原样迁出；`resolveRouting(request, settings)` 是 provider 与 quality 的唯一消费入口——每字段注记优先、缺省走同一条推导链，language 推导用有效 syntax 保证 `lang:` 优先级。
- 五处内联链全部替换；方言翻译（`site:` → include_domains / tbs / SearchDB 等）逐字节不变。
- 声明两处 standalone 行为修正（生产路径不经过——router 恒带注记）：anysearch standalone 认 `lang:` 算子（与被路由调用对齐）；quality 本地回退过 kill-switch。

## Alternatives considered

- 按各 provider 声明的算子集参数化推导链：落选，引入「推导 = 能力」的隐式映射；注记契约本就把 `lang:` 解析结果并入最终 language hint，统一链与路由态一致。
- 保留各 provider 自推导、只加测试：落选，两处漂移已经发生，规则仍无唯一家，改动语义时要记起 5 处。

## Consequences

- 推导规则一处定义一处测试（`test/routing.test.js` 6 用例 + adapter-routing 的 standalone 一致性 2 用例）。
- standalone 与 routed 行为对齐：同一查询无论是否带注记，推导结果相同。
- `lib/language.js` 并入 `text.js`、query.js 的三个 provider 专属日期转换器迁回各自 adapter，随本决策一并落地。
