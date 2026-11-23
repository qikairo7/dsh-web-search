# Architecture-refactor live benchmark — 2026-11-14

Version: `0.7.2`.
Mode: `searchMode: quality` (three providers + BGE rerank + authority ranking).
Sample: FRAMES 50 / WebWalkerQA 50. Generated: 2026-11-14T16:59:20Z.

## Results

| Benchmark | Metric | Ours (0.7.2) | DeepSeek Search |
|---|---|---:|---:|
| FRAMES | Evidence Recall@10 | **0.38** | 0.06 |
| FRAMES | All-Evidence Recall@10 | 0.00 | 0.00 |
| FRAMES | MRR | **0.165** | 0.010 |
| FRAMES | Answer Hit@10 | 0.26 | **0.38** |
| FRAMES | Top-1 Gold | **0.10** | 0.00 |
| WebWalkerQA | Evidence Recall@10 | **0.48** | 0.34 |
| WebWalkerQA | All-Evidence Recall@10 | 0.14 | 0.14 |
| WebWalkerQA | MRR | **0.266** | 0.245 |
| WebWalkerQA | Answer Hit@10 | **0.16** | 0.14 |
| WebWalkerQA | Top-1 Gold | 0.16 | **0.20** |

## Takeaways

- The plugin keeps its main advantage: evidence recall is 0.38 vs 0.06 on FRAMES and 0.48 vs 0.34 on WebWalkerQA.
- DeepSeek returns the answer in the summary more often on FRAMES: 0.38 vs 0.26.
- All-evidence multi-hop retrieval is still unsolved on FRAMES: both are 0.00.
- Compared with the documented 0.7.0 run (FRAMES 0.36 / 0.30 / 0.182; WebWalkerQA 0.44 / 0.18 / 0.14), the search metrics stay in the same band. Live provider results vary, so treat small deltas as noise until a rerun confirms them.
- All 50 samples per dataset returned results; provider error counts and empty-result counts are both zero.

## Run notes

- `DS_TOKEN` was supplied as a DeepSeek API key (`sk-` prefix) and sent with `Authorization: Bearer`; the runner also keeps the DSH `x-dsh-auth-token` path for DSH account tokens.
- This run is search-only: the benchmark defaults to `enrichEnabled: false`; set `BENCHMARK_ENRICH=1` to include evidence enrichment (it is slower).
- Firecrawl was enabled with a working key for this run; all provider preflight checks passed.

## Reproduce

```sh
pnpm benchmark:preflight
SAMPLE_SIZE=50 pnpm benchmark
```

Runner: `scripts/public-benchmark.mjs`. It loads the committed FRAMES/WebWalkerQA fixture first and writes raw results to `.research/public-benchmark.json` (gitignored).
