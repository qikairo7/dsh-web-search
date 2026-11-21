# ADR 索引与写法

`docs/adr/` 一条一份，记录已接受的契约级决策，历史不改写。本文件是 ADR 的入口：新条目的写法约定与全部条目索引。

## 写法约定

### Rejected 节

每条 ADR 带一个 `## Rejected` 节，收集被否的备选方案，一条写一句方案加一句否决理由。它替代独立的 rejected 目录，用更低成本保住「考虑过但否决」的理由，防止旧方案被重新提议。新 ADR 从此必带；存量 14 条不回填。

### 互链纪律

ADR 记录的事实随代码改：路径、名字、默认值、行为变了，同步改对应描述。决策本身变了，不改动原 ADR，新开一条，并让两条互相链接。

## 索引

- [ADR-0001](0001-provider-only-standard-ids.md)
- [ADR-0002](0002-quality-search-rerank.md)
- [ADR-0003](0003-free-tier-first.md)
- [ADR-0004](0004-anysearch-advanced-tools.md)
- [ADR-0005](0005-tavily-advanced-tools.md)
- [ADR-0006](0006-aihot-free-tools.md)
- [ADR-0007](0007-keenable-exa-providers.md)
- [ADR-0008](0008-realtime-weather-fx.md)
- [ADR-0009](0009-quota-aware-routing.md)
- [ADR-0010](0010-role-matrix-redesign.md)
- [ADR-0011](0011-bing-keyless-floor.md)
- [ADR-0012](0012-github-provider.md)
- [ADR-0013](0013-x-catbus-port.md)
- [ADR-0014](0014-direct-http-private-address-guard.md)
