# CODING_STANDARDS

实现与 Review 的唯一标准。开始写代码前读完本文件；当前行为以 `README.md` / `README.zh.md` 的 Behavior details 为准，配置字段、默认值和配额以 `docs/configuration.md` 为准，本文不复制默认值表。

## 1. 仓库结构与发布

模块地图、请求流和扩展点见 `docs/architecture.md`。本节只规定发布边界：

- `lib/**/*.js` 是唯一随包发布的 JS；新增运行时文件放在 `lib/`，否则同步修改 `package.json#files`。
- `package.json` 的 `scripts` 是命令的唯一来源；仓库没有 `dev` / `build` / `lint` / `typecheck` 脚本。
- 基准结果写 `.research/`（gitignored），不提交；临时脚本同样不提交。
- 依赖方向以 `AGENTS.md` 为准：`lib/index.js` → `lib/providers/*` → `lib/*` 共用模块，反向 import 是架构缺陷。

## 2. 实现原则

- **先问再扩**：为一个推测出来的、几乎不会发生的并发或安全边界增加复杂度之前，先说明具体问题、发生概率和额外代码量，得到确认再加；不要为「理论上更稳」悄悄扩大范围。
- **边界校验一次**：未知值只在拥有它的边界校验并归一化一次：HTTP 响应在 mapper、配置在 `Config` / `resolveSettings`、用户输入在 provider 入口。往里传已定型的值，不重复 `typeof` / 属性存在性检查，也不再复查 schema 或构造器已保证的值。
- **不提前抽象**：只调用一次的逻辑直接写在调用处；只有会复用、藏着真正复杂的边界，或有清晰独立命名能改善调用方时才抽函数。复杂函数让主流程保持 happy path，校验细节可下沉到下方具名 helper。Provider 的 `mapXxxSearch()` 会被单测直接调用，属于复用点。
- **少用 try/catch**：只在必须把异常转成 `WEB_*` 错误的边界（provider 的 `search` / `fetch`、HTTP 请求）使用；不要用 try/catch 做流程控制，也不要为不存在的异常加防御。能一个函数写完就不拆。

## 3. Provider 契约、代码风格与实现模式

### 契约

- 每个 provider 实现 `id`、`title`、`description`、`available()`、`ready()`，并按能力实现 `search()` 或 `fetch()`。
- 默认只实现 `ctx.web` provider；例外是 `lib/tools/` 下的 AnySearch / Tavily / AIHOT 高级工具（由 ADR-0004/0005/0006 授权），通用 `web_search` / `web_fetch` 仍由 `dsh-tool-web` 提供、入参与结果形状不变。
- 后端 provider 固定三段式：`XXX_PROVIDER_ID` 常量、`mapXxxSearch()` 纯映射、`XxxProvider` 类。映射函数只做数据转换和 envelope 校验，类只做 IO。
- 后端 Provider 构造函数接收 `{ settings, resolveKey }`（不需要凭据的只收 `{ settings }`）；`settings()` 是 thunk，每次操作开头读一次，不要把配置缓存到实例字段。
- Provider 的 `description` 返回 `{ en, zh }` 双语；用户可见文案保持中英对应。

### 实现

- HTTP 统一走 `lib/http.js` 的 `joinURL` / `requestJSON` / `requestText`（超时、取消、解析、错误码）。只有 `lib/http.js`、`lib/providers/http.js`（重定向与内容类型策略）和独立客户端 `lib/providers/anysearchClient.js` 可以直接调用 `fetch`。
- Provider 的每次后端调用走 `lib/providers/shared.js` 的 `providerOperation()`：超时接线（fetch 语义自动带 `WEB_FETCH_TIMEOUT`）、错误边界与诊断标签由骨架统一拥有；adapter 只声明 endpoint、请求构造与 `map` 结果映射。`USER_AGENT` 只从 shared.js 引用。
- 外部 API 响应在对应 mapper 入口校验并归一化一次（HTTP 抓取在 `providers/http.js` 内一次）：坏条目丢弃；只有业务 envelope 错误才 throw。内部函数直接使用已校验的值。
- Provider 边界统一用 `toWebError(error, 'Provider', 'search'|'fetch')` 转换错误，或用 `webError(message, 'WEB_*')` 抛错；新错误码保持 `WEB_` 前缀；非 seam 错误已携带的 `WEB_*` code 会被保留；不让裸 `Error` 穿出 provider 边界。
- 不在 provider 里直接读 `process.env` 或 `ctx.config`；用 `resolveKey` 和 `settings()`。

### 风格

- ESM JavaScript，无 TypeScript、无构建步骤。2 空格缩进、单引号、分号、多行尾逗号、大数字写 `30_000`。仓库没有 ESLint/Prettier，格式跟随邻近文件。
- `lib/` 每个文件首行写一句话 JSDoc；导出的函数和类写 JSDoc，参数复杂时用 `@param`。
- 不要用 `import * as`，也不要用 `import { foo as bar }` 之类的 import 别名。
- 注释写非显然的约束和意外行为，不复述显而易见的赋值或控制流。

## 4. 配置

- 每个配置字段在 `lib/settings.js` 的 `SETTINGS_SPEC` 声明一次：`key`、`path`（兼任默认值在 `DEFAULT_SETTINGS` 中的指针）、`kind` 与约束（`min` / `max` / `step`）；`DEFAULT_SETTINGS` 提供默认值，`Config` 与 `resolveSettings` 都由 spec 生成。
- `*ApiKeyEnv` 字段在 spec 里标 `role: 'credential-ref'`。
- 每个字段由 `resolveSettings` 校验并有默认值；代码里不藏开关常量。
- 当前默认值和配额不在本文件复述：`docs/configuration.md` 是用户可见配置事实，`lib/settings.js` 的 `DEFAULT_SETTINGS` 是代码事实；改默认值或配额时，`docs/configuration.md`、两份 README 的配额说明与 `DEFAULT_SETTINGS` 同步（ADR-0003）。

## 5. 测试

- 测试用 `node:test` + `node:assert/strict`；测试名写成行为句；测真实实现，不把实现逻辑复制进测试。
- 用本地 stub provider；需要拦截 HTTP 的测试用 `test/helpers/withFetch.js`，不要在各测试内手写保存/恢复 `globalThis.fetch`；不引入 mock 库。
- 新行为在映射层和路由层都有覆盖；行为改动必须有一个改动前失败、改动后通过的测试；纯文档或格式改动不需要新增测试。
- 单文件：`node --test --test-isolation=none test/<name>.test.js`。沙箱的 `spawn EPERM` 变体见 `AGENTS.md` 的「运行」。
- `test/architecture.test.js` 会扫描 `lib/` 和 `scripts/` 中的付费 API 标记（`api.deepseek.com`、`/v1/tools/search`、`/v1/tools/fetch`、`x-dsh-auth-token`）；只有 `scripts/public-benchmark.mjs` 例外。不要绕过或削弱该测试，也不要把基准脚本里的对比调用复制进运行时。

## 6. 完成标准

提交前逐条自检：

- `pnpm check` 退出码为 0；DSH 沙箱按 `AGENTS.md` 的等价命令验证，并在汇报中注明沙箱限制。
- 测试满足 §5；纯文档或格式改动确认无需新增测试。
- 涉及后端协议、凭据解析、路由顺序或 DSH 注册的改动：有凭据时跑 `pnpm benchmark`，或安装并重启 DSH 后用 `web_search`（中英文各一次）和 `web_fetch` 各验证一次；纯逻辑改动以单测为准。
- 新配置字段满足 §4；新 Provider 同时完成：provider 文件、`lib/catalog.js` 条目与 `lib/index.js` factory（注册顺序由 catalog 派生）、配置与默认值、`docs/configuration.md` 配置表、两份 README 的 Provider 表、映射测试、路由顺序与回退测试。
- 默认值或配额变化时，更新 `docs/configuration.md` 的配置表和两份 README 的免费额度说明（ADR-0003 要求）；随包默认行为变化时同步 `cordis.patch.yml`。

## 7. 文档

文档层级、事实归属、写作规则、篇幅预算和机械检查见 `docs/AGENTS.md`。中文文风按 `tech-doc-style-chinese`，术语按 `GLOSSARY.md`；两份 README 保持同步；契约变化先写 ADR。`pnpm docs:check` 单独验证文档，`pnpm check` 已包含它。

## 8. 协作与提交

- 默认分支是 `main`；从 `origin/main` 切工作分支，PR 对 `main`。
- 分支名用 2 到 3 个短词、连字符分隔，如 `fix-router-fallback`；不要 `feat/` 之类前缀。
- 提交信息和 PR 标题用 `type(scope): summary`；`type` 取 `feat`、`fix`、`docs`、`chore`、`refactor`、`test`，`scope` 可选。
- Issue、子任务和 PR 流程：`docs/agents/issue-tracker.md`。

## 9. Review 门禁

按 artifact 展开的规则见 `docs/defensive-patterns.md`；以下是必须逐项核对的总门禁。以下任一项不满足即阻塞合并。Review 时逐项核对，不只看 diff。

1. **契约**：provider 实现 `id`、`title`、`description`、`available()`、`ready()`、`search()` / `fetch()`；`web_search` / `web_fetch` 的入参与结果形状不变；设置页仍由 `Config` 生成。
2. **回退语义**：只有可恢复错误（网络、超时、429、5xx、凭据缺失）触发下一个 provider；取消和非法 URL 立即返回；直连 HTTP 的 404 作为结果返回；熔断只统计可恢复失败。
3. **配额与延迟**：数清每次查询新增的外部调用；正常路径下 quality 模式不超过 4 个免费搜索 provider（AI 新闻组合）+ 1 次 official-docs 搜索（仅免费结果缺官方域时）+ 1 次 embedding + 1 次 rerank + 最多 5 次补全抓取；缓存 key 覆盖所有影响结果的设置；循环有界。
4. **输入健壮性**：入口对空响应、字段类型错误、超大响应、非 HTML/JSON 内容类型做一次校验或归一化；内部层不重复判型，不因单条坏数据丢掉整批结果。
5. **配置**：每个字段经 `resolveSettings` 校验并有默认值；没有藏在代码里的开关常量。
6. **测试与文档**：新行为在映射层和路由层都有覆盖；测试测真实实现、不复制实现逻辑；去掉实现后测试会失败；两份 README、`docs/configuration.md` 的配置表、默认值、配额说明一致；契约变化有 ADR。
7. **边界与依赖**：`AGENTS.md` 的硬边界全部满足，无未说明的新依赖；`lib/index.js` → `lib/providers/*` → `lib/*` 的依赖方向不被反转。
8. **实现克制**：除会被测试直接复用的 `mapXxxSearch()` 外，一次性逻辑没有被抽成函数；`try/catch` 只出现在错误边界；没有为未经确认的推测性复杂度增加代码。
