# Public agent-search benchmarks — 2026-11-14

Plugin: `@qikairo7/dsh-web-search` 0.6.1
Mode: `searchMode: quality` (three providers + BGE rerank + authority ranking)

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

## Main conclusion

- Our quality mode is better at **finding the evidence page**: FRAMES Evidence Recall is 0.34 vs 0.04.
- DeepSeek is better at **putting the answer in the snippet**: FRAMES Answer Hit is 0.48 vs 0.26.
- Neither system solves **all-evidence multi-hop retrieval**: FRAMES All-Evidence Recall is 0.00 for both.
- The gap suggests the next quality improvement should be **answer-enriched summaries for evidence pages**, not more provider coverage.

## Reproduce

```sh
node scripts/public-benchmark.mjs
```

The script reads the public Hugging Face rows API. `SAMPLE_SIZE` controls the number of rows per benchmark.

