# 子系统参考

每页固定四节，链接源码符号，不抄实现；地图见 [architecture](../architecture.md)，规则见 [CODING_STANDARDS](../../CODING_STANDARDS.md)。

## 页面

| 页面 | 范围 |
|---|---|
| [dsh-host](dsh-host.md) | 宿主集成：装载组合、`apply()`、patch 与 tool-web |
| [settings](settings.md) | 配置：`SETTINGS_SPEC`、默认值与解析 |

## 每页固定四节

1. 职责与真源表：`符号` 加指向源码的相对链接。
2. 运行路径：一次启动或请求经过的符号。
3. 约束与失败行为：边界、失败表现与错误码。
4. 验证命令：本仓库可直接执行。

## 同 PR 更新规则

改动这些符号的行为或签名时，同一个 PR 更新对应页；纯内部重构可不动：

- dsh-host：`apply()`、`createProviders()`、cordis.patch.yml。
- settings：`SETTINGS_SPEC`、`DEFAULT_SETTINGS`、`resolveSettings()`。

## 新页模板

四节标题依次照抄，均为 `##` 级。

## Review 三步

1. 真源表链接能打开，符号与源码一致。
2. 运行路径与调用链一致。
3. 验证命令可直接执行并通过。
