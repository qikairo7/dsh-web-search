# Agent Note: Provider operation skeleton and WEB_* code preservation

Status: implemented

## Problem

每个 provider 的 search/fetch 方法手写同一操作骨架（读 settings → 取 config → requireKey → requestJSON → try/catch toWebError），14 份拷贝分布在 6 个文件；「fetch 操作要传 `timeoutCode: 'WEB_FETCH_TIMEOUT'`」这条知识没有家，keenable fetch 漏传导致超时报 `WEB_PROVIDER_ERROR`（exa/tavily/firecrawl 都正确）。错误映射另分裂三套：zhihu 往 Error 挂 `.code` 靠 `toWebError` 的 rate-limit 单点特判存活，属未声明协议。UA 字面量写 4 处。

## Decision

- `lib/providers/shared.js` 新增 `providerOperation()`：统一拥有超时接线（`isFetch` 自动带 `WEB_FETCH_TIMEOUT`）、requestJSON 诊断标签、错误边界与 `map` 回调执行；adapter 只声明 endpoint、请求构造与映射。`USER_AGENT`、`isProviderAvailable()`、`hasCredential()` 同归 shared。
- `toWebError` 把「保留调用方 code」从仅 rate-limit 泛化为：非 seam 错误带任意 `WEB_` 前缀 string code 即保留，消息按 code 定制（rate limited / timed out / failed），cause 保留；`isRecoverable` 语义不变。
- zhihu.js 保持不动（requestZhihu 已内聚）；anysearchClient.js 不动（上游移植件）。keenable 的超时码修正与 `mapAnySearchSearch` 死代码退役随本决策落地。

## Alternatives considered

- 统一 provider 基类：落选，改变注册契约且与「标准 id 固定、新增先写 ADR」冲突；骨架函数达成同一 locality 而不动 interface。
- 静默顺手修 keenable 超时码：落选，错误词汇是 seam 契约，修正随本 note 声明，并有测试锁住（keenable-exa 断言 `WEB_FETCH_TIMEOUT`）。
- 把 anysearchClient 的 HTTP 管线并入骨架：落选，与「保持上游移植一致」的既定事实冲突。

## Consequences

- 行为变化两处：keenable fetch 超时 `WEB_PROVIDER_ERROR` → `WEB_FETCH_TIMEOUT`；`toWebError` 对任意 `WEB_*` code 的通用保留（zhihu rate-limit 行为不变）。
- 新增 provider 的内部约定从约 6 条降到 3 条差异声明；超时/错误接线改一处对全部 adapter 生效。
- `mapAnySearchSearch` 的 4 个测试用例改走 AnySearchClient 真实映射面，绿灯不再有误导性。
