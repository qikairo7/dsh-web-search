# 开发指南

面向贡献者的安装、日常命令、CI 和排错。实现规则见 [CODING_STANDARDS](../CODING_STANDARDS.md)，文档规则见 [docs/AGENTS.md](AGENTS.md)，架构地图见 [docs/architecture.md](architecture.md)。

## 查证顺序

回答「X 是怎么工作的」：**先看运行时实际行为**（跑命令、读代码、codegraph 查调用），**再看本文档**；文档可能落后，以代码为准。仍不足时写明「未验证」，不把推测当事实。

## 新增机械门禁的节奏

往 `pnpm check` 加新门禁脚本时：先以 **observe 模式**跑一轮（只打印、不设退出码），确认没有误伤再转为 enforce；直接 enforce 可能在合法提交上误红，教贡献者绕检查。

## 环境要求

- Node.js `22.19+` 或 `24+`。
- pnpm；只用 pnpm，不生成第二份 lockfile。
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) `0.2.2-rc.5`（本插件实测版本）。
- 一个挂载 `dsh-web` 的 profile；bundle patch 会启用 `dsh-tool-web`。

## 首次设置

```sh
pnpm install
git config core.hooksPath .githooks
pnpm docs:check
pnpm check
```

`pnpm check` 依次运行全部八段门禁（见下表）；pre-commit hook 只运行语法检查；全量门禁由 CI 在推送后执行。

各双语对同步编辑后，运行 `node scripts/translation-pairing.mjs --record` 重建配对基线；只改一侧会让 `pnpm check` 失败。

## 日常命令

| 命令 | 用途 |
|---|---|
| `pnpm test` | 只跑 `node --test` |
| `pnpm check` | 语法检查 + 架构检查 + order-doc 同步 + 文档代码块 + 翻译配对门禁 + `docs:check` + 文档引用存活 + 单测，提交前门禁 |
| `pnpm docs:check` | 只跑文档层级、链接、配置覆盖和预算检查 |
| `node --test --test-isolation=none test/<name>.test.js` | 跑单个测试文件 |
| `pnpm benchmark:preflight` | 先验证凭据与各后端连通性 |
| `pnpm benchmark` | live 基准；需要 `.env` 中的凭据（见环境变量） |
| `pnpm benchmark:refresh` | 刷新基准 fixture |
| `pnpm quality:probe` | 免费后端 14 条日常质量探针；结果写 `.research/quality-probe.json` |
| `dsh plugin --profile desktop add "<仓库路径>"` | 安装到本机 DSH，安装后重启 DSH |
| `codegraph init` | 重建代码图谱索引；索引只落在运行命令的检出，worktree 不共享；查函数调用关系用 `codegraph_explore`；处理本仓库 PR 前后随手跑一次 |
| `codegraph affected <文件>` | 改 `lib/` 之前，列出受影响的测试；依赖当前检出里的索引，worktree 没有，回主检出跑 |
| `codebase-memory-mcp cli trace_path --project dsh-web-search --function-name <名>` | 查调用链；命令不在 PATH 时用它的完整路径 |
| `ocr review --from main` | 开 PR 后可选的筛子 |

`pnpm benchmark` 优先读 `scripts/fixtures/public-benchmark-sample.json`；`SAMPLE_SIZE` 控制每个基准的行数，默认 50；默认 search-only，`BENCHMARK_ENRICH=1` 启用 enrichment；结果写 `.research/public-benchmark.json`（gitignored）。真实 API 验收需要 `.env` 中的凭据；`pnpm benchmark:preflight` 会先检查全部后端。

## autocorrect（可选工具）

`pnpm lint:zh` 检查中文排版（留白、标点），改中文文档前后各跑一次；不进 `pnpm check` 与 CI。

Windows：从 [releases](https://github.com/huacnlee/autocorrect/releases) 下载 `autocorrect-windows-amd64.zip`，`autocorrect.exe` 放 PATH（如 `%APPDATA%\npm\`）；macOS：`brew install autocorrect`。装好跑 `autocorrect --version` 核对（2.16.x）。

不要装 `autocorrect`（同名无关库）与 `@huacnlee/autocorrect`（WASM 无 CLI）；要走 npm 用 `autocorrect-node`（官方分发，带 `autocorrect` 命令）。没装时 `pnpm lint:zh` 报 command not found 属预期。

## DSH 沙箱

DSH 沙箱会拦截 Node 测试运行器的子进程，`node --test` 可能报 `spawn EPERM`。这时改用：

```sh
node scripts/check-syntax.mjs && node scripts/check-architecture.mjs && node scripts/check-order-sync.mjs && node scripts/check-doc-code.mjs && node scripts/translation-pairing.mjs && node scripts/verify-docs.mjs && node scripts/check-doc-refs.mjs && node --test --test-isolation=none
```

单文件同理：`node --test --test-isolation=none test/<name>.test.js`。`pnpm docs:check` 不启动子进程，可以直接运行。

## CI 与 Hook

- `.github/workflows/check.yml` 在 Node 22/24 上跑 `pnpm install --frozen-lockfile` 和 `pnpm check`；main 的 check 不被新推送取消，release 等绿跑。
- `.github/workflows/release.yml` 等被发布 commit 的 check 全绿后发布；等待≤30 分钟，job 预算 45 分钟。
- `.githooks/pre-commit` 运行 `node scripts/check-syntax.mjs`（仅语法检查）。首次 clone 后用 `git config core.hooksPath .githooks` 启用。
- 仓库没有 `dev` / `build` / `typecheck` 脚本；`lint:zh` 是可选的中文排版检查（见上文），不进 `pnpm check`。不要运行不存在的命令。

## 环境变量

插件通过 DSH 凭据服务读取 API Key，凭据放在 `~/.dsh/.credentials.yaml` 或启动环境变量。基准脚本使用 `AS_KEY`、`TV_KEY`、`FC_KEY`、`ZH_KEY`、`SF_KEY`、`DS_TOKEN`；推荐放在仓库根目录的 `.env`（gitignored，格式见 `.env.example`），不要写进 shell 命令。不要提交真实密钥或 `.credentials.yaml`。

## 常见问题

- **测试报 `spawn EPERM`**：这是 DSH 沙箱限制，不是测试失败；按上面的单进程命令重跑。
- **文档检查失败**：看 `pnpm docs:check` 的 `- <file>: ...` 行；常见原因是相对链接失效、README 配置字段缺失、预算超标或 Agent Note 缺章节。
- **文档代码块检查失败**：看 `doc code-block check failed:` 之后的 `- <file> (<lang> block #<N>)` 行；示例不可解析时修文档；`checker ... unavailable` 是本机缺 node/bash，不是文档问题。
- **Provider 未就绪**：Tavily、Firecrawl 或知乎缺少对应 Key 时会被路由器跳过；这不是代码错误。
- **基准没有网络**：fixture 优先；需要 live 数据时再设置 `.env` 和 `SAMPLE_SIZE`，先跑 `pnpm benchmark:preflight`。

## 相关文档

- [架构](architecture.md)
- [文档标准](AGENTS.md)
- [测试策略](testing.md)
- [实现标准](../CODING_STANDARDS.md)
