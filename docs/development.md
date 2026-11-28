# 开发指南

面向贡献者的安装、日常命令、CI 和排错。实现规则见 [CODING_STANDARDS](../CODING_STANDARDS.md)。

## 查证顺序

回答「X 是怎么工作的」：**先看运行时实际行为**（跑命令、读代码），**再看本文档**；文档可能落后，以代码为准。仍不足时写明「未验证」，不把推测当事实。

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
pnpm check
```

`pnpm check` 依次运行全部四段门禁（见下表）；全量门禁由 CI 在推送后执行。

## 日常命令

| 命令 | 用途 |
|---|---|
| `pnpm test` | 只跑 `node --test` |
| `pnpm check` | 语法检查 + 架构检查 + order-doc 同步 + 单测，提交前门禁 |
| `node --test --test-isolation=none test/<name>.test.js` | 跑单个测试文件 |
| `dsh plugin --profile desktop add "<仓库路径>"` | 安装到本机 DSH，安装后重启 DSH |

## DSH 沙箱

DSH 沙箱会拦截 Node 测试运行器的子进程，`node --test` 可能报 `spawn EPERM`。这时改用：

```sh
node scripts/check-syntax.mjs && node scripts/check-architecture.mjs && node scripts/check-order-sync.mjs && node --test --test-isolation=none
```

单文件同理：`node --test --test-isolation=none test/<name>.test.js`。

## CI

- `.github/workflows/check.yml` 在 Node 22/24 上跑 `pnpm install --frozen-lockfile` 和 `pnpm check`；main 的 check 不被新推送取消，release 等绿跑。
- `.github/workflows/release.yml` 等被发布 commit 的 check 全绿后发布；等待≤30 分钟，job 预算 45 分钟。
- 仓库没有 `dev` / `build` / `typecheck` 脚本；不要运行不存在的命令。

## 环境变量

插件通过 DSH 凭据服务读取 API Key，凭据放在 `~/.dsh/.credentials.yaml` 或启动环境变量。不要写进 shell 命令。不要提交真实密钥或 `.credentials.yaml`。

## 常见问题

- **测试报 `spawn EPERM`**：这是 DSH 沙箱限制，不是测试失败；按上面的单进程命令重跑。
- **Provider 未就绪**：Tavily、Firecrawl 或知乎缺少对应 Key 时会被路由器跳过；这不是代码错误。

## 相关文档

- [项目约定](../AGENTS.md)
- [测试策略](testing.md)
- [实现标准](../CODING_STANDARDS.md)
