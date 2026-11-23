# CODING_STANDARDS

实现与 Review 的唯一标准。开始写代码前读完本文件。当前行为以 `docs/architecture.md` 的请求流为准，配置字段、默认值和免费额度以 `docs/configuration.md` 为准，本文不复制默认值表。

## 1. 仓库结构与发布

模块地图、请求流和扩展点见 `docs/architecture.md`。本节只规定发布边界：

- `lib/**/*.js` 是唯一随包发布的 JS。新增运行时文件放进 `lib/`，否则同步修改 `package.json#files`。
- `package.json` 的 `scripts` 是命令的唯一来源。除 `lint:zh` 外，仓库没有 `dev` / `build` / `typecheck` 脚本，也不新增其他脚本类命令。`lint:zh` 是中文排版检查（autocorrect），本机装了才跑得动，属可选工具，不进 CI 与 `pnpm check`；安装方式与前置见 `docs/development.md` 的 autocorrect 节。
- 基准结果写 `.research/`（gitignored），不提交；临时脚本同样不提交。
- 依赖方向：`lib/index.js` → `lib/providers/*` → `lib/*` 共用模块。共用模块不得 import `providers/` 或 `index.js`，反向 import 是架构缺陷。`lib/tools/` 视同 provider 层。

## 2. 实现原则

- **先问再扩**：为一个推测出来、几乎不会发生的并发或安全边界增加复杂度之前，先说明具体问题、发生概率和额外代码量，得到确认再加。不要为「理论上更稳」悄悄扩大范围。
- **边界校验一次**：未知值只在拥有它的边界校验并归一化一次：HTTP 响应在 mapper，配置在 `Config` / `resolveSettings`，用户输入在 provider 入口。往里传已定型的值，不重复 `typeof` / 属性存在性检查，也不再复查 schema 或构造器已保证的值。
- **不提前抽象**：只调用一次的逻辑直接写在调用处。只有会复用、藏着真正复杂的边界，或有清晰独立命名能改善调用方时，才抽函数。复杂函数让主流程保持 happy path，校验细节可下沉到下方具名 helper。Provider 的 `mapXxxSearch()` 会被单测直接调用，属于复用点。
- **少用 try/catch**：只在必须把异常转成 `WEB_*` 错误的边界（provider 的 `search` / `fetch`、HTTP 请求）使用。不要用 try/catch 做流程控制，也不要为不存在的异常加防御。能一个函数写完就不拆。
- **待办写进交付说明**：不新增 `FIXME` / `TODO` / `XXX` 注释，待办与已知缺口写进交付说明或 PR 正文。存量注释不专门清理，碰到时按 §3 转换。
- **防御问句**：每个 `try/catch`、防御性 `if` 与兜底默认值都要答得出「删了会坏什么」。答不出就是调试残留或推测性防护，删除。原型期为摸索加的 guard 在契约建立后移除，让意外失败以栈轨迹暴露，而不是被吞成静默降级。

## 3. Provider 契约、代码风格与实现模式

### 契约

- 每个 provider 实现 `id`、`title`、`description`、`available()`、`ready()`，并按能力实现 `search()` 或 `fetch()`。
- 默认只实现 `ctx.web` provider。例外是 `lib/tools/` 下的 AnySearch / Tavily / AIHOT 高级工具（由 ADR-0004/0005/0006 授权），通用 `web_search` / `web_fetch` 仍由 `dsh-tool-web` 提供，入参与结果形状不变。
- 新增后端先写 ADR（`docs/adr/`），再在 `lib/catalog.js` 注册唯一 provider id（auto 复合路由在 `lib/providers/router.js` 注册）。`http` id 属于本插件，不改 `cordis.patch.yml` 的 `web-fetch-http: disabled`。
- 后端 provider 固定三段式：`XXX_PROVIDER_ID` 常量、`mapXxxSearch()` 纯映射、`XxxProvider` 类。映射函数只做数据转换和 envelope 校验，类只做 IO。
- 后端 Provider 构造函数接收 `{ settings, resolveKey }`（不需要凭据的只收 `{ settings }`）。`settings()` 是 thunk，每次操作开头读一次，不要把配置缓存到实例字段。
- Provider 的 `description` 返回 `{ en, zh }` 双语；用户可见文案保持中英对应。

### 实现

- HTTP 统一走 `lib/http.js` 的 `joinURL` / `requestJSON` / `requestText`（超时、取消、解析、错误码）。只有 `lib/http.js`、`lib/providers/http.js`（重定向与内容类型策略）和独立客户端 `lib/providers/anysearchClient.js` 可以直接调用 `fetch`。
- Provider 的每次后端调用走 `lib/providers/shared.js` 的 `providerOperation()`：超时接线（fetch 语义自动带 `WEB_FETCH_TIMEOUT`）、错误边界与诊断标签由骨架统一拥有；adapter 只声明 endpoint、请求构造与 `map` 结果映射。`USER_AGENT` 只从 shared.js 引用。
- 外部 API 响应在对应 mapper 入口校验并归一化一次（HTTP 抓取在 `providers/http.js` 内一次）：坏条目丢弃，只有业务 envelope 错误才 throw。内部函数直接使用已校验的值。
- Provider 边界统一用 `toWebError(error, 'Provider', 'search'|'fetch')` 转换错误，或用 `webError(message, 'WEB_*')` 抛错。新错误码保持 `WEB_` 前缀；非 seam 错误已携带的 `WEB_*` code 会被保留；不让裸 `Error` 穿出 provider 边界。
- 不在 provider 里直接读 `process.env` 或 `ctx.config`，用 `resolveKey` 和 `settings()`。

### 风格

- ESM JavaScript，无 TypeScript、无构建步骤。2 空格缩进、单引号、分号、多行尾逗号、大数字写 `30_000`。仓库没有 ESLint/Prettier，格式跟随邻近文件。
- 不要用 `import * as`，也不要用 `import { foo as bar }` 之类的 import 别名。
- 命名自带单位与全词：新代码的名字一眼见单位与含义（`timeoutMs`、`maxBatchSize`），不用 `tmp`、`data`、`info`、`handler` 类角色缩写。存量标识不改名，新代码从新。
- 经验数字常量带出处：测得或调参得来的数字在定义处注明来源与条件（如 `// measured 2026-11-20，空载`），纯规格数字不注。

### 注释纪律

信任金字塔：能用代码结构、命名与类型表达的不写注释；每条纠正优先做成 lint、静态检查或 pre-commit，报错指向根因；文档次之；注释最少化，禁借口注释。注释最易随重构漂移，还会给后续改动立坏先例。

- `lib/` 每个文件首行写一句话 JSDoc；导出的函数和类写 JSDoc，参数复杂时用 `@param`。
- 行内注释只写 WHY：非显然约束、意外行为、外部原因，不写代码在做什么。
- 禁止复述性注释与位置注释（「上面三个函数之后」类，重构即漂移失效）。
- 禁止借口注释，不写为将就辩护的话；说不清 WHY 的注释直接删。
- 禁流程标记：注释里不写 ★、【FIX】、`==== 区段 ====` 一类过程标记与分割横幅。

## 4. 配置

- 每个配置字段在 `lib/settings.js` 的 `SETTINGS_SPEC` 声明一次：`key`、`path`（兼任默认值在 `DEFAULT_SETTINGS` 中的指针）、`kind` 与约束（`min` / `max` / `step`）。`DEFAULT_SETTINGS` 提供默认值，`Config` 与 `resolveSettings` 都由 spec 生成。
- `*ApiKeyEnv` 字段在 spec 里标 `role: 'credential-ref'`。
- 每个字段由 `resolveSettings` 校验并有默认值，代码里不藏开关常量。
- 当前默认值和配额不在本文件复述：`docs/configuration.md` 是用户可见配置事实，`lib/settings.js` 的 `DEFAULT_SETTINGS` 是代码事实。改默认值或配额时，`docs/configuration.md`、两份 README 的配额说明与 `DEFAULT_SETTINGS` 同步（ADR-0003）。

## 5. 测试

- 测试用 `node:test` + `node:assert/strict`，测试名写成行为句，测真实实现，不把实现逻辑复制进测试。
- **flaky 纪律**：测试失败不许用 sleep、重试到过或条件跳过来「修复」，那是教 agent 用重跑代替修 bug。删除 flaky 测试前先在 PR 正文写明根因排查与无法修复的证据。性能类断言用数量级余量（见 `test/bench.test.js` 的 1/10 floor），不用紧阈值。
- 用本地 stub provider；需要拦截 HTTP 的测试用 `test/helpers/withFetch.js`，不要在各测试内手写保存、恢复 `globalThis.fetch`。不引入 mock 库。
- 新行为在映射层和路由层都有覆盖；行为改动必须有一个改动前失败、改动后通过的测试；纯文档或格式改动不需要新增测试。
- 单文件：`node --test --test-isolation=none test/<name>.test.js`。沙箱的 `spawn EPERM` 变体见 `docs/development.md` 的 DSH 沙箱一节。
- `test/architecture.test.js` 会扫描 `lib/` 和 `scripts/` 中的付费 API 标记（`api.deepseek.com`、`/v1/tools/search`、`/v1/tools/fetch`、`x-dsh-auth-token`），只有 `scripts/public-benchmark.mjs` 例外。不要绕过或削弱该测试，也不要把基准脚本里的对比调用复制进运行时。
- **测试存在性问句**：每个用例答得出「哪个未来 diff 会把它变红」，只改测试自身就能过的用例删除。一个强用例胜过多个弱用例，同输入同断言的重复行合并，删用例前说出它会放走的回归。
- 测公共契约不测内部表示：断言输入到输出与可观察状态，不快照缓存键布局、辅助元组等内部结构；保持调用方可见行为的重构不应破坏测试。

## 6. 完成标准

提交前逐条自检：

- `pnpm check` 退出码为 0。DSH 沙箱按 `docs/development.md` 的单进程命令验证，并在汇报中注明沙箱限制。
- 证据贴原始输出：行为改动附实际命令与输出摘录；界面或交互改动附截图。
- 声称已推送、已合并或已发布前，与远端核对（`git fetch` 后 `rev-parse`，或 `gh` 查询）；以远端返回为准，不以本地退出码为准。
- 测试满足 §5；纯文档或格式改动确认无需新增测试。
- 涉及后端协议、凭据解析、路由顺序或 DSH 注册的改动：有凭据时跑 `pnpm benchmark`，或安装并重启 DSH 后用 `web_search`（中英文各一次）和 `web_fetch` 各验证一次；纯逻辑改动以单测为准。
- 新配置字段满足 §4。新 Provider 同时完成：provider 文件、`lib/catalog.js` 条目与 `lib/index.js` factory（注册顺序由 catalog 派生）、配置与默认值、`docs/configuration.md` 配置表、`docs/architecture.md` 的 Provider 矩阵、映射测试、路由顺序与回退测试。
- 默认值或配额变化时，更新 `docs/configuration.md` 的配置表和免费额度说明（ADR-0003 要求）；随包默认行为变化时同步 `cordis.patch.yml`。

## 7. 文档

文档层级、事实归属、写作规则、篇幅预算和机械检查见 `docs/AGENTS.md`。中文文风按 `zh-tech-writing`，术语按 `GLOSSARY.md`。两份 README 保持同步；契约变化先写 ADR，不静默推翻 `docs/adr/` 已接受决策，有冲突先说明再写新 ADR。`pnpm docs:check` 单独验证文档，`pnpm check` 已包含它。

## 8. 协作与提交

- 默认分支是 `main`，从 `origin/main` 切工作分支，PR 对 `main`。
- 分支名用 2 到 3 个短词、连字符分隔，如 `fix-router-fallback`，不要 `feat/` 之类前缀。
- 提交信息和 PR 标题用 `type(scope): summary`；`type` 取 `feat`、`fix`、`docs`、`chore`、`refactor`、`test`，`scope` 可选。
- **验证戳**：每笔提交正文末尾带一行 `Verified-by: <方式>`，如 `Verified-by: pnpm-check`、`Verified-by: node --test test/errors.test.js`、`Verified-by: docs-only`；未验证的诚实写 `Verified-by: none <一句原因>`。戳用于审计可查（`git log --grep 'Verified-by: none'` 列出未验证提交），PR 里最后一笔全量验证过的提交应带 `Verified-by: pnpm-check`。

## 9. Review 门禁

按 artifact 展开的细则见 `docs/defensive-patterns.md`，本节只写每类改动的失败形态，不列检查项清单。拿「坏掉是什么样」对照：见到即记，未见即过，命中即阻塞合并。

1. **契约**：provider 少实现一个方法、`web_search` / `web_fetch` 的入参或结果形状变了、设置页绕过 `Config` 自造字段——调用方静默报错就是它坏了。见到即记，未见即过。
2. **回退语义**：该停的没停（取消、非法 URL 也回退，直连 404 被当失败），或熔断把不可恢复失败算进阈值——回退走错就是它坏了。见到即记，未见即过。
3. **配额与延迟**：每次查询多打一个外部调用、quality 正常路径超过 4+1+1+1+5 上限、新设置没进缓存 key、循环没上界——数字悄悄超了就是它坏了。见到即记，未见即过。
4. **输入健壮性**：入口没做一次校验、归一化，放过坏类型、超大响应或错误类型，或内部层重复判型，或一条坏数据丢掉整批——脏输入没挡住就是它坏了。见到即记，未见即过。
5. **配置**：新字段没进 `resolveSettings` 校验或缺默认值，或代码里藏开关常量——设置读出两套行为，它误路由就是它坏了。见到即记，未见即过。
6. **测试与文档**：新行为的映射层、路由层没覆盖，把实现抄进测试（去掉实现照样过），两份 README 与配置表、默认值、配额对不上，契约变了没 ADR——它说谎就是它坏了。见到即记，未见即过。
7. **边界与依赖**：引入未说明的新依赖、`lib/` 调付费 API 或加 MCP 依赖、共用模块反向 import、依赖方向被反转——偷越界就是它坏了。见到即记，未见即过。
8. **实现克制**：一次性逻辑被抽成函数、`try/catch` 铺到非错误边界、为没确认的边界塞推测性代码——为不存在的问题多加一层就是它坏了。见到即记，未见即过。
9. **门禁文档同步**：改了 check 链或 git hook 行为却没同步 `README.md`、`README.en.md`、`docs/development.md`、`docs/AGENTS.md`，或「依次」列举的顺序和实际链序错位——文档和真命令对不上就是它坏了。见到即记，未见即过。
10. **产物数字声明**：PR 正文或 issue 评论的计数、余量、尺寸、行数没和当前产物核对，基线变过还抄旧数——写着自己没量过的数就是它坏了。见到即记，未见即过。

### 不用逐行看的路径

自动生成或机械同步的路径不用逐行审，只核生成源与结果一致：

- 生成表 `docs/subsystems/providers.md`：由 `pnpm docs:gen` 从 `lib/catalog.js` 生成，只核源改对、结果与源同步。
- 锁文件 `pnpm-lock.yaml`：只看依赖增删对不对得上 `package.json`，不抠版本解析。
- 历史与镜像：`CHANGELOG.md` 已发版节、既有 ADR 正文、基准报告按「历史不改写」处理；`README.en.md` 镜像与 `*.zh.md` 法律文件只核语言配对与事实同步。
- 二进制与资源：图片、字体只看该不该进、体积合理。

### 每轮小问题上限

每轴每轮最多报 5 条 P3 建议级小问题，超出的记评审产物「未下场清单」，不铺进评论。上限对 agent 作者尤其重要：人会挥手放过，agent 会全部真修，凭空多一轮。复审只验上一轮 findings 的修复点与新引入的阻塞问题，不新开 P2/P3 线；同一 PR 最多 3 轮，第 3 轮仍 fail 即停、重看方案。
