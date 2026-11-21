# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver. Releases before 0.8.0 have no tags — see git history.

条目一律中文，按 zh-tech-writing 规范撰写；发版说明由发布流程自动取自对应版本节。

更早版本见 [docs/changelog-archive.md](docs/changelog-archive.md)

## 未发布

### 新增

- 新增可选只读工具 `x_search`：从 catbus（MIT）移植 X 网页端推文搜索，cookie 从浏览器导入、默认关闭、不进 `web_search` 路由（#41，ADR-0013）。

## 0.15.0 — 2026-11-21

### 新增

- fast 模式搜索或抓取拿到空结果时判为弱结果，按原顺序再试一家免费后端；弱结果不写缓存、不计熔断，用户不再拿到空答案（#212，修复 #35）。

### 修复

- fast 回退只用调用方信号，内部 deadline 不再把已中止的请求交给 Bing 地板；慢 provider 耗尽预算后仍能落到 Bing 取结果（#206，修复 #195）。
- quality 搜索的 debug trail 里 `tried` 只记真正发起调用的后端，被跳过的引擎不再算作已尝试（#210，修复 #208）。

### 变更

- 成功调用在 debug 级播报一行 provider trail，列出尝试过的后端与最终应答方；默认日志级别无输出，返回结构与缓存不变（#205，修复 #38）。
- `CODING_STANDARDS.md` 第 9 节门禁改写为失败定义式，另补 skip 清单与每轮小问题上限（#204，修复 #198）。
- 新增任务卡四维质量检查脚本；`verify-docs` 的锚点算法升级，重名标题与手写锚点不再误报（#211，修复 #200）。
- SECURITY、CODE_OF_CONDUCT、SAFETY 三组双语文件的主文件切中文为主，英文镜像移到 `.zh.md`，文件名不变（#209，docs）。
- 仓库 `CODEOWNERS` 默认 owner 改为评审账号，评审通知直达评审人（#207，chore）。
- README 中英双语修四处措辞与链接，并给「各后端免费额度」表补「官网/注册」列（#214，修复 #213）。

## 0.14.0 — 2026-11-21

### 变更

- Bing SERP 解析改结构化，markup 微变不再整批归零（#192，fix）。
- resolve.all 恢复「a gap stops the list」断链契约，quality fan-out 遇内部 deadline 降级、不整条取消（#193，fix）。
- 直连 HTTP 默认拦截私网地址并在错误路径取消响应体，堵住 SSRF；SAFETY 中英双语与 ADR-0014 同步（#194，fix，安全行为变更）。
- 内部文档退出公开仓库改本地维护，BENCHMARK 归位 docs（#196，chore）。
- 补 client.js `handleSaveKey` 工厂闭包组件级红测（#197，test）。
- 新增 postmortem 目录、providers 生成式表格与文档新鲜度门禁（#199，docs）。

## 0.13.15 — 2026-11-21

### 变更

- `client.js` 的 `handleSaveKey` 抽到模块级并补状态流转测试，覆盖 busy 升降、拒绝和失败回调（#189，修复 #174）。
- `lib/health.js` 的 Tavily、知乎、Firecrawl 三段额度解析抽成纯函数并补三态测试；`docs/dsh-host-contract.md` 补「凭据解析」契约一节（#189，修复 #174）。
