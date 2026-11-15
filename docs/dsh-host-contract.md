# DSH 宿主契约

本文件记录插件开发时最容易误判的 DSH 宿主行为。这里只写与 `dsh-web-search` 集成有关的事实；实现规则见 [CODING_STANDARDS](../CODING_STANDARDS.md)，模块地图见 [architecture](architecture.md)。

## dsh-tool-web 的模型侧渲染

- `web_fetch` 的 provider 返回 `body.kind: 'html'` 时，`dsh-tool-web` 用 Turndown + GFM 转成 Markdown，再交给模型；provider 不需要、也不应该自己处理标签。
- `web_search` 的 `summary` 由 `tool-web.searchSummaryMaxChars` 截断，**默认 800 字**；provider 的 `maxSnippetChars` 不会绕过这个上限。
- `web_fetch` 的模型输出上限是 `tool-web.fetchMaxOutputChars`，默认 200000 字；转换前只处理 source 字符串的前 200000 字。

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
- `app.asar` 里的文件可以用 `read` 直接读；PowerShell 的 `Get-ChildItem` 不要递归 `profiles/node_modules`，会输出数万行。
- 排查 profile 时只读 `package.json`、`cordis.patch.yml`、`cordis.yml`；需要完整组合时用 `--dump-config`。
- 查外部文档优先试 `.md` 页面或站点的 `llms.txt`，不要把 200KB 的 HTML 整页塞进上下文。
