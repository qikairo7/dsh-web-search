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

为 DeepSeek Harness 的 agent 提供多后端聚合的搜索抓取：免费后端自动路由与回退，替换官方计费的 Search/Fetch；`web_search` / `web_fetch` 用法不变，也可自带 Key 启用更多后端。

运行需要 DeepSeek Harness `0.2.2-rc.5`（实测）、Node.js `22.19+` 或 `24+`，以及挂载 `dsh-web` 的 profile。

> **状态**：pre-1.0，行为、默认值和后端支持可能在小版本间变化。

> **非目标**：
> - 不接入官方收费 Search/Fetch API
> - 不依赖 MCP
> - 不依赖、不捆绑其他第三方 DSH 插件

## 为什么

- 免费额度优先、自动故障切换的多后端池，用尽才落到付费后端兜底。 → [架构](docs/architecture.md) · [配置](docs/configuration.md)
- 质量管线：URL 去重、BGE 重排叠加域名权威，前 5 条做证据增强。 → [架构](docs/architecture.md)
- 失败分类回退门控：`fallbackFailureClasses` 决定何时换下一后端。 → [配置](docs/configuration.md)
- Bing 免 Key 搜索保底，在免费栈与付费后端兜底之间（ADR-0011）。 → [架构决策](docs/adr/)
- 可选 [AnySearch](https://anysearch.com) / [Tavily](https://tavily.com) / [AIHOT](https://aihot.news)，天气汇率直连实时；重排与语义去重由 [硅基流动](https://cloud.siliconflow.cn/i/E3nhNFP4) 提供。全部后端与免费额度见[配置](docs/configuration.md)。

## 快速开始

```sh
git clone https://github.com/qikairo7/dsh-web-search.git
cd dsh-web-search
dsh plugin --profile desktop add "."
```

重启 DeepSeek Harness，在 **设置 → 搜索与抓取设置** 填 API Key、启用后端即可。完整步骤见[开发指南](docs/development.md)。

## 凭据

API Key 经 DeepSeek Harness 凭据服务读取，优先在 Provider 卡片点 **添加 Key**。手改 `~/.dsh/.credentials.yaml` 时 Key 须在 `refs` 下；字段名与多 Key 规则见 [配置参考](docs/configuration.md)。

## 文档索引

- 使用：[配置参考](docs/configuration.md) · [升级指南](docs/upgrade/0.13.0.md) · [版本日志](CHANGELOG.md) · [历史归档](docs/changelog-archive.md)
- 原理：[架构](docs/architecture.md) · [架构决策](docs/adr/) · [宿主契约](docs/dsh-host-contract.md) · [功能地图](docs/feature-map.md) · [插件详情](docs/DETAIL.md) · [插件详情（英文）](docs/DETAIL.en.md)
- 开发：[开发指南](docs/development.md) · [测试策略](docs/testing.md) · [新增 Provider](docs/cookbook/adding-a-provider.md) · [提高摘要上限](docs/cookbook/raising-summary-cap.md) · [贡献指南](CONTRIBUTING.md)
- 深入：[子系统参考](docs/subsystems/README.md) · [Review 规则](docs/defensive-patterns.md) · [代理领域文档](docs/agents/domain.md) · [基准入口](docs/benchmarks/BENCHMARK.md) · [基准报告](docs/benchmarks/) · [术语表](GLOSSARY.md)
- 治理：[文档标准](docs/AGENTS.md) · [文档清单](docs/schema-inventory.md) · [文档同步映射](docs/schema-sync-map.md) · [安全策略](SECURITY.zh.md) · [商标](TRADEMARKS.zh.md)

## 升级与更多

- 0.12.x 升级见 [0.13.0 升级指南](docs/upgrade/0.13.0.md)。
- 贡献见 [贡献指南](CONTRIBUTING.md)，安全漏洞按 [SECURITY.zh.md](SECURITY.zh.md) 私下报告。
- 许可 MIT；第三方归属见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
