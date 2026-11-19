# DSH 宿主契约

本文件记录插件开发时最容易误判的 DSH 宿主行为。这里只写与 `dsh-web-search` 集成有关的事实；实现规则见 [CODING_STANDARDS](../CODING_STANDARDS.md)，模块地图见 [architecture](architecture.md)。

## dsh-tool-web 的模型侧渲染

- `web_fetch` 的 provider 返回 `body.kind: 'html'` 时，`dsh-tool-web` 用 Turndown + GFM 转成 Markdown，再交给模型；provider 不需要、也不应该自己处理标签。
- `web_search` 的 `summary` 由 `tool-web.searchSummaryMaxChars` 截断，**默认 800 字**；provider 的 `maxSnippetChars` 不会绕过这个上限。
- `web_fetch` 的模型输出上限是 `tool-web.fetchMaxOutputChars`，默认 200000 字；转换前只处理 source 字符串的前 200000 字。

## 管理路由的请求信任

设置页的三个 provider 管理路由（`/dsh-web-search/health`、`/dsh-web-search/models`、`/dsh-web-search/quotas`）把请求信任判定委托给 Host Connection 服务的 `requestRejection(request)`（`lib/health.js` 的 `isTrustedRequest`）。它先跑 Host/Origin 栅栏（回环或受信 host、无 cross-site 标记、带 Origin 时须与 Host 同源），再要求浏览器或 API 凭据。桌面壳的转发器会剥掉 `host`、`origin`、`cookie` 与 `sec-fetch-site`，再附上 Host 认证 cookie，只有通过这套凭据校验才放行。

- 无 `connection` 服务、或该服务没有 `requestRejection` 方法时，回退到本地 `sameOrigin(req)` 头检查：有 Origin 则须与 Host 同源，否则接受 `sec-fetch-site` 为 `same-origin` 或 `none`；两者都没有则拒绝。回退 fail-closed，不放行被剥头的桌面调用。
- 版本漂移：公开升级指南 v0.2.2-rc.2 记载 Connection 已移除 `requestRejection` 与 `ConnectionRequestRejection`、改用 `admit` 与 authentication；本机实测宿主 `0.2.2-rc.5` 仍导出该方法（`rpc.ts` 的 `HostConnectionHandle.requestRejection`，返回 `401 | 403 | undefined`）。`package.json` 的 `dsh.engines` 允许 `>=0.2.2-rc.3 <0.4.0-0`，某受支持宿主若真没有该方法就会静默回退 `sameOrigin`，桌面转发调用因缺 Origin/Sec-Fetch-Site 被拒为 403——功能失效（fail-closed），不是安全回退。`test/health.test.js` 用无 `requestRejection` 的 stub connection 钉住这条回退路径。
- 同源回退的已知边界：没有 Connection 时 `sameOrigin` 只看请求头，能自行伪造 `sec-fetch-site` 的非浏览器客户端可以借此通过。浏览器脚本无法设置这个 forbidden header，跨站浏览器 POST 会带不匹配的 Origin 被拒；DSH 自身的 `isTrustedApiRequest` 也刻意接受无 Origin 的请求，以 Host 作为 DNS-rebinding 栅栏。故不把回退收紧成「必须有 Origin」：那会比宿主官方栅栏更严、可能拒掉宿主认可的合法请求，而 header-only 信任对能伪造头的非浏览器客户端本就不是安全边界。真实信任以 Connection 的凭据校验为准，回退只是「纯浏览器可用」的尽力而为。

## preset 拥有 tool-web

DSH `0.2.2-rc.3` 的 `standard` preset 在 `@deepseek-ai/dsh-web-app` 的 `presets/standard.patch.yml` 内声明 `tool-web`（只配 `fetch` 与 `searchTimeoutMs`，`searchSummaryMaxChars` 走 800 默认值）。bundle patch 里的 `- id: tool-web` 命中不了 preset 内的子行，因此：

- 不要在插件 patch 里声明这个 cap。
- 官方覆盖通道是 profile patch 里 `- id: preset-standard` 整体重述 preset 声明：`config` 整体替换、不深合并，必须完整重述 `id` / `order` / `plugins` 列表（DSH 宿主的 compositions 参考记录了该机制）。代价是覆盖会把 preset 钉在重述时的状态，DSH 升级后要刷新该块。面向用户的操作步骤见 [提高摘要上限](cookbook/raising-summary-cap.md)。
- 用 `dsh --profile <name> --dump-config` 检查最终组合，不要只看 bundle patch。

## DeepSeek 的两条链路

- `@deepseek-ai/dsh-web-search-deepseek`（provider id `deepseek-official`）通过 Anthropic 兼容的 Messages 调用原生 `web_search_20250305`；每次搜索跑一轮模型，返回 citation 片段。
- DeepSeek 付费 API `POST https://api.deepseek.com/v1/tools/search` 与 `GET /v1/tools/fetch` 是另一条链路，仅供 `scripts/public-benchmark.mjs` 的对比使用；运行时不得调用。
- 两者不要混称「DeepSeek Search」。

## profile 组合顺序

1. `package.json` 的 `dsh.profile.bundles`，按顺序叠加。
2. profile 的 `cordis.patch.yml`。
3. `--patch` 覆盖层。
4. 顶层 host 行与 preset 子行是两种作用域；`- id: preset-standard` 的 `config.plugins` 不会按子 id 深合并。

## 检查 DSH 内部

- 安装目录：`<DSH 安装目录>/resources/app.asar/dsh/node_modules/@deepseek-ai/`；Windows Desktop 默认安装在 `%LOCALAPPDATA%\Programs\DeepSeek Harness`。
- 宿主源码公开于 https://github.com/deepseek-ai/deepseek-harness；克隆后跑 `codegraph init` 建索引，即可用 `codegraph_explore` 按 projectPath 查宿主调用关系。
- `app.asar` 里的文件可以用 `read` 直接读；PowerShell 的 `Get-ChildItem` 不要递归 `profiles/node_modules`，会输出数万行。
- 排查 profile 时只读 `package.json`、`cordis.patch.yml`、`cordis.yml`；需要完整组合时用 `--dump-config`。
- 查外部文档优先试 `.md` 页面或站点的 `llms.txt`，不要把 200KB 的 HTML 整页塞进上下文。
