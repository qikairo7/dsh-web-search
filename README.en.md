<div align="center">

<a href="https://github.com/qikairo7/dsh-web-search">
  <img alt="dsh-web-search" src="icon.svg" width="96" height="96">
</a>

### Free web search and fetch plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — keyless-ready out of the box

[中文](README.md) / English

<a href="https://github.com/qikairo7/dsh-web-search">GitHub</a> · <a href="https://github.com/qikairo7/dsh-web-search/issues">Issues</a> · <a href="docs/architecture.md">Architecture</a> · <a href="docs/configuration.md">Configuration</a> · <a href="CHANGELOG.md">Changelog</a>

<p>
  <a href="https://github.com/qikairo7/dsh-web-search/releases"><img src="https://img.shields.io/github/v/release/qikairo7/dsh-web-search?color=369eff&labelColor=black&logo=github&style=flat-square" alt="release"></a>
  <a href="https://github.com/qikairo7/dsh-web-search"><img src="https://img.shields.io/github/stars/qikairo7/dsh-web-search?labelColor=black&style=flat-square&color=ffcb47" alt="stars"></a>
  <a href="https://github.com/qikairo7/dsh-web-search/issues"><img src="https://img.shields.io/github/issues/qikairo7/dsh-web-search?labelColor=black&style=flat-square&color=ff80eb" alt="issues"></a>
  <a href="https://github.com/qikairo7/dsh-web-search/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-111111?labelColor=black&style=flat-square" alt="license"></a>
</p>

</div>

***

## What this is

For DeepSeek Harness agents, multi-backend aggregated search and fetch: free backends route and fall back automatically, replacing the metered official Search/Fetch; `web_search` / `web_fetch` usage is unchanged, and you can bring your own keys for more backends.

It needs DeepSeek Harness `0.2.2-rc.5` (verified), Node.js `22.19+` or `24+`, and a profile that mounts `dsh-web`.

> **Status**: pre-1.0 — behavior, defaults, and provider support can change between minor versions.

> **Non-goals**:
> - the paid official Search/Fetch APIs
> - an MCP server
> - depending on or bundling other third-party DSH plugins

## Why

- Free-tier-first backend pool with automatic failover and a keyless Bing floor (ADR-0011); paid backends only when free quota is gone. → [Architecture](docs/architecture.md) · [Configuration](docs/configuration.md)
- Quality pipeline: URL dedupe, BGE rerank with a domain-authority prior, evidence enrichment on the top 5. → [Architecture](docs/architecture.md)
- Failure-class fallback gating: `fallbackFailureClasses` decides which failures may move to the next provider; fast mode also retries one more free backend on an empty result (ADR-0015). → [Configuration](docs/configuration.md) · [Architecture decisions](docs/adr/)
- Optional [AnySearch](https://anysearch.com) / [Tavily](https://tavily.com) / [AIHOT](https://aihot.news) / [GitHub](https://github.com) backends; weather/FX; rerank/dedupe via [SiliconFlow](https://cloud.siliconflow.cn/i/E3nhNFP4). All backends: [Configuration](docs/configuration.md).

## Quick start

```sh
git clone https://github.com/qikairo7/dsh-web-search.git
cd dsh-web-search
dsh plugin --profile desktop add "."
```

Restart DeepSeek Harness, then add API keys and enable backends under **Settings → Search and fetch settings**. Full steps in the [Development guide](docs/development.md).

## Credentials

API keys come from the DeepSeek Harness credentials service; prefer the provider card's **Add key**. To hand-edit `~/.dsh/.credentials.yaml`, nest keys under `refs`; field names and multi-key rules are in [Configuration](docs/configuration.md).

## Documentation index

- Usage: [Configuration](docs/configuration.md) · [Upgrade guide](docs/upgrade/0.13.0.md) · [Changelog](CHANGELOG.md) · [Changelog archive](docs/changelog-archive.md)
- How it works: [Architecture](docs/architecture.md) · [Architecture decisions](docs/adr/) · [Host contract](docs/dsh-host-contract.md) · [Feature map](docs/feature-map.md) · [Plugin details](docs/DETAIL.md) · [Plugin details (EN)](docs/DETAIL.en.md)
- Development: [Development guide](docs/development.md) · [Testing strategy](docs/testing.md) · [Adding a provider](docs/cookbook/adding-a-provider.md) · [Raising the summary cap](docs/cookbook/raising-summary-cap.md) · [Contributing](CONTRIBUTING.md)
- Deep dive: [Subsystem reference](docs/subsystems/README.md) · [Review rules](docs/defensive-patterns.md) · [Agent domain docs](docs/agents/domain.md) · [Benchmark entry](docs/benchmarks/BENCHMARK.md) · [Benchmark reports](docs/benchmarks/) · [Glossary](GLOSSARY.md)
- Governance: [Documentation standard](docs/AGENTS.md) · [Document inventory](docs/schema-inventory.md) · [Documentation sync map](docs/schema-sync-map.md) · [Security policy](SECURITY.md) · [Trademarks](TRADEMARKS.md)

## Upgrade and more

- Upgrading from 0.12.x: [0.13.0 upgrade guide](docs/upgrade/0.13.0.md).
- Contribute via [CONTRIBUTING.md](CONTRIBUTING.md); report vulnerabilities privately via [SECURITY.md](SECURITY.md).
- License: MIT; third-party notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
