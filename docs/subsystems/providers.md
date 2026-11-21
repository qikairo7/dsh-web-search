# Provider 层

后端 provider 是 `ctx.web` 的最小实现单元：一个后端一个文件，注册进 catalog，由 `auto` 路由调用。

## 成员一览表

下表由 `pnpm docs:gen` 从 [lib/catalog.js](../../lib/catalog.js) 生成；手改，或改源码后不重新生成，都会被 `pnpm docs:check` 判红。

<!-- gen:provider-table start -->
| Provider | 能力 | Tier | 认证方式 |
|---|---|---|---|
| `anysearch` | 搜索、抓取 | 免费 | API Key（`ANYSEARCH_API_KEY`） |
| `keenable` | 搜索、抓取 | 免费 | API Key（`KEENABLE_API_KEY`） |
| `tavily` | 搜索、抓取、域内搜索 | 付费 | API Key（`TAVILY_API_KEY`） |
| `firecrawl` | 搜索、抓取 | 付费 | API Key（`FIRECRAWL_API_KEY`） |
| `zhihu` | 搜索 | 免费 | API Key（`ZHIHU_API_KEY`） |
| `zhihu-site` | 搜索 | 免费 | API Key（`ZHIHU_API_KEY`） |
| `aihot` | 搜索 | 免费 | 免 Key |
| `exa` | 搜索、抓取 | 免费 | API Key（`EXA_API_KEY`） |
| `bing` | 搜索 | 免 Key | 免 Key |
| `http` | 抓取 | 免费 | 免 Key |
<!-- gen:provider-table end -->

## 职责与真源表

| 事实 | 真源 |
|---|---|
| 注册、能力、tier、补充缝 | `PROVIDER_CATALOG`（[lib/catalog.js](../../lib/catalog.js)） |
| 付费尾与 keyless 地板 | `paidSearchFallback()` / `keylessSearchFallback()`（同上） |
| 调用骨架与 UA | `providerOperation()` / `USER_AGENT`（[lib/providers/shared.js](../../lib/providers/shared.js)） |
| HTTP 收发 | `requestJSON` / `requestText`（lib/http.js） |
| 错误与回退资格 | `toWebError` / `isRecoverable`（[lib/errors.js](../../lib/errors.js)） |
| 回退与熔断 | `ProviderRunner`（[lib/providerRunner.js](../../lib/providerRunner.js)） |

成员契约：`id`、`title`、`description`（`{ en, zh }`）、`available()`、`ready()`、`search()` / `fetch()`；凭据后端收 `{ settings, resolveKey }`，免凭据后端只收 `{ settings }`。

### 三段式契约

- `XXX_PROVIDER_ID` 常量：id 的唯一写法。
- `mapXxxSearch()` 纯映射：响应进、sources 出，单测直接调用。
- `XxxProvider` 类：只做 IO；样例见 lib/providers/bing.js。

### 与相邻页的边界

- 完整请求流与模块地图：[architecture](../architecture.md)。
- 宿主装配与注册顺序：[dsh-host](dsh-host.md)。
- 新增后端：[新增 Provider](../cookbook/adding-a-provider.md)。

## 运行路径

### 启动注册

1. `createProviders()` 按 `PROVIDER_IDS` 查 factory 表，缺即抛错。
2. 凭据实例经 `createMultiKeyProvider()` 包装多 Key。
3. `apply()` 按能力注册，最后挂 `auto`（见 [dsh-host](dsh-host.md)）。

### 一次搜索（fast）

1. `AutoSearchProvider.search()` 查取消、读设置、下发注记、查缓存。
2. 天气 / 汇率先由 `realtimeSearch` 应答，未命中才分流。
3. runner 按 `fastOrder()` 逐个 `attempt()`；不合格记 skip，不产生外部调用。
4. provider 只声明 endpoint 与请求，骨架统一接线超时与错误边界。
5. 响应进 `map` 纯映射；成功记熔断成功。
6. 失败转 `WEB_*`；可恢复且允许回退的试下一个。

### 一次搜索（quality）

1. quality 交给 `QualityEngine`：并行、去重、重排降级、加权、增强。
2. 补充缝由 catalog 条目声明，各触发一次。
3. engine 无结果回落 fast（`result ??=`）。
4. 总 deadline 为 3 × `requestTimeoutMs`，与 signal 取交集。

### 一次抓取

`AutoFetchProvider.fetch()` 走同一 runner；显式 order 并入缓存键，共用缓存与熔断。

## 约束与失败行为

- 直接 `fetch` 白名单：`http.js`、`providers/http.js`、`anysearchClient.js`。
- 边界不抛裸 `Error`。
- 已带 `WEB_*` code 的错误保留 code，只重述消息。
- 超时：fetch → `WEB_FETCH_TIMEOUT`。
- 搜索超时 → `WEB_PROVIDER_ERROR`；诊断名不同时给 `label`。
- `available()` 判 `enabled` 与 http(s) baseURL；缺 Key 抛凭据缺失错。
- 回退双重门：取消 / 非法 URL 立即结束；其余须在允许类里。
- 失败类：402/429 → quota，401/403 → auth，408/5xx → transient。
- 熔断只计可回退失败；全败抛 `WEB_PROVIDER_ERROR` 并附原因。
- 空结果语义归 provider 定夺。
- Bing 空 SERP 抛错，成功空返回会吞掉回退。
- routing 注记由路由层下发一次，provider 只消费。
- `settings()` 是 thunk，每次操作读一次，不缓存进实例字段。
- `USER_AGENT` 由包版本拼出。
- mapper 校验一次：坏条目丢弃，仅 envelope 错误 throw。

## 验证命令

```sh
node --test --test-isolation=none test/provider-shared.test.js test/router.test.js
```

换后端补对应测试文件；提交前跑 `pnpm check`。
