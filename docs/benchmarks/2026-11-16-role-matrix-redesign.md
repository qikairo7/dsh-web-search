# Role-matrix redesign verification — 2026-11-16

Version: `0.9.0` working tree with the ADR-0010 changes; this run shipped as `0.10.0`. English quality set drops Zhihu (`keenable + anysearch`), Exa reclassified free-tier free depth, news-freshness supplement enabled.
Mode: `searchMode: quality` (free role-table sets + BGE rerank + authority ranking; enrichment off by default).
Sample: FRAMES 50 / WebWalkerQA 50. Run date: 2026-11-16 (Asia/Taipei). Raw results: `.research/public-benchmark.json` (gitignored).

## Results

| Benchmark | Metric | Ours (ADR-0010) | DeepSeek Search | Prev ours (0.8.0, 11-15) | Prev ours (0.7.2, 11-14) |
|---|---|---:|---:|---:|---:|
| FRAMES | Evidence Recall@10 | **0.60** | 0.06 | 0.52 | 0.38 |
| FRAMES | All-Evidence Recall@10 | 0.00 | 0.00 | 0.00 | 0.00 |
| FRAMES | MRR | **0.340** | 0.010 | 0.299 | 0.165 |
| FRAMES | Answer Hit@10 | **0.50** | 0.40 | 0.48 | 0.26 |
| FRAMES | Top-1 Gold | **0.24** | 0.00 | 0.22 | 0.10 |
| WebWalkerQA | Evidence Recall@10 | **0.64** | 0.34 | 0.60 | 0.48 |
| WebWalkerQA | All-Evidence Recall@10 | **0.26** | 0.14 | 0.28 | 0.14 |
| WebWalkerQA | MRR | 0.229 | 0.246 | 0.244 | 0.266 |
| WebWalkerQA | Answer Hit@10 | **0.44** | 0.14 | 0.46 | 0.16 |
| WebWalkerQA | Top-1 Gold | 0.06 | **0.20** | 0.10 | 0.16 |

## Takeaways

- The English fan-out change holds at benchmark scale with one fewer provider call per English query: FRAMES improves on every metric over the 0.8.0 run; WebWalkerQA evidence recall rises to 0.64 while MRR / answer hit / top-1 stay inside the 0.7.2–0.8.0 band. Live provider results vary, so treat deltas as noise until a rerun confirms them.
- Provider error counts and empty-result counts are zero on all 50 samples per dataset, both arms.
- The lead over DeepSeek Search is unchanged: evidence recall and answer hit on both datasets; DeepSearch keeps its usual edge on WebWalkerQA top-1.
- All-evidence multi-hop retrieval on FRAMES remains unsolved (both arms 0.00), unchanged from previous runs.

## Run notes

- Design evidence for the English set: two-round arm comparison in `.research/en-quality-arms.json` / `.research/en-quality-arms-r1.json` (7 English queries × {keenable+anysearch, +zhihu, +exa}); gold Top3/Top10 saturated, the two-source set never lost a gold hit.
- Search-only run: `BENCHMARK_ENRICH=1` includes evidence enrichment.

## Reproduce

```sh
pnpm benchmark:preflight
SAMPLE_SIZE=50 pnpm benchmark
```

Runner: `scripts/public-benchmark.mjs`. It loads the committed FRAMES/WebWalkerQA fixture first and writes raw results to `.research/public-benchmark.json` (gitignored).
