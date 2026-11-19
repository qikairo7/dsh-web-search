# 产品功能地图

一眼看清设置页与搜索/抓取工具的用户可见面、期望反馈和失败恢复，AI 测试按图索骥。

## 用户可见面清单

### 设置页

| 区域 | 控件 | 操作 | 期望反馈 |
|---|---|---|---|
| 后端 API Key | Keenable、AnySearch（匿名可用 / Key 可选）；Exa、Tavily、Firecrawl、知乎、SiliconFlow（需要 Key） | 启用开关、输入 Key（逗号/空格分隔多个，最多 8 个）、显示/隐藏、添加/删除、验证、保存、清除（二次确认） | 保存「{name} Key 已保存。」；验证「{name} 在 {ms} ms 内返回 {count} 条结果。」；徽章：已配置、未配置、来自环境变量、凭据库 |
| 后端开关 | AIHOT、HTTP | 开/关 | 保存后生效 |
| 搜索行为 | 搜索模式（质量/快速）、抓取模式（快速/干净） | 下拉选择 | 质量=合并免费源+BGE 重排；快速=单后端优先回退；干净=优先免费抽取 |
| 重排与嵌入模型 | 重排模型、Embedding 模型 | 下拉；拉取模型 | 「已加载 {count} 个模型。」 |
| 剩余额度 | Keenable、AnySearch、Exa、Tavily、Firecrawl、知乎、SiliconFlow | 刷新额度 | 「剩余 {value}」；「请在 Provider 控制台查看」；「无额度查询接口」 |
| 高级 | 意图路由、语言路由、官方文档补充、新闻时效补充、证据增强 | 开/关 | 保存后生效 |
| 页脚 | 保存、刷新状态 | 保存 | 「设置已保存。」；「没有需要保存的改动。」 |

### 工具调用

- `web_search`：按搜索模式聚合多后端，返回 sources（标题/URL/摘要）与可选 content；失败按 `fallbackFailureClasses` 顺序回退下一后端。
- `web_fetch`：抓取单个 URL 返回 Markdown；fast 优先 Keenable/直连 HTTP，clean 优先免费抽取，Tavily/Firecrawl 兜底。

## 错误提示语义表

| 提示 | 含义 | 恢复 |
|---|---|---|
| 验证失败，请检查 Key、网络或 Provider 状态。 | 健康路由 ok:false | 查 Key、网络、Provider 开关后重试 |
| {name} — 验证失败：{reason} | reason = 服务端 code: message | 403 同源/凭据；WEB_PROVIDER_UNAVAILABLE 未配置或停用；bad-request 请求不合法 |
| 无法加载模型，请先保存有效的 SiliconFlow Key。 | /models 失败 | 保存有效 SiliconFlow Key 后重试 |
| 额度查询失败。 | /quotas 失败 | 稍后重试；无查询接口显示「请在 Provider 控制台查看」 |
| 部署拒绝了写入，请检查 Key 后重试。 | 凭据写入被拒 | 检查 Key 与部署写权限 |
| 部署拒绝了这些设置，请复核后重试。 | settings.mutate 失败 | 复核后重试 |
| 有另一处修改先落盘，页面已刷新，请复核后重新保存。 | settings/conflict | 按刷新后状态重存 |
| 请先输入 Key。/ 每个 Provider 最多 8 个 Key。 | 输入校验 | 补 Key / 删到 8 个内 |
| 插件设置当前不可用，请确认插件已启用。 | 设置不可用 | 启用插件后重试 |
| 当前部署以只读方式保存设置；API Key 仍可写入凭据库。 | 只读部署 | Key 可写，其余只读 |
