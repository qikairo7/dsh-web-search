---
name: verify
description: 在 dsh-web-search 里提交/交付前做端到端冒烟时使用：装包后的真实 web_search 验证规程（keyless 路径可全自动）。机器审查 Evidence 里标 not-run 的装包冒烟，由本 skill 收口。
---

# 端到端验证（verify）

"难以欺骗的测试——整个功能要么行要么不行"（Claude Code 验证方法论）。本仓库的 E2E = 装包后真实 `web_search` 走一遍，而不是只有单测绿。

## 何时跑

- provider 或路由改动合并前后（对应 PR Evidence 的 not-run 项）
- 版本发布前（tag 前）
- 大重构后（quality 管线、router、errors）

## 规程（keyless 全自动，无需凭据）

冒烟范围（设置页、`web_search` 中英文、`web_fetch`）以 [docs/testing.md](../../../docs/testing.md) 的「手动冒烟」行为准；本节只补增量：

1. 仓库根 `pnpm pack` 产出 tgz，装载后重启 DSH（或新 profile）。
2. 依次验证并记录**原始输出摘录**：`web_search` 中文查询（如「Node.js 文件读取」）——期望多来源结果，含中文信源；英文技术查询（如 `site:nodejs.org fs.readFile`）——期望官方文档靠前。

## 管理路由真机验证（web + ego）

冒烟范围与期望反馈以 [docs/feature-map.md](../../../docs/feature-map.md) 为准，本节只补增量。

设置页的「验证」「拉取模型」「刷新额度」调 `/dsh-web-search/{health,models,quotas}`。桌面版页面跑在 `dsh-app://`，无法自动化；改用独立 Web 实例 + ego 浏览器带已登录会话点击，覆盖 DSH Web 的「同源 + 真实认证 cookie」通道。桌面转发形态（无 Origin、带 Host cookie）用下面的 curl 对照模拟。

### 1. 起独立 Web 实例（独立端口 + 独立 profile）

绝不复用或重启正在运行的实例（例如 4670）。

```sh
# 从 web 模板脚手架一个测试 profile；--dump-config 只打印配置后退出，不启动
dsh <test-profile> --from-default-profile web --dump-config
# 仓库根打包，装进测试 profile（dsh plugin add 会把它回写进 dsh.profile.bundles）
pnpm pack --pack-destination <tmp-dir>
dsh plugin --profile <test-profile> add <tmp-dir>/qikairo7-dsh-web-search-<version>.tgz
# 独立端口启动；首行日志给出带 token 的 URL
dsh <test-profile> --port 4690 --no-open
```

启动日志首行形如 `dsh web: http://127.0.0.1:4690/?token=<launchToken>`。

### 2. 浏览器鉴权（先实测再操作）

无 cookie 直接访问 `http://127.0.0.1:4690/` 返回 401。先访问带 `?token=` 的 URL：服务端种一枚签名 cookie（HttpOnly、SameSite=Strict）并 303 跳到 `./`，此后 `/api` 与插件路由靠这枚 cookie 放行。ego 里就是先 `page.goto("<带 token 的 URL>")`。

### 3. ego 操作序列

1. 打开带 token 的 URL，等首页标题「DeepSeek Harness」。
2. 关「预览版说明」弹窗（「继续」）→「账号菜单」→「设置」→「搜索与抓取设置」。
3. Keenable 卡片点「验证」，期望「Keenable 在 N ms 内返回 M 条结果。」。
4. 「重排与嵌入模型」区点「拉取模型」，期望「已加载 N 个模型。」。
5. 「剩余额度」区点「刷新额度」，期望 Keenable 等显示「剩余 <n>」。

按钮可能在视口外，原生点击报 `element is not visible`；先页面内 `scrollIntoView({ block: 'center' })` 再点，或 `page.evaluate` 找到按钮调 `click()`。

### 4. curl 形态对照（bash / MSYS 下运行）

先换 cookie，再用同一份 cookie 打对照，覆盖同源、桌面转发、跨源、无凭据四种形态（以下命令在 bash / MSYS 即 Git Bash 下运行）：

```sh
BASE=http://127.0.0.1:4690; JAR=/tmp/dsh-verify-jar.txt
curl -sS -c "$JAR" "$BASE/?token=<launchToken>"   # 换 cookie，期望 303

# 同源：Origin = Host，带 cookie
curl -sS -b "$JAR" -X POST -H 'Content-Type: application/json' -H "Origin: $BASE" -d '{"providerId":"keenable","capability":"search"}' -w '%{http_code}' "$BASE/dsh-web-search/health"; echo
# 桌面转发形态：无 Origin，只带 cookie
curl -sS -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"providerId":"keenable","capability":"search"}' -w '%{http_code}' "$BASE/dsh-web-search/health"; echo
# 跨源：Origin 不是本服务，带 cookie -> 403
curl -sS -b "$JAR" -X POST -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:9999" -d '{"providerId":"keenable","capability":"search"}' -w '%{http_code}' "$BASE/dsh-web-search/health"; echo
# 无凭据：不带 -b（不发 cookie）-> 403
curl -sS -X POST -H 'Content-Type: application/json' -d '{"providerId":"keenable","capability":"search"}' -w '%{http_code}' "$BASE/dsh-web-search/health"; echo

# 其余路由同样可换路径，例如 /models（kind=rerank）与 /quotas
curl -sS -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"kind":"rerank"}' -w '%{http_code}' "$BASE/dsh-web-search/models"; echo
curl -sS -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{}' -w '%{http_code}' "$BASE/dsh-web-search/quotas"; echo
```

对照（信任判定走 Host Connection 的 `requestRejection`）：

| 形态 | Origin | 有效 cookie | 结果 |
|---|---|---|---|
| 同源浏览器 | 有（= Host） | 有 | 200 `ok:true` |
| 桌面转发形态 | 无 | 有 | 200 `ok:true` |
| 无凭据 | 无 | 无 | 403 `same-origin request required` |
| 跨源 | 有（≠ Host） | 有 | 403 |

桌面转发形态（无 Origin、带 Host cookie）应 200；无凭据与跨源 403。

### 5. 覆盖边界与清理

- Web 端覆盖带 Origin 的同源 + 真实认证 cookie 通道；桌面 `dsh-app://` 无 Origin、带 Host cookie 的转发形态用上面 curl 模拟，不依赖桌面打包。
- 测试实例用完即关，清掉临时 profile 与 tgz，不动正在运行的实例和主检出。

## 判定与记录

- 每步贴原始输出进 Evidence（不是"通过"两个字）。
- keyless 冒烟失败 = 阻塞（P1）；带 key provider 的失败 = P2 记录并转 followup。
- 结果追加进 PR Evidence。

## 边界

- 不在 CI 跑（外部 API 抖动会教坏 agent"重跑代替修复"——flaky 纪律）；pre-push 手动跑。
- 差分场景（重构前后对比）用 `pnpm benchmark` 的对照表——它就是差分测试的现成形态（固定题集 FRAMES/WebWalkerQA 当 oracle，新旧版本同题对比），不需要另建框架。