---
name: verify
description: 在 dsh-web-search 仓库做交付前端到端验收时使用：起隔离 dsh web 实例，用 ego 浏览器驱动设置页与搜索抓取，留下截图和日志证据，再收尾实例与临时目录。三条驱动方式——keyless 免凭据、keyed 带真实 provider key、dogfooding 全流日常——按本次要验的范围选一条。
---

# dsh-web-search 端到端验证

本仓库的 E2E = 装包后在真机上跑一遍用户路径，不是只有单测绿。本技能是本仓库验收流程的事实源：怎么起实例、怎么判断实例值不值得驱动、怎么用 ego 驱动、证据放哪、怎么收尾。

功能地图在 [`features/`](./features/README.md)，按用户视角写，每个功能一份文件。本技能讲怎么跑，地图讲跑什么。

## 何时用

- 改了 `lib/` 下的 provider、路由、设置、质量逻辑之后，合并前。
- 改了 `client.js` 的设置页之后，合并前。
- 版本发布（tag）前。
- PR 的 Evidence 里标了 not-run 的装包冒烟，由本技能收口。

纯文档、纯测试文件的改动不跑。跑一次要起实例、发真实网络请求、占一条后端配额，先掂量值不值。

## 前提

- Node.js `22.19+` 或 `24+`，pnpm，仓库根已 `pnpm install`。
- PATH 上有 npm 装的 `@deepseek-ai/dsh` 命令（`dsh --version` 回 `0.2.2-rc.5`）。仓库内置的 Electron CLI 是备选，不是首选。
- PATH 上有 `ego-browser`（`ego-browser skill` 能打出用法指南）。
- 桌面端的 DSH 实例不动。它带 token 鉴权，ego 拿不到那个 cookie，桌面端也不在验收范围里。

## Launch

从空的数据目录起到能用为止。全程用一次性 DSH_HOME 和一次性 profile，绝不复用也不重启本机正在跑的实例。

```sh
# 1. 选一个空闲端口，记下它，后面所有命令都用它
PORT=<空闲端口>
PROFILE=verify-<随机后缀>
HOME=<临时目录>/home

# 2. 打包本仓库，tgz 落到临时目录，不落仓库根
pnpm pack --pack-destination <临时目录>/pack

# 3. 从 web 模板脚手架一个一次性 profile（--dump-config 只打印配置后退出，不启动）
DSH_HOME='<HOME 绝对路径>' dsh <PROFILE> --from-default-profile web --dump-config

# 4. 把 tgz 装进这个 profile
DSH_HOME='<HOME 绝对路径>' dsh plugin --profile <PROFILE> add <临时目录>/pack/qikairo7-dsh-web-search-<版本>.tgz

# 5. 起实例。--no-open 必带，否则弹浏览器
DSH_HOME='<HOME 绝对路径>' dsh <PROFILE> --port $PORT --no-open
```

第 5 步是长驻进程，只能用后台任务起。起了以后不要停回合——后台任务跟着回合走，实例会变成没人管的孤儿，同一回合里把驱动和收尾做完。

启动到监听要等。实测两次：一次 90 秒，一次 60 秒内起。实例起来之前日志是空的，这是正常的，别当成失败——等监听或者等日志出现带 token 的那一行。实例日志首行是带 token 的启动 URL：

```
dsh web: http://127.0.0.1:<PORT>/?token=<launchToken>
```

这个 URL 就是 ego 要打开的地址，也是换 cookie 的凭据。把它抄下来，别丢。

`--from-default-profile web` 会覆盖同名 profile，所以 `$PROFILE` 必须唯一。

`DSH_HOME` 这类环境变量在 MSYS/Git Bash 下不吃路径转换，传 Windows 形式的绝对路径（盘符加反斜杠或正斜杠都行），不传 POSIX 形式。

## Doctor

一条只读的检查，回答「这个实例值不值得驱动」。跑它只需要一个 `curl` 加一次 cookie 交换，不写任何状态。

```sh
BASE=http://127.0.0.1:$PORT
JAR=<临时目录>/jar.txt

# 换 cookie：带 token 的 URL 应当 303，并种一枚签名 cookie
curl -sS -c "$JAR" -o /dev/null -w '%{http_code}\n' "$BASE/?token=<launchToken>"

# 进程在不在、端口是不是我们占的
netstat -ano -p tcp | grep ":$PORT"
```

拿到 cookie 以后打三个管理路由。它们是设置页的后端，同源加凭据才放行：

```sh
# 健康检查：应当 200 且 ok:true
curl -sS -b "$JAR" -X POST -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d '{"providerId":"keenable","capability":"search"}' -w '\nHTTP %{http_code}\n' \
  "$BASE/dsh-web-search/health"

# 额度：keyless 下应当 200，providers 为空对象
curl -sS -b "$JAR" -X POST -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d '{}' -w '\nHTTP %{http_code}\n' "$BASE/dsh-web-search/quotas"

# 模型列表：keyless 下没有 SiliconFlow key，应当 200 且 ok:false、code 为 WEB_PROVIDER_UNAVAILABLE
curl -sS -b "$JAR" -X POST -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d '{"kind":"rerank"}' -w '\nHTTP %{http_code}\n' "$BASE/dsh-web-search/models"

# 反向对照：不带 cookie 应当 403
curl -sS -X POST -H 'Content-Type: application/json' -d '{}' -w '\nHTTP %{http_code}\n' \
  "$BASE/dsh-web-search/health"
```

判读：

| 现象 | 结论 |
|---|---|
| 换 cookie 303，health 200 且 `ok:true` | 实例可用，值得驱动 |
| health 200 但 `ok:false` | 后端不可用或 Key 有问题，先看 `message`，不算实例坏 |
| models 200 且 `ok:false`、code `WEB_PROVIDER_UNAVAILABLE` | keyless 下的正常结果，不算故障 |
| 不带 cookie 403 `same-origin request required` | 信任栅栏正常 |
| 端口没监听，实例日志为空或极短 | 实例没起来，看日志，不要继续驱动 |

托管域名的信任判定走宿主 Connection 服务的 `requestRejection`，同源带凭据放行、无凭据和跨源 403 是预期。

## Drive

ego 驱动设置页。入口路径有坑，照这个顺序走。

1. 打开带 token 的 URL，等标题变成 `DeepSeek Harness`。
2. 首页可能盖两个弹窗：先点「继续」关掉「预览版说明」，再点「关闭」关掉「开始使用」。第二个弹窗会挡住账号菜单，不关它后面一步点不动。
3. 点右上角「账号菜单」按钮。这个按钮上面盖着一层 div，ego 的原生点击会报 `<div> intercepts pointer events`，改用页内点击：

   ```js
   await page.evaluate(() => {
     document.querySelector("button[aria-label='账号菜单']").click();
   });
   ```

4. 菜单里选「设置」，弹出「设置」对话框。对话框的关闭按钮是文本「关闭」，不是 `aria-label`，匹配要按按钮文本找。
5. 对话框左侧选「内置插件」。等状态从「正在读取插件…」变成插件列表，这一步要等几秒。
6. 列表里往下滚到「全局插件」区，找按钮「网页搜索路由器」，点它。**设置页入口不在「内置插件」列表里**，「内置插件」只列内置工具包；本插件的设置页挂在 bundle 配置槽位上，入口是插件详情里的这个按钮。这个按钮的 `aria-label` 是「查看 网页搜索路由器」，按文本匹配有时对不上，按 aria-label 找更稳。
7. 点开的就是插件的设置页，标题「搜索与抓取设置」。页面要再等几秒才加载完——刚点开时只有标题，页签和内容还没渲染。页面有四个页签：「总览」「引擎」「模式与模型」「高级」。

注意：「设置」对话框开着的时候，插件面板在它底下，点不到。要先关掉对话框再开插件面板，或者干脆不从对话框进去，直接点左下侧栏的「插件」按钮开插件面板。

在设置页里可驱动的用户动作：

| 动作 | 位置 | 可观察终态 |
|---|---|---|
| 切搜索模式 | 「模式与模型」页签，搜索模式下的模式卡 | 选中卡片高亮，「快速参数」区出现（质量模式时是「质量参数」）；页首「就绪状态」文案跟着变 |
| 切抓取模式 | 「模式与模型」页签，抓取模式下的模式卡 | 选中卡片高亮，「干净」时多出正文抽取引擎列表 |
| 保存 | 页面顶部的「保存」按钮 | 状态栏出现「设置已保存。」；未保存横幅「有未保存的改动」消失 |
| 刷新额度 | 「引擎」页签，引擎列表标题右侧的「刷新额度」 | 各引擎卡片的用量行更新成「剩余 <n>」或「不支持」或「刷新失败」 |
| 验证单个引擎 | 「引擎」页签，选中引擎后的卡片里的「验证」按钮 | 状态栏出现「<引擎名> 在 <n> ms 内返回 <n> 条结果。」 |

模式卡是 `<button>` 里套两个 `<span>`（标题和说明），文本匹配要落在 span 上，不是 button 上。按钮文本「快速」有两个（搜索模式一个、抓取模式一个），靠说明文字区分：搜索模式的快速卡说明是「自动选择第一个引擎；失败时最多再试 N 家。」，抓取模式的快速卡说明是「快速：直接抓整页，速度优先。」

「验证」按钮在没配 Key 时是 disabled 的（`client.js` 里 `disabled: busy || !writable || !configured`）。keyless 下 Keenable、AnySearch、GitHub 三个引擎标「未配置」，验证按钮点不动，别把它当成故障。要验健康检查，走 Doctor 里的 `/dsh-web-search/health`。

保存是写操作，会改 profile 配置。验收用的 profile 是一次性的，存完随实例一起删，不影响本机。

### 搜索和抓取

设置页只验宿主与插件的交互面。`web_search` 和 `web_fetch` 的真实结果形状，要驱动插件的 auto provider 才能看到。

```sh
node .agents/skills/verify/scripts/drive-web.mjs
```

这个脚本从装好的 profile 里导入插件，用一个最小 ctx 桩接住注册，跑中文搜索、英文搜索和一次抓取，退出码 0 表示三层都过了。脚本自己会从仓库 `node_modules` 把 peer 依赖 junction 进一次性 profile——`dsh plugin add` 只装插件本体和 dependencies，peer 依赖由宿主运行时注入，独立导入时缺链。

判据：

- 中文搜索「Node.js 文件读取」：结果非空，前三条有标题、URL、摘要。
- 英文搜索「site:nodejs.org fs.readFile」：结果非空，官方文档信源靠前。
- 抓取 `https://nodejs.org/api/path.html`：HTTP 200，正文非空。
- 应答后端不能只有兜底信源（bing、tavily、firecrawl）。

脚本打印 provider trail，能看出哪几家后端应答了。

### keyed 与 dogfooding

keyless 走完上面这些就够了。要带真实 provider key 跑，走这条路：

1. 验收实例用独立 DSH_HOME，空凭据库起步，绝不共用主凭据库。
2. 从主凭据库（`~/.dsh/.credentials.yaml`）用脚本只提取本次要验的 provider key，经文件中转写入隔离库。key 不进命令行参数、不回显、不写进任何仓库文件、日志或汇报。
3. 注入前后对主凭据库做校验和核对，只读不动它。
4. 验后删除隔离 home。

dogfooding 是以 ego 当真实用户走全流：开新会话问三个真实问题（一个中文常识、一个英文技术、一个要 `site:` 定向），让模型抓一个指定网页并总结，把设置页从头点一遍。每步记操作、观察、耗时、判定，不做「非空即过」的断言。撞见的意外都算 finding，不管是不是本次改动面。

## Evidence

一次证明要留的东西，放在一个时间戳目录里：

```
<证据根>/<时间戳>/
  instance-serve.log       实例启动日志（含带 token 的 URL，token 本身算凭据）
  doctor.txt               Doctor 四条 curl 的原始输出
  <序号>-<步骤>.png        ego 截图，动手前一张、动手后一张
  provider-drive.log       搜索抓取脚本的输出
  cleanup.txt              收尾三样的核对结果
```

放哪儿由调用方定：证据目录在本机之外时要跟仓库分开，别让截图和日志混进 `pnpm pack` 的清单。

证据标准：

- 贴原始输出，不写「通过」两个字。
- 截动作前后两张，不只截终态。改设置这类动作，终态和初始长得一样，只有前后对比能证明动作真的生效了。
- 记下用的功能 ID 和入口路径（哪个功能文件、哪个页签、哪个按钮）。
- 失败现场也要留。脚本失败时先把日志目录拷出来，再清场——上一回冒烟失败时实例日志跟着临时目录一起被删，现场什么都没剩下。
- 证明要跟到用户路径，不靠内部 setter 或者只在测试里存在的端点。

## Cleanup

收尾只收拾自己起的东西。证据留着，实例和临时状态清掉。

三步，顺序不能反：

1. 关 ego 的 task space，Page 全关（`task.finish({ keep: [] })`）。
2. 杀自己起的实例 pid。Windows 上 `taskkill /PID <pid> /T /F`，MSYS 里要用 Windows 侧的 PID（`ps` 里的 WINPID 那列），不是 MSYS 的那列。不扫进程名，宿主 DSH 自己也是 node 进程。
3. 删临时 DSH_HOME 目录。

然后核三样：

```sh
netstat -ano -p tcp | grep ":$PORT" | grep LISTENING   # 应当没有输出
ps -p <msys-pid>                                      # 应当查不到
ls -d <临时目录>                                      # 应当不存在
```

外加一条：`~/.dsh/profiles/` 的目录清单跟起实例前一致，没多出新的 profile。真机 profile 列表里本来就有 `desktop`、`web`、`web-verify` 等，不要去动它们。

## Helpers

本技能带的脚本：

- `.agents/skills/verify/scripts/drive-web.mjs`：从一次性 profile 直驱 auto 的搜索和抓取，验结果形状。跑法 `node .agents/skills/verify/scripts/drive-web.mjs`。它自己找 profile 和 pack 产物里的插件目录，端口和路径不写死。

其余步骤都能用一条 shell 命令做，不写脚本。起实例、换 cookie、Doctor、保存设置、收尾，都是普通命令。

## Gotchas

- 后台任务跟着回合走。起实例用后台任务起以后，不要停回合，同一回合里做完驱动和收尾。
- `dsh --from-default-profile web` 覆盖同名 profile，profile 名必须唯一。
- `DSH_HOME` 在 MSYS 下不吃路径转换，传 Windows 绝对路径。
- 设置页入口在插件面板的「网页搜索路由器」按钮上，不在「内置插件」列表里。这个按钮用 aria-label「查看 网页搜索路由器」定位最稳。
- 首页的「开始使用」弹窗会挡住账号菜单，先关它。
- 「账号菜单」按钮上面盖着 div，用 `page.evaluate` 页内点击。
- 「设置」对话框的关闭按钮是文本「关闭」，没有 aria-label。匹配要按文本找。
- 「设置」对话框开着的时候插件面板在底下，点不到。先关对话框。
- 设置页刚点开时要等几秒才加载完，只看到标题是正常的。
- 模式卡的文本在 span 上，按钮文本「快速」有两个，靠说明文字区分。
- keyless 下「验证」按钮 disabled，「刷新额度」对 Keenable 报「刷新失败」——额度要先跑一次搜索才有缓存。这两条都是预期，不是故障。
- 桌面端有 token 鉴权，ego 拿不到。不验桌面端。
- 差分场景不在本技能范围里。
