<div align="center">

<a href="https://github.com/qikairo7/dsh-web-search">
  <img alt="dsh-web-search" src="icon.svg" width="96" height="96">
</a>

### Free-tier-first multi-backend search and fetch providers for DeepSeek Harness

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

This plugin implements the search and fetch providers for `ctx.web`: free allowances and direct HTTP replace the paid official DeepSeek Search/Fetch APIs while the first-party `dsh-tool-web` tool layer stays. The model still calls `web_search` and `web_fetch`; only the backends change to a multi-backend router, with optional AnySearch / Tavily / AIHOT advanced tools.

It needs DeepSeek Harness `0.2.2-rc.5` (the version this bundle was verified against), Node.js `22.19+` or `24+`, and a profile that mounts `dsh-web`.

## Why

- A free-tier-first pool of backends that fails over automatically and only reaches the paid tail when free quota is gone. → [Architecture](docs/architecture.md)
- Quality pipeline: URL dedupe, BGE rerank with a domain-authority prior, evidence enrichment on the top 5. → [Architecture](docs/architecture.md)
- Failure-class fallback gating: `fallbackFailureClasses` decides which failures may move to the next provider. → [Configuration](docs/configuration.md)
- Bing keyless search floor between the free stack and the paid tail (ADR-0011). → [Architecture decisions](docs/adr/)
- Optional AnySearch / Tavily / AIHOT advanced tools, plus live weather and FX. → [Configuration](docs/configuration.md)

## Quick start

```sh
git clone https://github.com/qikairo7/dsh-web-search.git
cd dsh-web-search
dsh plugin --profile desktop add "."
```

Restart DSH, then fill API keys and enable backends under **Settings → Search and fetch settings**. Full install and configuration steps are in the [Development guide](docs/development.md).

## Credentials

API keys are read through the DSH credentials service; prefer the provider card's **Add key**. To hand-edit `~/.dsh/.credentials.yaml`, nest keys under `refs`; field names and multi-key rules are in [Configuration](docs/configuration.md).

## Upgrade and more

- Upgrading from 0.12.x: [0.13.0 upgrade guide](docs/upgrade/0.13.0.md).
- Contribute via [CONTRIBUTING.md](CONTRIBUTING.md); report vulnerabilities privately via [SECURITY.md](SECURITY.md).
- License: MIT; third-party notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
