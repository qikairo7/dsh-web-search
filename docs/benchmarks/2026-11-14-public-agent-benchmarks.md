# Public agent-search benchmarks — 2026-11-14

Plugin version: `0.7.0`
Mode: `searchMode: quality`
Sample: FRAMES 50 / WebWalkerQA 50
Enrichment: top-5, 800–1500 chars
Generated: 2026-11-14

Baseline: `@qikairo7/dsh-web-search` 0.6.1 (search-only)
Mode: `searchMode: quality` (three providers + BGE rerank + authority ranking)

> This run is search-only. Version 0.7.0 adds evidence-page enrichment; that change is not
> reflected in the 50-question numbers below.

## Benchmarks

- [FRAMES](https://huggingface.co/datasets/google/frames-benchmark) — Google multi-hop factual retrieval benchmark. The test split has 824 questions, each with `Answer` and `wiki_links` evidence URLs.
- [WebWalkerQA](https://huggingface.co/datasets/callanwu/WebWalkerQA) — 680 web-agent questions, each with `answer` and `info.source_website` evidence pages.

Both samples are the first 50 rows of the public dataset. Queries are clipped to 128 characters for parity with the DeepSeek Search API limit.

## Metrics

- **Evidence Recall@10** — at least one gold evidence URL appears in the top 10.
- **All-Evidence Recall@10** — every gold evidence URL appears in the top 10.
- **MRR** — reciprocal rank of the first gold evidence URL.
- **Answer Hit@10** — the normalized gold answer appears in a title, snippet, or summary.
- **Top-1 Gold** — the first result is a gold evidence URL.

## FRAMES (n = 50)

| Metric | Ours | DeepSeek Search |
|---|---:|---:|
| Evidence Recall@10 | **0.34** | 0.04 |
| All-Evidence Recall@10 | 0.00 | 0.00 |
| MRR | **0.182** | 0.007 |
| Answer Hit@10 | 0.26 | **0.48** |
| Top-1 Gold | **0.12** | 0.00 |

Cross-tab:

- Ours retrieved evidence but the answer was not in the snippet: **15/50**.
- DeepSeek returned the answer without a matching gold evidence URL: **22/50**.
- Both systems missed the answer: 23/50.

Interpretation: our multi-source search finds the evidence pages much more often; DeepSeek's index surfaces answer text more often, even when it does not expose the source URL.

## WebWalkerQA (n = 50)

| Metric | Ours | DeepSeek Search |
|---|---:|---:|
| Evidence Recall@10 | **0.42** | 0.36 |
| All-Evidence Recall@10 | **0.18** | 0.14 |
| MRR | 0.253 | **0.262** |
| Answer Hit@10 | **0.20** | 0.16 |
| Top-1 Gold | 0.16 | **0.22** |

Cross-tab:

- Ours retrieved evidence but the answer was not in the snippet: **17/50**.
- DeepSeek returned the answer without a matching gold evidence URL: **4/50**.

Interpretation: on this web-agent benchmark the two systems are close; our evidence coverage is slightly higher, DeepSeek's top-1 precision is slightly higher.

## 0.7.0 evidence-enriched rerun (n = 50)

The 0.7.0 quality path fetches the top 5 results and regenerates summaries from the fetched
body. Same 50 cached questions, same scoring; search results can vary slightly between runs.

| Benchmark | Metric | 0.6.1 search-only | 0.7.0 enriched | DeepSeek (0.7.0 run) |
|---|---|---:|---:|---:|
| FRAMES | Evidence Recall@10 | 0.34 | 0.36 | 0.04 |
| FRAMES | Answer Hit@10 | 0.26 | **0.30** | 0.44 |
| FRAMES | MRR | 0.182 | 0.182 | 0.007 |
| WebWalkerQA | Evidence Recall@10 | 0.42 | 0.44 | 0.36 |
| WebWalkerQA | Answer Hit@10 | 0.20 | 0.18 | 0.14 |
| WebWalkerQA | All-Evidence Recall@10 | 0.18 | 0.14 | 0.14 |

FRAMES answer cross-tab after enrichment:

- Both answered: 12/50
- Ours only: 3/50
- DeepSeek only: 10/50
- Neither: 25/50
- Ours retrieved evidence but the answer was not in the summary: 14/50

WebWalkerQA answer cross-tab after enrichment:

- Both answered: 3/50
- Ours only: 6/50
- DeepSeek only: 4/50
- Neither: 37/50
- Ours retrieved evidence but the answer was not in the summary: 20/50

Interpretation: evidence enrichment raises FRAMES Answer Hit by 0.04 (0.26 → 0.30) and
narrows the gap to DeepSeek, but WebWalkerQA is flat within sample noise (0.20 → 0.18).
The remaining gap is answer extraction from fetched pages, not search coverage.

## Main conclusion

- Our quality mode is better at **finding the evidence page**: FRAMES Evidence Recall is 0.36 vs 0.04 after enrichment.
- DeepSeek is still better at **putting the answer in the summary** on FRAMES: 0.44 vs 0.30; the gap narrowed from 0.22 to 0.14 after enrichment.
- Neither system solves **all-evidence multi-hop retrieval**: FRAMES All-Evidence Recall is 0.00 for both.
- Evidence enrichment is useful but not sufficient: 14/50 FRAMES questions retrieve evidence without the answer in the 800–1500-character summary.
- The next quality improvement should be **answer extraction from fetched pages** (or a longer evidence summary for answer-bearing sections), not more provider coverage.

## Reproduce

```sh
node scripts/public-benchmark.mjs
```

The script reads the public Hugging Face rows API. `SAMPLE_SIZE` controls the number of rows per benchmark.

