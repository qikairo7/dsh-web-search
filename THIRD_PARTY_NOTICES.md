# Third-party notices

dsh-web-search is licensed under [MIT](LICENSE). This file lists third-party code and data that the repository contains or depends on. Each item remains under its own license; nothing here changes those terms.

## Ported source

### @keenable/dsh-keenable 0.1.2

`lib/providers/keenable.js` is ported from [@keenable/dsh-keenable](https://github.com/keenableai/dsh-keenable) version 0.1.2.

MIT License

Copyright (c) 2026 Keenable

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### @anysearch/anysearch-dsh 0.1.8

`lib/providers/anysearchClient.js` and the `lib/tools/anysearch-*.js` modules are ported from [@anysearch/anysearch-dsh](https://github.com/anysearch-team/anysearch-dsh) version 0.1.8.

MIT License

Copyright (c) 2026 AnySearch Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Runtime npm dependencies

| Package | License | Role |
|---|---|---|
| [`@deepseek-ai/schemastery`](https://github.com/deepseek-ai/deepseek-harness/tree/master/vendor/schemastery) | MIT | Configuration schema validation |

## Peer dependencies

These packages are provided by the DSH host and are not bundled with this plugin.

| Package | License | Role |
|---|---|---|
| [`@deepseek-ai/cordis`](https://github.com/cordiverse/cordis) | MIT | Plugin runtime |
| `@deepseek-ai/dsh-credentials` | MIT | Credential lookup |
| `@deepseek-ai/dsh-tools` | MIT | Tool registry |
| `@deepseek-ai/dsh-web` | MIT | Web provider contract |

## Benchmark data

`scripts/fixtures/public-benchmark-sample.json` redistributes the first 50 rows of two public benchmark datasets, used as a local fixture for `pnpm benchmark`. Both datasets are licensed under the Apache License 2.0; see [LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt).

| Dataset | Source | License | Rows used |
|---|---|---|---|
| FRAMES (Factuality, Retrieval, And reasoning MEasurement Set) | [google/frames-benchmark](https://huggingface.co/datasets/google/frames-benchmark) | Apache-2.0 | 50 |
| WebWalkerQA | [callanwu/WebWalkerQA](https://huggingface.co/datasets/callanwu/WebWalkerQA) | Apache-2.0 | 50 |

The datasets are unmodified except for row selection. The benchmark reports that cite them are in [docs/benchmarks](docs/benchmarks/).

## Development dependencies

Development-only packages are declared in `package.json` and pinned in `pnpm-lock.yaml`. They are not distributed with the plugin. The full transitive closure and each package's license are recorded in the lockfile; inspect them with `pnpm licenses list`.
