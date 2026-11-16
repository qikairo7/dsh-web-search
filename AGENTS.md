# dsh-web-search

DSH 插件：实现 `ctx.web` 的搜索/抓取 Provider，用免费后端替换官方收费的 DeepSeek Search/Fetch；通用 `web_search` / `web_fetch` 仍由第一方 `dsh-tool-web` 提供，另有可选的 AnySearch / Tavily / AIHOT 高级工具。

## 依赖方向

`lib/index.js` → `lib/providers/*` → `lib/*` 共用模块。共用模块不得 import `providers/` 或 `index.js`。

## 运行

```sh
pnpm install
pnpm docs:check   # 文档层级、链接、模块地图、配置覆盖与预算
pnpm check        # 全量语法检查 + 架构 + order-doc 同步 + 文档代码块 + 翻译配对 + docs:check + node --test
pnpm benchmark:preflight # 先验证凭据与各后端连通性
pnpm benchmark    # live 基准；自动加载 gitignored 的 .env（AS_KEY/TV_KEY/FC_KEY/ZH_KEY/SF_KEY/DS_TOKEN/KEENABLE_API_KEY/EXA_API_KEY）
```

Node `22.19+` 或 `24+`，只用 pnpm。DSH 沙箱报 `spawn EPERM` 时，改用 `docs/development.md` 的沙箱等价命令。

## 硬边界

- `lib/` 不调用 DeepSeek 付费 Search/Fetch API。
- 不新增 MCP server 或 `@modelcontextprotocol/*` 依赖。
- 不提交真实密钥或 `.credentials.yaml`；key 只从环境变量或 gitignored `.env` 读，不写进 shell 命令。

## 指针

- 日常 `pnpm check`；命令、环境与排错见 `docs/development.md`。
- 改代码：`docs/architecture.md`；DSH 集成/`tool-web`：`docs/dsh-host-contract.md`。
- 写代码/Review/新 Provider：`CODING_STANDARDS.md`、`docs/cookbook/adding-a-provider.md`。
- 配置/路由/配额：README Behavior、`docs/configuration.md`。
- 改文档：`docs/AGENTS.md`；术语：`GLOSSARY.md`。
- 决策：`docs/adr/`、`.agents/notes/`。
- Issue/PR：`docs/agents/issue-tracker.md`、`docs/pr-gate.md`。
- PR 正文与推前检查：`.agents/skills/`。
