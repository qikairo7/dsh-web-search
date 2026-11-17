# 开发指南

面向贡献者的安装、日常命令、CI 和排错。实现规则见 [CODING_STANDARDS](../CODING_STANDARDS.md)，文档规则见 [docs/AGENTS.md](AGENTS.md)，架构地图见 [docs/architecture.md](architecture.md)。

## 查证顺序

回答「X 是怎么工作的」类问题时，按此顺序取证据：**先看运行时实际行为**（跑命令观察输出、读当前代码、用 codegraph 查调用关系），**再看本文档**；文档可能落后于代码，以代码为准。两者都不足以确认时，在产出里明确写「未验证」，不把推测当事实。

## 环境要求

- Node.js `22.19+` 或 `24+`。
- pnpm；只用 pnpm，不生成第二份 lockfile。
- DeepSeek Harness `0.2.2-rc.3`（本插件实测版本）。
- 一个挂载 `dsh-web` 的 profile；bundle patch 会启用 `dsh-tool-web`。

## 首次设置

```sh
pnpm install
git config core.hooksPath .githooks
pnpm docs:check
pnpm check
```

`pnpm check` 依次运行语法检查、架构检查、order-doc 同步门禁、文档代码块检查、文档门禁和单测；pre-commit hook 只运行语法检查，pre-push hook 在推送前运行一次全量 `pnpm check`。

## 日常命令

| 命令 | 用途 |
|---|---|
| `pnpm test` | 只跑 `node --test` |
| `pnpm check` | 语法检查 + 架构检查 + order-doc 同步 + 文档代码块 + `docs:check` + 单测，提交前门禁 |
| `pnpm docs:check` | 只跑文档层级、链接、配置覆盖和预算检查 |
| `node --test --test-isolation=none test/<name>.test.js` | 跑单个测试文件 |
| `node scripts/check-pr-gate.mjs --body-file <path>` | 校验 PR 正文门禁（章节结构、证据、徽章） |
| `pnpm benchmark:preflight` | 先验证凭据与各后端连通性 |
| `pnpm benchmark` | live 基准；自动加载 gitignored `.env`，需要 `AS_KEY`、`TV_KEY`、`FC_KEY`、`ZH_KEY`、`SF_KEY`、`DS_TOKEN` |
| `pnpm benchmark:refresh` | 刷新基准 fixture |
| `pnpm quality:probe` | 免费后端 14 条日常质量探针；结果写 `.research/quality-probe.json` |
| `dsh plugin --profile desktop add "<仓库路径>"` | 安装到本机 DSH，安装后重启 DSH |

`pnpm benchmark` 优先读 `scripts/fixtures/public-benchmark-sample.json`；`SAMPLE_SIZE` 控制每个基准的行数，默认 50；默认 search-only，`BENCHMARK_ENRICH=1` 才启用 evidence enrichment；结果写 `.research/public-benchmark.json`（gitignored），不提交。真实 API 验收需要 `.env` 中的凭据；`pnpm benchmark:preflight` 会先检查全部后端。

## DSH 沙箱

DSH 沙箱会拦截 Node 测试运行器的子进程，`node --test` 可能报 `spawn EPERM`。这时改用：

```sh
node scripts/check-syntax.mjs && node scripts/check-architecture.mjs && node scripts/check-order-sync.mjs && node scripts/check-doc-code.mjs && node --test --test-isolation=none
```

单文件同理：`node --test --test-isolation=none test/<name>.test.js`。`pnpm docs:check` 不启动子进程，可以直接运行。

## CI 与 Hook

- `.github/workflows/check.yml` 在 Node 22 和 24 上运行 `pnpm install --frozen-lockfile` 和 `pnpm check`，并在 `pull_request` 上运行 `pr-gate` 检查 PR 正文。
- `.githooks/pre-commit` 运行 `node scripts/check-syntax.mjs`（仅语法检查）；`.githooks/pre-push` 在推送前运行全量 `pnpm check`。首次 clone 后用 `git config core.hooksPath .githooks` 启用。
- 仓库没有 `dev` / `build` / `lint` / `typecheck` 脚本；不要运行不存在的命令。

## 环境变量

插件通过 DSH 凭据服务读取 API Key，凭据放在 `~/.dsh/.credentials.yaml` 或启动环境变量。基准脚本使用 `AS_KEY`、`TV_KEY`、`FC_KEY`、`ZH_KEY`、`SF_KEY`、`DS_TOKEN`；推荐放在仓库根目录的 `.env`（gitignored，格式见 `.env.example`），不要写进 shell 命令。不要提交真实密钥或 `.credentials.yaml`。

## 常见问题

- **测试报 `spawn EPERM`**：这是 DSH 沙箱限制，不是测试失败；按上面的单进程命令重跑。
- **文档检查失败**：看 `pnpm docs:check` 的 `- <file>: ...` 行；常见原因是相对链接失效、README 配置字段缺失、预算超标或 Agent Note 缺章节。
- **文档代码块检查失败**：看 `doc code-block check failed:` 之后的 `- <file> (<lang> block #<N>)` 行；示例不可解析时修文档；显示 `checker ... unavailable` 是本机缺 node 或 bash，不是文档问题。
- **Provider 未就绪**：Tavily、Firecrawl 或知乎缺少对应 Key 时会被路由器跳过；这不是代码错误。
- **基准没有网络**：fixture 优先；需要 live 数据时再设置 `.env` 和 `SAMPLE_SIZE`，先跑 `pnpm benchmark:preflight`。

## 相关文档

- [架构](architecture.md)
- [文档标准](AGENTS.md)
- [测试策略](testing.md)
- [实现标准](../CODING_STANDARDS.md)
- [Issue 与 PR 流程](agents/issue-tracker.md)
