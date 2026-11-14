# dsh-web-search

DSH 插件：只实现 `ctx.web` 的搜索/抓取 Provider，用免费额度后端替换官方收费的 DeepSeek Search/Fetch。模型侧仍调用第一方 `dsh-tool-web` 的 `web_search` / `web_fetch`；本仓库不实现工具层。

## 项目结构

```
lib/index.js                 插件入口：name / inject / Config / apply，注册各 provider 与 auto 路由
lib/providers/               每个后端一个文件（anysearch、tavily、firecrawl、zhihu、aihot、http）
  router.js                  auto 路由：fast/quality 模式、回退、缓存、熔断、证据补全
lib/*.js                     共用模块：http、errors、credentials、settings、cache、intent、
                             technical、language、query、officialDocs、news、authority、
                             rerank、embeddings、summarize、clean、text
test/*.test.js               node:test 单测，按 lib 模块对应；不访问网络
scripts/public-benchmark.mjs FRAMES/WebWalkerQA 基准 runner，结果写到 .research/（gitignored）
docs/adr/                    已接受的架构决策；改契约前先读
docs/benchmarks/             历史基准报告
cordis.patch.yml             bundle patch：auto 为默认 provider、启用 tool-web、禁用自带 web-fetch-http
locale/{en,zh}.json          插件元数据文案
```

`lib/**/*.js` 是唯一随包发布的 JS；新增 JS 运行时文件放在 `lib/`，否则同步修改 `package.json#files`。

依赖方向：`lib/index.js` → `lib/providers/*` → `lib/*` 共用模块；共用模块不得 import `providers/` 或 `index.js`。

## 运行与测试命令

```sh
pnpm install                      # 安装依赖；CI 用 pnpm install --frozen-lockfile
pnpm check                        # node --check lib/index.js && node --test
pnpm test                         # 只跑 node --test
node --test --test-isolation=none test/router.test.js   # 跑单个测试文件
pnpm benchmark                    # live 基准；需要 AS_KEY/TV_KEY/FC_KEY/ZH_KEY/SF_KEY/DS_TOKEN
```

- Node `22.19+` 或 `24+`；只用 pnpm（CI 用 pnpm 11），不要生成第二份 lockfile。
- `pnpm benchmark` 优先读 `scripts/fixtures/public-benchmark-sample.json`，`SAMPLE_SIZE` 默认 50；结果写 `.research/public-benchmark.json`（gitignored），不要提交。
- 没有 `dev` / `build` / `lint` / `typecheck` 脚本；不要运行不存在的命令。
- DSH 沙箱会拦截测试运行器的子进程（`spawn EPERM`）：此时把 `node --test` 换成 `node --test --test-isolation=none`。完整验证用 `node --check lib/index.js && node --test --test-isolation=none`。
- 安装到本机 DSH：`dsh plugin --profile desktop add "<仓库路径>"`，然后重启 DSH。
- 首次 clone 后执行 `git config core.hooksPath .githooks`；pre-commit 会运行 `pnpm check`。

## 实现原则

- **先问再扩**：为一个推测出来的、几乎不会发生的并发或安全边界增加复杂度之前，先说明具体问题、发生概率和额外代码量，得到确认再加；不要为「理论上更稳」悄悄扩大范围。
- **边界校验一次**：未知值只在拥有它的边界（HTTP 响应在 mapper、配置在 `Config` / `resolveSettings`、用户输入在 provider 入口）校验并归一化一次；往里传已定型的值，不重复 `typeof` / 属性存在性检查，也不再复查 schema 或构造器已保证的值。
- **不提前抽象**：只调用一次的逻辑直接写在调用处；只有会复用、藏着真正复杂的边界，或有清晰独立命名能改善调用方时才抽函数。复杂函数让主流程保持 happy path，校验细节可下沉到下方具名 helper。Provider 的 `mapXxxSearch()` 会被单测直接调用，属于复用点。
- **少用 try/catch**：只在必须把异常转成 `WEB_*` 错误的边界（provider 的 `search` / `fetch`、HTTP 请求）使用；不要用 try/catch 做流程控制，也不要为不存在的异常加防御。能一个函数写完就不拆。

## 代码风格

- ESM JavaScript，无 TypeScript、无构建步骤。2 空格缩进、单引号、分号、多行尾逗号、大数字写 `30_000`。仓库没有 ESLint/Prettier，格式跟随邻近文件。
- `lib/` 每个文件首行写一句话 JSDoc；导出的函数和类写 JSDoc，参数复杂时用 `@param`。
- 后端 provider 固定三段式：`XXX_PROVIDER_ID` 常量、`mapXxxSearch()` 纯映射、`XxxProvider` 类。映射函数只做数据转换和 envelope 校验，类只做 IO。
- 后端 Provider 构造函数接收 `{ settings, resolveKey }`（不需要凭据的只收 `{ settings }`）；`settings()` 是 thunk，每次操作开头读一次，不要把配置缓存到实例字段。
- HTTP 统一走 `lib/http.js` 的 `joinURL` / `requestJSON`（超时、取消、JSON 解析、错误码）。只有 `lib/providers/http.js` 直接调用 `fetch`，因为它要实现重定向和内容类型策略。
- 外部 API 响应在对应 mapper 入口校验并归一化一次（HTTP 抓取在 `providers/http.js` 内一次）：坏条目丢弃；只有业务 envelope 错误才 throw。内部函数直接使用已校验的值。
- Provider 边界统一用 `toWebError(error, 'Provider', 'search'|'fetch')` 转换错误，或用 `webError(message, 'WEB_*')` 抛错；新错误码保持 `WEB_` 前缀。
- Provider 的 `description` 返回 `{ en, zh }` 双语；用户可见文案保持中英对应。
- 不要用 `import * as`，也不要用 `import { foo as bar }` 之类的 import 别名。
- 注释写非显然的约束和意外行为，不复述显而易见的赋值或控制流。
- 测试用 `node:test` + `node:assert/strict`；测试名写成行为句；测真实实现，不把实现逻辑复制进测试。用本地 stub provider；需要拦截 HTTP 的适配器/客户端测试可临时替换 `globalThis.fetch`，并在同一测试内恢复；不引入 mock 库。

## 文档规范

- 撰写、改写、校对或审阅本项目任何文档前，先加载 `tech-doc-style-chinese` 技能；该技能是本项目文档的标准规范。
- 适用范围包括 `AGENTS.md`、`README.md`、`README.zh.md`、`docs/**`、`locale/*.json` 中的中文文案，以及提交说明和 PR 描述。
- 保留事实、条件、限制、安全信息和确定程度；缺失信息标「待确认」，不自行补日期、数字、能力或结论。
- 术语按 `GLOSSARY.md` 的首选写法，不自行造同义词或换用近义词。
- 中文正文用直角引号「」，中英文、数字和版本号之间加半角空格，中文与行内代码之间加半角空格；中文段落一段一行，不做硬换行。
- 代码字面量、JSON 键名、URL、API 路径、字段名、命令和配置项保持原样，不做机器可读内容的排版替换。
- 存量文档在下次编辑时按本规范校正；不做与内容无关的全量重排。

## 协作约定

- 默认分支是 `main`；从 `origin/main` 切工作分支，PR 对 `main`。
- 分支名用 2 到 3 个短词、连字符分隔，如 `fix-router-fallback`；不要 `feat/` 之类前缀。
- 提交信息和 PR 标题用 `type(scope): summary`；`type` 取 `feat`、`fix`、`docs`、`chore`、`refactor`、`test`，`scope` 可选。

## 禁止事项

- `lib/` 不得调用 DeepSeek 付费 Search/Fetch API（`api.deepseek.com`、`/v1/tools/search`、`/v1/tools/fetch`、`x-dsh-auth-token`）；`test/architecture.test.js` 会扫描 `lib/` 和 `scripts/`，只有 `scripts/public-benchmark.mjs` 例外。基准脚本里的对比调用不要复制进运行时。
- 不得新增 `@modelcontextprotocol/*` 依赖或 MCP server。
- 不得注册模型面向的工具，只实现 `ctx.web` provider；工具层归 `dsh-tool-web`。
- 不得改标准 provider id：`anysearch`、`tavily`、`firecrawl`、`zhihu`、`zhihu-site`、`aihot`、`http`、`auto`。新增后端先写 ADR，再注册唯一 id。
- 不得让其他插件占用 `http` id，也不得改 `cordis.patch.yml` 的 `web-fetch-http: disabled`。
- 不在 provider 里直接读 `process.env` 或 `ctx.config`；用 `resolveKey` 和 `settings()`。
- 不让裸 `Error` 穿出 provider 边界；统一 `toWebError` / `webError`。
- 不提交真实密钥或 `.credentials.yaml`；基准只从环境变量读 key。
- 不静默推翻 `docs/adr/` 的已接受决策；有冲突先说明，再写新 ADR。

## 完成标准

- 提交前 `pnpm check` 退出码为 0；DSH 沙箱按上面的等价命令验证，并在汇报中注明沙箱限制。
- 行为改动必须有一个改动前失败、改动后通过的测试；纯文档或格式改动不需要新增测试。
- 涉及后端协议、凭据解析、路由顺序或 DSH 注册的改动：有凭据时跑 `pnpm benchmark`，或安装并重启 DSH 后用 `web_search`（中英文各一次）和 `web_fetch` 各验证一次；纯逻辑改动以单测为准。
- 新配置字段同时出现在 `lib/index.js` 的 `Config`（默认值引用 `DEFAULT_SETTINGS`，按现有模式包 `maybeVolatile`）、`lib/settings.js` 的 `DEFAULT_SETTINGS` 和 `resolveSettings`；`*ApiKeyEnv` 字段加 `.role('credential-ref')`。
- 新 Provider 同时完成：provider 文件、`lib/index.js` 注册（按 search/fetch 能力）、配置与默认值、`README.md` / `README.zh.md` 的 Provider 与配置表、映射测试、路由顺序与回退测试。
- 默认值或配额变化时，更新两份 README 的配置表和免费额度说明（ADR-0003 要求）；随包默认行为变化时同步 `cordis.patch.yml`。
- 最终 diff 不含 `.research/`、临时文件和密钥。

## Review 标准

以下任一项不满足即阻塞合并：

1. **契约**：provider 实现 `id`、`title`、`description`、`available()`、`ready()`、`search()` / `fetch()`；`web_search` / `web_fetch` 的入参与结果形状不变；设置页仍由 `Config` 生成。
2. **回退语义**：只有可恢复错误（网络、超时、429、5xx、凭据缺失）触发下一个 provider；取消和非法 URL 立即返回；直连 HTTP 的 404 作为结果返回；熔断只统计可恢复失败。
3. **配额与延迟**：数清每次查询新增的外部调用；正常路径下 quality 模式不超过 3 个搜索 provider + 1 次 official-docs 搜索 + 1 次 embedding + 1 次 rerank + 最多 5 次补全抓取；缓存 key 覆盖所有影响结果的设置；循环有界。
4. **输入健壮性**：入口对空响应、字段类型错误、超大响应、非 HTML/JSON 内容类型做一次校验或归一化；内部层不重复判型，不因单条坏数据丢掉整批结果。
5. **配置**：每个字段经 `resolveSettings` 校验并有默认值；没有藏在代码里的开关常量。
6. **测试与文档**：新行为在映射层和路由层都有覆盖；测试测真实实现、不复制实现逻辑；去掉实现后测试会失败；两份 README、配置表、默认值、配额说明一致；契约变化有 ADR。
7. **边界与依赖**：无付费 API、无 MCP、无密钥、无未说明的新依赖；`lib/index.js` → `lib/providers/*` → `lib/*` 的依赖方向不被反转。
8. **实现克制**：除会被测试直接复用的 `mapXxxSearch()` 外，一次性逻辑没有被抽成函数；`try/catch` 只出现在错误边界；没有为未经确认的推测性复杂度增加代码。

## 参考

- 术语：`GLOSSARY.md`；架构决策：`docs/adr/`。
- 行为细节与默认值：`README.md` / `README.zh.md` 的 Behavior / 行为、Configuration / 配置；改路由或配置前先读，改完两份同步。
- Issue / PR 流程：`docs/agents/issue-tracker.md`（GitHub Issues，用 `gh`）。
- 基准报告：`docs/benchmarks/`；runner：`scripts/public-benchmark.mjs`。
