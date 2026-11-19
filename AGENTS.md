# dsh-web-search

DSH 插件：实现 `ctx.web` 的搜索/抓取 Provider，用免费后端替换官方收费的 DeepSeek Search/Fetch；通用 `web_search` / `web_fetch` 仍由第一方 `dsh-tool-web` 提供，另有可选的 AnySearch / Tavily / AIHOT 高级工具。

## 依赖方向

`lib/index.js` → `lib/providers/*` → `lib/*` 共用模块。共用模块不得 import `providers/` 或 `index.js`。

## 运行

```sh
pnpm install
pnpm docs:check   # 文档层级、链接、模块地图、配置覆盖与预算
pnpm check        # 全量语法检查 + docs:check + node --test
pnpm benchmark:preflight # 先验证凭据与各后端连通性
pnpm benchmark    # live 基准；自动加载 gitignored 的 .env（AS_KEY/TV_KEY/FC_KEY/ZH_KEY/SF_KEY/DS_TOKEN/KEENABLE_API_KEY/EXA_API_KEY）
```

Node `22.19+` 或 `24+`，只用 pnpm。DSH 沙箱报 `spawn EPERM` 时，改用 `node scripts/check-syntax.mjs && node --test --test-isolation=none`。

## 硬边界

- 默认只实现 `ctx.web` provider；例外是 `lib/tools/` 下的 AnySearch 高级工具（`anysearch_capabilities`、`anysearch_search`、`anysearch_batch_search`）、Tavily 高级工具（`tavily_search`、`tavily_extract`）与 AIHOT 免费资讯工具（`aihot_latest`、`aihot_hot`），不复制 `dsh-tool-web` 的通用工具层。
- `lib/` 不得调用 DeepSeek 付费 Search/Fetch API；不得新增 `@modelcontextprotocol/*` 依赖或 MCP server。
- 标准 provider id 固定为 `keenable`、`anysearch`、`exa`、`bing`、`tavily`、`firecrawl`、`zhihu`、`zhihu-site`、`aihot`、`http`、`auto`；新增后端先写 ADR 再注册唯一 id。
- 不改 `cordis.patch.yml` 的 `web-fetch-http: disabled`；`http` id 属于本插件。
- 不提交真实密钥或 `.credentials.yaml`；基准从 `.env` / 环境变量读 key，`.env` 已 gitignore，不写进 shell 命令。
- 不静默推翻 `docs/adr/` 的已接受决策；有冲突先说明，再写新 ADR。

## 指针

- 改代码前读 `docs/architecture.md`；DSH 集成/`tool-web`：`docs/dsh-host-contract.md`。
- 文档规则：`docs/AGENTS.md`。
- 开发/测试：`docs/development.md`、`docs/testing.md`、`docs/cookbook/adding-a-provider.md`。
- 路由/配置/配额：读 README 的 Behavior 与 `docs/configuration.md`。
- 写代码或 Review：`CODING_STANDARDS.md`（实现原则、Provider 契约、测试、完成与 Review 门禁）；artifact 级细节见 `docs/defensive-patterns.md`。
- 决策记录：`.agents/notes/`，格式见目录 README。
- 查术语与架构决策：`GLOSSARY.md`、`docs/adr/`；导航见 `docs/agents/domain.md`。
- 基准：`docs/benchmarks/`；runner `scripts/public-benchmark.mjs`。
