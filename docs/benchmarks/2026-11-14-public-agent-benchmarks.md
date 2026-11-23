# Public agent-search benchmarks — 2026-11-14

> Historical snapshot: this report records an earlier version line. Its numbers and dates are preserved as-is and are not part of the current capability baseline.

Version: `0.7.0` current; `0.6.1` is the search-only baseline.
Mode: `searchMode: quality` (three providers + BGE rerank + authority ranking).
Sample: FRAMES 50 / WebWalkerQA 50. Generated: 2026-11-14.

## Benchmarks and metrics

- [FRAMES](https://huggingface.co/datasets/google/frames-benchmark): Google multi-hop factual retrieval. The test split has 824 questions, each with `Answer` and `wiki_links` evidence URLs.
- [WebWalkerQA](https://huggingface.co/datasets/callanwu/WebWalkerQA): 680 web-agent questions, each with `answer` and `info.source_website` evidence pages.

Both samples are the first 50 rows of the public dataset. Queries are clipped to 128 characters for parity with the DeepSeek Search API limit.

- **Evidence Recall@10**: at least one gold evidence URL appears in the top 10.
- **All-Evidence Recall@10**: every gold evidence URL appears in the top 10.
- **MRR**: reciprocal rank of the first gold evidence URL.
- **Answer Hit@10**: the normalized gold answer appears in a title, snippet, or summary.
- **Top-1 Gold**: the first result is a gold evidence URL.

## 0.7.0 evidence-enriched rerun

The 0.7.0 quality path fetches the top 5 results and regenerates summaries from the fetched body. Same 50 cached questions and scoring; search results can vary slightly between runs. Enrichment: top-5, 800–1500 chars.

| Benchmark | Metric | 0.6.1 search-only | 0.7.0 enriched | DeepSeek (0.7.0 run) |
|---|---|---:|---:|---:|
| FRAMES | Evidence Recall@10 | 0.34 | 0.36 | 0.04 |
| FRAMES | Answer Hit@10 | 0.26 | **0.30** | 0.44 |
| FRAMES | MRR | 0.182 | 0.182 | 0.007 |
| WebWalkerQA | Evidence Recall@10 | 0.42 | 0.44 | 0.36 |
| WebWalkerQA | Answer Hit@10 | 0.20 | 0.18 | 0.14 |
| WebWalkerQA | All-Evidence Recall@10 | 0.18 | 0.14 | 0.14 |

FRAMES answer cross-tab after enrichment: both answered 12/50; ours only 3/50; DeepSeek only 10/50; neither 25/50; ours retrieved evidence but the answer was not in the summary 14/50.

WebWalkerQA answer cross-tab after enrichment: both answered 3/50; ours only 6/50; DeepSeek only 4/50; neither 37/50; ours retrieved evidence but the answer was not in the summary 20/50.

## 0.6.1 search-only baseline

### FRAMES (n = 50)

| Metric | Ours | DeepSeek Search |
|---|---:|---:|
| Evidence Recall@10 | **0.34** | 0.04 |
| All-Evidence Recall@10 | 0.00 | 0.00 |
| MRR | **0.182** | 0.007 |
| Answer Hit@10 | 0.26 | **0.48** |
| Top-1 Gold | **0.12** | 0.00 |

Cross-tab: ours retrieved evidence but the answer was not in the snippet 15/50; DeepSeek returned the answer without a matching gold evidence URL 22/50; both missed the answer 23/50.

### WebWalkerQA (n = 50)

| Metric | Ours | DeepSeek Search |
|---|---:|---:|
| Evidence Recall@10 | **0.42** | 0.36 |
| All-Evidence Recall@10 | **0.18** | 0.14 |
| MRR | 0.253 | **0.262** |
| Answer Hit@10 | **0.20** | 0.16 |
| Top-1 Gold | 0.16 | **0.22** |

Cross-tab: ours retrieved evidence but the answer was not in the snippet 17/50; DeepSeek returned the answer without a matching gold evidence URL 4/50.

## Main conclusion

- Quality mode is better at finding the evidence page: FRAMES Evidence Recall is 0.36 vs 0.04 after enrichment.
- DeepSeek is still better at putting the answer in the summary on FRAMES: 0.44 vs 0.30; the gap narrowed from 0.22 to 0.14 after enrichment.
- Neither system solves all-evidence multi-hop retrieval: FRAMES All-Evidence Recall is 0.00 for both.
- Evidence enrichment is useful but not sufficient: 14/50 FRAMES questions retrieve evidence without the answer in the 800–1500-character summary.
- The next quality improvement should be answer extraction from fetched pages (or a longer evidence summary for answer-bearing sections), not more provider coverage.

## Reproduce

```sh
pnpm benchmark
```

The runner is `node scripts/public-benchmark.mjs`. It loads the committed FRAMES/WebWalkerQA fixture (`scripts/fixtures/public-benchmark-sample.json`) first, so the 50-row local sample runs without network access. It falls back to the public Hugging Face rows API only when the fixture has fewer rows than needed. `SAMPLE_SIZE` controls the number of rows per benchmark (default 50). Live API runs need `AS_KEY`, `TV_KEY`, `FC_KEY`, `ZH_KEY`, `SF_KEY`, and `DS_TOKEN`.
