# 新增 Provider

本指南把一个搜索或抓取后端接入插件。开始前读 [架构地图](../architecture.md) 和 [Provider 契约](../../CODING_STANDARDS.md#3-provider-契约代码风格与实现模式)。

## 1. 确定能力与 id

- 搜索、抓取还是两者都支持。
- 选一个唯一的 provider id；标准集合是 `anysearch`、`tavily`、`firecrawl`、`zhihu`、`zhihu-site`、`aihot`、`http`、`auto`。
- 新 id 或新能力缝先写 ADR，放在 `docs/adr/`。

## 2. 建立 provider 文件

在 `lib/providers/` 新增 `<name>.js`，保持现有三段式：

- 导出 `XXX_PROVIDER_ID` 常量。
- 导出 `mapXxxSearch()` 纯映射；只做数据转换和 envelope 校验，坏条目丢弃。
- 导出 `XxxProvider` 类；构造函数接收 `{ settings, resolveKey }`（不需要凭据的只收 `{ settings }`）。
- 实现 `id`、`title`、`description`（`{ en, zh }`）、`available()`、`ready()`，按能力实现 `search()` 或 `fetch()`。
- Provider 边界用 `toWebError()` / `webError()` 转换成 `WEB_*` 错误；不要在 provider 里直接读 `process.env` 或 `ctx.config`。

## 3. 注册与配置

- 在 `lib/catalog.js` 增加条目的 `id`、`capabilities` 和 `settingsKey`；注册循环会按能力自动注册。
- 在 `lib/index.js` 的 `providers` 映射里创建实例。
- 在 `lib/settings.js` 的 `SETTINGS_SPEC` 增加 `xxxEnabled`、`xxxApiKeyEnv`、`xxxBaseURL` 等字段；默认值放入 `DEFAULT_SETTINGS`。
- `*ApiKeyEnv` 字段在 spec 里写 `role: 'credential-ref'`。
- 如果 provider 有别名，在 catalog 条目里复用同一个 `settingsKey`。

## 4. 文档与默认值

- 在 `README.md` 和 `README.zh.md` 的 Providers 表、配置表、默认顺序中同步新增内容。
- 在 `docs/architecture.md` 的模块地图和扩展点中补充新文件。
- 默认值或配额变化时同步 `cordis.patch.yml`。

## 5. 测试

- 在 `test/mapping.test.js` 或新测试文件覆盖 mapper 的正常输入、空响应、错误 envelope 和无效 URL。
- 在 `test/router.test.js` 覆盖搜索/抓取顺序、回退和缓存行为。
- 运行 `pnpm docs:check` 和 `pnpm check`。

## 6. 验收清单

- [ ] provider id 唯一，未占用标准 id。
- [ ] `lib/catalog.js` 的能力与 `settingsKey` 正确，`lib/index.js` 实例已创建。
- [ ] `SETTINGS_SPEC` 与 `DEFAULT_SETTINGS` 同步，`*ApiKeyEnv` 标了 `credential-ref`。
- [ ] 两份 README 的 Provider 与配置表同步。
- [ ] mapper 与路由器测试通过。
- [ ] `pnpm docs:check` 和 `pnpm check` 通过。
- [ ] 有凭据时完成一次 `pnpm benchmark` 或 DSH 内真实冒烟。
