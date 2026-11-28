# 决策记录

一页以内。每条写决定、放弃的方案和执行它的测试位置。改行为前先读；决定变了改这一条，不另开档案。

## 只实现 `ctx.web` provider

- 决定：`web_search` / `web_fetch` 归 `dsh-tool-web`，本插件只注册 provider；`lib/tools/` 下的 AnySearch、Tavily、AIHOT、X 工具是唯一例外，不加第二个 provider seam，不加 MCP server。
- 放弃：自建工具层；为高级参数另开一条 seam。
- 执行：`test/plugin-apply.test.js` 的注册清单，`test/repo-boundary.test.js` 的发布内容。

## 免费额度优先，付费后端只做回退尾

- 决定：quality 只在免费家之间展开；`tavily`、`firecrawl` 只在免费栈以错误收场时兜底；`bing` 是免 Key 地板，排在免费栈之后、付费尾之前，不进 quality 扇出。
- 放弃：把付费后端放进 quality 并列取源。
- 执行：`test/catalog.test.js`、`test/roles.test.js`。

## `lib/roles.js` 是路由角色的唯一真源

- 决定：语言 × 意图的 quality 集、fast 免费前缀与 `DEFAULT_SEARCH_ORDERS` 都由 `lib/roles.js` 派生，settings 默认值和 `cordis.patch.yml` 的打包值跟它一致。
- 放弃：在 settings、intent、bundle patch 里各写一份顺序。
- 执行：`test/roles.test.js`。

## 直连抓取默认拦截私网地址

- 决定：回环、私有段、链路本地、云元数据与 IPv4 映射地址默认拒绝；首次请求和每次重定向都校验，解析失败也拒绝；唯一逃生门是 `DSH_WEB_HTTP_ALLOW_PRIVATE=1`，只在 `lib/host.js` 读。
- 放弃：只按域名判断；把代理的 fake-ip 网段当放行依据，会误杀正常公网抓取。
- 执行：`test/host.test.js`、`test/http.test.js`。

## 弱结果沿免费栈再试一家

- 决定：搜索空结果、抓取空正文算弱结果，不结束链，沿 fast 序再试 1 家免费后端；付费尾不参与；弱结果不计熔断、不写缓存。
- 放弃：把空结果当成功，链停在第一个空返回。
- 执行：`test/router.test.js` 的弱回退用例组。

## 设置页视觉走 `--dsw2-*` token 与内嵌字体

- 决定：设置页样式定义 `--dsw2-*`，八个 `--dsw-alias-*` 重定向到 dsw2 值；Inter 与 Geist Mono 的 latin 子集 woff2 内嵌，经 `lib/fonts-routes.js` 同源供文件；深色跟随宿主 `body[data-ds-dark-theme]`。
- 放弃：把宿主 alias 的值当设计真源（值不在本仓）；内联 base64 字体。
- 执行：`test/design-tokens.test.js`、`test/client-bundle.test.js`。