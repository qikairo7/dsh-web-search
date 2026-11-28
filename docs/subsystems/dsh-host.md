# DSH 宿主集成

本页写插件如何挂进 DSH：装载组合、入口装配、随包默认与第一方 tool 层。宿主行为见 [DSH 宿主契约](../dsh-host-contract.md)。

## 职责与真源表

| 事实 | 真源 |
|---|---|
| 插件名与硬依赖 | `name`、`inject`（[lib/index.js](../../lib/index.js)） |
| 入口装配 | `apply()`（同上） |
| 实例构造 | `createProviders()`（同上） |
| tool-web 缺失告警 | `warnIfToolWebMissing()`（同上） |
| 随包默认与插件开关 | [cordis.patch.yml](../../cordis.patch.yml) |
| 版本与 client 注入 | `dsh` 字段（[package.json](../../package.json)） |

## 运行路径

### 装载组合

1. 组合顺序：bundles → profile patch → `--patch`（见宿主契约）。
2. patch 把 `web` 的 search / fetch provider 设为 `auto`。
3. patch 保持第一方 `tool-web` 开启。
4. patch 禁用宿主 `web-fetch-http`：`http` id 归本插件直连抓取。
5. `insert.config` 显式写随包默认，与 `DEFAULT_SETTINGS` 同值。
6. 默认含模式、`*Enabled`、enrich 参数与四条 order。
7. `dsh.engines` 限宿主版本区间。
8. `dsh.bundle.patch` 指 patch；`dsh.client` 声明 Web 注入。

### 入口装配

`apply(ctx, config)` 依次：

1. `setWebErrorClass(WebError)` 装 seam 错误类。
2. 建 `settings()` thunk（见 [settings](settings.md)）。
3. 建 `createKeyResolver(ctx)` 解析凭据。
4. `createProviders()` 按 catalog 构造实例（见 [providers](providers.md)）。
5. 注册健康与管理路由（lib/health.js）。
6. 注册 search provider 进 `ctx.web`。
7. 注册 fetch provider。
8. 注册高级工具与 SiliconFlow 客户端。
9. 注册 `AutoFetchProvider` 与 `AutoSearchProvider`。
10. `warnIfToolWebMissing(ctx)` 收尾。

### 高级工具接线

- AnySearch 工具每次经 `getClient()` 新建客户端。
- 超时取 `max(requestTimeoutMs, ANYSEARCH_HTTP_TIMEOUT_MS)`，开关读 `anysearch.enabled`。
- Tavily / AIHOT 工具复用已构造的 provider 实例。
- 走 `tools` seam，是 `ctx.web` 之外的唯一注册例外。

### 缺 tool-web 的告警

- 检查 `startedBundles` 是否声明 `dsh-tool-web` 或 `dsh-base` / `dsh-web-app`。
- 缺失时打 warn：加进 `dsh.profile.bundles`。
- 否则 `web_search` / `web_fetch` 与 AnySearch Extract 不可用。
- preset 内 tool-web 注册表查不到，故查 profile 声明而非注册表。

## 约束与失败行为

- 本插件只拥有 provider。
- schema、展示与渲染归 `dsh-tool-web`。
- summary 上限归 `searchSummaryMaxChars`，patch 覆盖不了 preset 行。
- provider id 是标准后端名，替换付费官方 provider。
- profile 不得再挂同名 id 插件。
- `inject`：`web` 注册 provider，`credentials` 解析凭据，`tools` 高级工具。
- catalog 漏配 factory，装载即抛 TypeError。
- `Config` 字段声明 volatile：不重挂插件即可更新设置。
- 免凭据后端（`aihot`、`http`、`bing`）不进多 Key 包装。
- 证据增强强制 `order: fetchOrder`，不受 `fetchMode` 影响。
- 宿主版本超出 engines 区间拒绝装载。
- 告警容错：`ctx.get` 或 `profileContext` 缺失静默跳过；无 logger.warn 退回 console.warn。

## 验证命令

```sh
node --test --test-isolation=none test/plugin-apply.test.js
```

装包冒烟：重启 DSH 后 `web_search`（中英文）与 `web_fetch` 各一次；组合用 `dsh --profile <name> --dump-config` 查。
