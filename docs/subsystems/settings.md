# 配置系统

字段在 `SETTINGS_SPEC` 声明一次：设置页 schema、默认值、解析全部派生；用户可见字段表在 [configuration](../configuration.md)。

## 职责与真源表

| 事实 | 真源 |
|---|---|
| 字段声明 | `SETTINGS_SPEC`（[lib/settings.js](../../lib/settings.js)） |
| 默认值与默认值指针 | `DEFAULT_SETTINGS`、`settingDefault()`（同上） |
| 每操作解析 | `resolveSettings()` / `resolveSetting()` / `assignSetting()`（同上） |
| volatile 解包 | `readConfigValue()`（同上） |
| kind 解析器 | `parseOrder` / `parseEnum` / `parseFailureClasses` 等（同上） |
| 后端段查询 | `providerSettings()`（同上） |
| 失败类集合 | `FAILURE_CLASSES`（[lib/errors.js](../../lib/errors.js)） |
| 设置页 schema | `Config` / `configField()`（[lib/index.js](../../lib/index.js)） |

`key` 是设置页扁平字段名；`path` 既是解析结果的嵌套路径，也指向默认值。`*ApiKeyEnv` 标 `role: 'credential-ref'`：值是凭据引用，不是密钥本体。

### kind 清单

| kind | Config 类型 | 解析 |
|---|---|---|
| `enum` | `union` | 越界回落默认 |
| `boolean` | `boolean` | 缺省回落默认 |
| `order` | `string` | `parseOrder` → 数组 |
| `failure-classes` | `array(union)` | `parseFailureClasses` |
| `string` | `string`（可挂 role） | 缺省回落默认 |
| `number` | `number` | 按 `coerce` 解析 |

### 与相邻页的边界

- 用户可见字段表与默认值：[configuration](../configuration.md)。
- 凭据解析与多 Key 轮换：[providers](providers.md)。
- `Config` 生成与 volatile 在装配中的位置：[dsh-host](dsh-host.md)。

## 运行路径

### 启动

1. 设置页由 `Config` schema 生成，字段顺序即 spec 顺序。
2. `configField()` 按 kind 生成类型并挂 `settingDefault()` 默认值。
3. `maybeVolatile()` 在支持时声明 volatile，DSH 0.2.x 不重挂插件即可更新设置。

### 每次操作

1. `settings()` thunk 每次调 `resolveSettings(config)` 重新解析，返回新嵌套对象，不缓存进实例字段。
2. `readConfigValue()` 解包 volatile 引用（带 `get()` 的取 `get()`）。
3. `resolveSetting()` 按 kind 归一化，非法值回落默认。
4. `assignSetting()` 按 `path` 写入嵌套结果；后端读段用 `providerSettings()`。
5. 凭据解析在 key 层：`resolveKey(reference)` 由 [lib/credentials.js](../../lib/credentials.js) 完成，支持 `*_2`、`*_3` 多引用。

## 约束与失败行为

- 字段只在 `SETTINGS_SPEC` 声明一次；代码里不藏第二套开关常量。
- 解析失败回落默认、不抛错：设置页的坏值不会让 provider 崩溃。
- `order` 设置页是逗号分隔字符串，`DEFAULT_SETTINGS` 存数组。
- `configField()` 用 `join(',')` 把数组默认值转回字符串。
- `parseOrder()`：小写化、去重、去空；解析为空回落默认顺序。
- `parseFailureClasses()`：显式数组按原样作允许清单。
- 空数组等于禁用全部回退。
- 字符串没命中已知类时回落默认集，单个拼写错误不会静默关掉回退。
- number 的 `min` / `max` / `step` 兼任设置页约束；`coerce` 决定运行时解析器。
- 后端段形状由各自 `path` 决定，无第二张中心表；`http` 段只有 `enabled`。
- 改默认值或配额时同步 `DEFAULT_SETTINGS`、configuration 表与两份 README（ADR-0003）。
- 随包默认变化时再加 cordis.patch.yml。
- `pnpm docs:check` 机械校验 configuration 覆盖每个字段且默认值一致。

## 验证命令

```sh
pnpm docs:check
```

```sh
node --test --test-isolation=none test/settings.test.js
```

提交前跑 `pnpm check`。
