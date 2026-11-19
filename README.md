<div align="center">

<a href="https://github.com/qikairo7/dsh-web-search">
  <img alt="dsh-web-search" src="icon.svg" width="96" height="96">
</a>

### DeepSeek Harness 的免费联网插件：免 Key 即用的网络搜索与网页抓取

中文 / [English](README.en.md)

<a href="https://github.com/qikairo7/dsh-web-search">GitHub</a> · <a href="https://github.com/qikairo7/dsh-web-search/issues">Issues</a> · <a href="docs/architecture.md">架构</a> · <a href="docs/configuration.md">配置</a> · <a href="CHANGELOG.md">版本日志</a>

<p>
  <a href="https://github.com/qikairo7/dsh-web-search/releases"><img src="https://img.shields.io/github/v/release/qikairo7/dsh-web-search?color=369eff&labelColor=black&logo=github&style=flat-square" alt="release"></a>
  <a href="https://github.com/qikairo7/dsh-web-search"><img src="https://img.shields.io/github/stars/qikairo7/dsh-web-search?labelColor=black&style=flat-square&color=ffcb47" alt="stars"></a>
  <a href="https://github.com/qikairo7/dsh-web-search/issues"><img src="https://img.shields.io/github/issues/qikairo7/dsh-web-search?labelColor=black&style=flat-square&color=ff80eb" alt="issues"></a>
  <a href="https://github.com/qikairo7/dsh-web-search/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-111111?labelColor=black&style=flat-square" alt="license"></a>
</p>

</div>

***

## 这是什么

为 DSH 的 agent 提供多后端聚合的搜索与抓取：免费后端自动路由与回退，替换官方按量计费的 Search/Fetch；`web_search` / `web_fetch` 用法不变，也可自带 Key 启用更多后端。

运行需要 DeepSeek Harness `0.2.2-rc.5`（本插件实测版本）、Node.js `22.19+` 或 `24+`，以及挂载 `dsh-web` 的 profile。状态为 pre-1.0，行为、默认值和后端支持可能在小版本间变化。

非目标：不接入官方收费 Search/Fetch API，不依赖 MCP，不安装第三方 DSH 插件。

## 为什么

- 免费额度优先、自动故障切换的多后端池，免费额度用尽才落到付费尾。 → [架构](docs/architecture.md) · [配置](docs/configuration.md)
- 质量管线：按 URL 去重、BGE 重排叠加域名权威加权，前 5 条做证据增强。 → [架构](docs/architecture.md)
- 失败分类回退门控：`fallbackFailureClasses` 决定哪些失败可以换下一后端。 → [配置](docs/configuration.md)
- Bing 免 Key 搜索地板，位于免费栈之后、付费尾之前（ADR-0011）。 → [架构决策](docs/adr/)
- 可选 AnySearch / Tavily / AIHOT 高级工具，天气与汇率直连实时数据。 → [配置](docs/configuration.md)

## 快速开始

```sh
git clone https://github.com/qikairo7/dsh-web-search.git
cd dsh-web-search
dsh plugin --profile desktop add "."
```

重启 DSH 后，在 **设置 → 搜索与抓取设置** 填写 API Key、启用后端即可开始搜索。完整安装与配置步骤见 [开发指南](docs/development.md)。

## 凭据

API Key 通过 DSH 凭据服务读取，优先在 Provider 卡片点 **添加 Key**。手改 `~/.dsh/.credentials.yaml` 时 Key 必须嵌在 `refs` 之下；字段名与多 Key 规则见 [配置参考](docs/configuration.md)。

## 升级与更多

- 从 0.12.x 升级见 [0.13.0 升级指南](docs/upgrade/0.13.0.md)。
- 参与贡献见 [贡献指南](CONTRIBUTING.zh.md)，安全漏洞按 [SECURITY.zh.md](SECURITY.zh.md) 私下报告。
- 许可：MIT；第三方归属见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
