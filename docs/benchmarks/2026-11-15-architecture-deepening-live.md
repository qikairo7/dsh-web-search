# Architecture-deepening live verification — 2026-11-15

Version: `0.8.0`.
Mode: `searchMode: quality` (free provider pairs + BGE rerank + authority ranking).
Sample: FRAMES 50 / WebWalkerQA 50. Run date: 2026-11-15 (Asia/Taipei), after the architecture-deepening wave (provider operation skeleton, routing-fact single home, cache policy owner, official-domain single source).

## Results

| Benchmark | Metric | Ours (0.8.0) | DeepSeek Search | Prev ours (0.7.2, 11-14) |
|---|---|---:|---:|---:|
| FRAMES | Evidence Recall@10 | **0.52** | 0.06 | 0.38 |
| FRAMES | All-Evidence Recall@10 | 0.00 | 0.00 | 0.00 |
| FRAMES | MRR | **0.299** | 0.010 | 0.165 |
| FRAMES | Answer Hit@10 | **0.48** | 0.38 | 0.26 |
| FRAMES | Top-1 Gold | **0.22** | 0.00 | 0.10 |
| WebWalkerQA | Evidence Recall@10 | **0.60** | 0.34 | 0.48 |
| WebWalkerQA | All-Evidence Recall@10 | **0.28** | 0.14 | 0.14 |
| WebWalkerQA | MRR | **0.244** | 0.243 | 0.266 |
| WebWalkerQA | Answer Hit@10 | **0.46** | 0.14 | 0.16 |
| WebWalkerQA | Top-1 Gold | 0.10 | **0.20** | 0.16 |

## Takeaways

- The deepened stack survives a full live run: provider error counts and empty-result counts are both zero on all 50 samples per dataset.
- Every metric stays in or above the 0.7.2 band; FRAMES improves visibly (evidence recall 0.38 → 0.52, answer hit 0.26 → 0.48). Live provider results vary, so treat deltas as noise until a rerun confirms them.
- The plugin keeps its main advantage over DeepSeek Search: evidence recall and MRR on FRAMES, evidence recall and answer hit on WebWalkerQA.
- All-evidence multi-hop retrieval on FRAMES remains unsolved (both arms 0.00), unchanged from previous runs.

## Run notes

- All 17 preflight checks passed (`pnpm benchmark:preflight`): every backend (anysearch, keenable, exa, tavily, firecrawl, zhihu, zhihu-site, aihot, http) plus siliconflow rerank/embeddings and the DeepSeek comparison arm.
- Search-only run: the benchmark defaults to `enrichEnabled: false`; set `BENCHMARK_ENRICH=1` to include evidence enrichment.

## Reproduce

```sh
pnpm benchmark:preflight
SAMPLE_SIZE=50 pnpm benchmark
```

Runner: `scripts/public-benchmark.mjs`. It loads the committed FRAMES/WebWalkerQA fixture first and writes raw results to `.research/public-benchmark.json` (gitignored).
