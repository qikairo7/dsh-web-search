# 提高 web_search 摘要上限

本指南解决一个已知集成问题：`web_search` 每条来源的摘要被截到 800 字。问题原因与机制见 [DSH 宿主契约](../dsh-host-contract.md)；本页只给可执行步骤。

## 背景

`dsh-tool-web` 的 `searchSummaryMaxChars` 默认 800。standard preset 在 preset 内声明 `tool-web`，插件的 bundle patch 命中不了 preset 内的子行，因此无法随包修复。官方通道是在 profile patch 里用 `- id: preset-standard` 整体重述 preset 声明：`config` 整体替换、不深合并。

## 步骤

1. 找到正在使用的 profile 目录：`~/.dsh/profiles/<name>/`（Windows 为 `%USERPROFILE%\.dsh\profiles\<name>\`）。
2. 打开随 DSH 安装的官方 preset 文件，复制当前版本 `plugins:` 列表的**全部插件行**：
   - Windows Desktop 安装：`C:\Users\<用户>\AppData\Local\Programs\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-web-app\presets\standard.patch.yml`
   - 其他安装方式在对应 `node_modules\@deepseek-ai\dsh-web-app\presets\` 下找同名文件。
3. 编辑该 profile 的 `cordis.patch.yml`，追加覆盖块。`plugins` 必须原样包含步骤 2 复制的全部插件行，只修改 `tool-web` 一行：

```yaml
- id: preset-standard
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    id: standard
    order: 1
    plugins:
      # 粘贴步骤 2 复制的全部插件行，保持原有缩进层级；不能只保留 tool-web。
      - id: tool-web
        name: '@deepseek-ai/dsh-tool-web'
        config:
          fetch: true
          searchTimeoutMs: 60000
          searchSummaryMaxChars: 1600
      # ……其余插件行按原样继续
```

4. 重启 DSH。

## 验收

- 重启后任意 `web_search`，单条来源摘要可以超过 800 字。
- 有 dsh CLI 时运行 `dsh --profile <name> --dump-config`，确认 `searchSummaryMaxChars` 为所设值。

## 限制与维护

- 覆盖会把 standard preset 钉在复制时的版本。DSH 升级后 preset 可能变化，需要重新执行步骤 2–3。
- 数值是个人偏好：1600 对应本插件 800–1500 字的目标摘要长度；更在意 token 消耗可以改小。
- 上游（`dsh-tool-web` 尊重 provider 摘要长度，或为 preset 提供可穿透的配置缝）修复后，本指南作废。
