# Benchmark

基准用于比较搜索质量与延迟，不作为 CI 门禁。当前报告在 [docs/benchmarks](docs/benchmarks/)，runner 是 [scripts/public-benchmark.mjs](scripts/public-benchmark.mjs)。

## 运行

```sh
pnpm benchmark:preflight
pnpm benchmark
```

凭据放在仓库根目录的 `.env`（gitignored，格式见 `.env.example`），`pnpm benchmark` 会自动加载；不要在 shell 命令行里直接写 key。需要 `AS_KEY`、`TV_KEY`、`FC_KEY`、`ZH_KEY`、`SF_KEY`、`DS_TOKEN`。`DS_TOKEN` 可以是 DSH account token，也可以是 DeepSeek API key（`sk-` 开头）。`SAMPLE_SIZE` 控制每个基准的行数，默认 50。默认是 search-only；`BENCHMARK_ENRICH=1` 时才启用 evidence enrichment（会更慢）。runner 优先读 `scripts/fixtures/public-benchmark-sample.json`，fixture 不足时才回退到公开 rows API；结果写 `.research/public-benchmark.json`（gitignored），不提交。

## 指标

- FRAMES：Evidence Recall@10、All-Evidence Recall@10、MRR、Answer Hit@10、Top-1 Gold。
- WebWalkerQA：同上，数据源与样本量见报告。
- 报告必须保留日期、版本、样本量和原始指标；不要改写历史数据。

## 规则

- `scripts/public-benchmark.mjs` 是唯一允许引用 DeepSeek 付费 API 的脚本，用于对比；不要把该调用复制进 `lib/` 或其他脚本。
- 基准结论用于决策参考，不替代单元测试和 DSH 内真实冒烟。
- 改动搜索行为后，更新对应报告或新增报告，并在 PR 中说明对比基线。
