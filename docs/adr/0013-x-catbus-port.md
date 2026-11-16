# ADR-0013: X 只读搜索工具——catbus X 模块移植，cookie 认证

Status: Accepted. 决策于 2026-11-16 确定，先于实现；排期与验收见 #41。

## 背景

- X 实时内容（推文、讨论、用户）无法经通用 web 搜索稳定取得；站内搜索需要登录态。
- X API 付费路线排除（维护者决定，2026-11-16）；采用 cookie 认证的 web 端接口。
- catbus（MIT，624★，TypeScript，高频更新）的 X 模块是成熟实现；其注册表明示「上游账密登录依赖 Castle token，不移植：只支持从浏览器导入 cookie」。模块真正上游是 cv-cat/XApis（Python，无许可证）；catbus 在 UPSTREAM 文件锁定其 commit。
- 2026-11-16 移植试验（证据在 #41 评论）：静态 import 闭包 29 个文件约 226KB（X 模块 9 个 + core 20 个）；外部依赖仅 zod、wreq-js、qrcode；独立脚本以本机真实 cookie 调 `itemSearch` 成功返回 20 条统一 JSON。

## 决策

- 形态：`lib/tools/` 例外区的独立只读工具（首版仅推文搜索），不注册 ctx.web provider、不进 web_search 路由矩阵——X 结果是平台结构化数据，不是 web sources。
- 实现方式为源码移植，不是 spawn 外部 CLI：只移植 catbus 的 MIT TypeScript 实现，不复制 cv-cat/XApis 的任何 Python 源码（无许可证）。
- 只读白名单：首版 `item search`；二期候选 `item get`、`comment list`、`user get`。写操作（publish/like/follow/msg）与 article（发文章）不移植。
- 凭据：cookie 由用户从浏览器导入（首版无登录 UI）；插件不实现登录流程，不存储登录态之外的账号数据。
- 默认关闭：设置项默认 off；README 与 SAFETY 增补 X 服务条款灰区与账号风控自负的声明。
- 溯源：移植文件头注明 `Ported from catbus src/platforms/x@<commit> (MIT)`；THIRD_PARTY_NOTICES 登记 catbus（MIT），并记录 XApis 溯源（仅记录来源，不复制其代码）。
- 移植改造点：`core/paths.ts` 的包根解析（按 package.json name 查找）改为插件包根；`static/x/transaction_l1.json`（XCTID 签名素材）随插件分发；`commands.ts` 顶层写路径 import 拆除。
- 失效语义：X 端点变更时显式报「上游已变，等待移植更新」，不静默失败。
- TypeScript 源码转译为 JavaScript 入库：本仓库 `lib/` 全为 JavaScript，无构建步骤，发布白名单只含 `.js`。

### 放弃的替代方案

- spawn catbus CLI 包装：引入外部二进制依赖，用户需自行安装并登录 CLI；维护者选择源码移植，自担维护。
- 直接移植 XApis（Python）：无许可证，法律不可行。
- X API v2 Bearer token：搜索读取为付费档，与 free-tier-first 相悖（ADR-0003），已排除。

## 后果

- X 端点与风控变更由本仓库自行跟进；catbus 从运行时依赖降级为上游参照，需定期对照 diff。
- 插件新增约 230KB 源码与 zod、wreq-js 两个运行时依赖（qrcode 仅登录路径，只读首版可裁）。
- 合规面：X 服务条款灰区；以默认关闭、只读白名单与文档声明控制，风险由用户自担。
- 测试用 fixture 回放，不依赖真实 cookie 与真实请求。
- 本文只记录决策；移植清单与行为细节以 #41 与实现 PR 为准。
