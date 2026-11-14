# dsh-web-search

DSH 插件：只实现 `ctx.web` 的搜索/抓取 Provider，用免费额度后端替换官方收费的 DeepSeek Search/Fetch；模型工具仍由第一方 `dsh-tool-web` 提供。

## 依赖方向

`lib/index.js` → `lib/providers/*` → `lib/*` 共用模块。共用模块不得 import `providers/` 或 `index.js`。

## 运行

```sh
pnpm install
pnpm check        # node --check lib/index.js && node --test
pnpm benchmark    # live 基准；需要 AS_KEY/TV_KEY/FC_KEY/ZH_KEY/SF_KEY/DS_TOKEN
```

Node `22.19+` 或 `24+`，只用 pnpm。DSH 沙箱报 `spawn EPERM` 时，改用 `node --check lib/index.js && node --test --test-isolation=none`。

## 硬边界

- 只实现 `ctx.web` provider，不注册模型面向的工具；工具层归 `dsh-tool-web`。
- `lib/` 不得调用 DeepSeek 付费 Search/Fetch API；不得新增 `@modelcontextprotocol/*` 依赖或 MCP server。
- 标准 provider id 固定为 `anysearch`、`tavily`、`firecrawl`、`zhihu`、`zhihu-site`、`aihot`、`http`、`auto`；新增后端先写 ADR，再注册唯一 id。
- 不改 `cordis.patch.yml` 的 `web-fetch-http: disabled`；`http` id 属于本插件。
- 不提交真实密钥或 `.credentials.yaml`；基准只从环境变量读 key。
- 不静默推翻 `docs/adr/` 的已接受决策；有冲突先说明，再写新 ADR。

## 指针

- 改路由、配置、默认值或配额：先读 `README.md` / `README.zh.md` 的 Behavior details 与 Configuration，两份同步。
- 写代码、改文档或 Review：`CODING_STANDARDS.md`（仓库结构、实现原则、Provider 契约、测试、文档规范、完成与 Review 门禁）。
- 查术语与架构决策：`GLOSSARY.md`、`docs/adr/`；导航见 `docs/agents/domain.md`。
- 开 Issue 或提 PR：`docs/agents/issue-tracker.md`。
- 查历史基准或改基准：`docs/benchmarks/`；runner 是 `scripts/public-benchmark.mjs`。
