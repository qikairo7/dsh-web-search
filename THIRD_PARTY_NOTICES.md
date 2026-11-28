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

### DDDMUC/dsh-free-search

The Bing SERP parsing in `lib/providers/bing.js` — the `b_algo` block mapping, the `bing.com/ck/a` `u`-parameter unwrap, the one-request-no-retry rule, and the token-overlap relevance gate for unrelated cache pages — is adapted from [DDDMUC/dsh-free-search](https://github.com/DDDMUC/dsh-free-search) (see its ADR-adjacent notes in `lib/engines/bing.js` and `lib/engines/shared.js`).

MIT License

Copyright (c) 2026 DDDMUC

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

### catbus（MIT）

`lib/tools/x/` 从 [catbus](https://github.com/cv-cat/catbus) `src/platforms/x` 与部分 `src/core` 移植。移植基线 commit `163424c67471d323ac3b1cb68e2b35a3427398ce`（catbus 0.2.1）。只移植 MIT TypeScript 实现，逐文件裁剪如下（来源 → 本仓库文件 → 裁剪）：

| catbus 来源 | 本仓库文件 | 裁剪 |
|---|---|---|
| `src/platforms/x/web/profile.ts` | `lib/tools/x/profile.js` | 保留常量与 GraphQL 头；FORM/UPLOAD 头不移植 |
| `src/platforms/x/web/graphql.ts` | `lib/tools/x/graphql.js` | 注册表裁剪到 SearchTimeline；GET queryParams 不移植 |
| `src/platforms/x/web/transaction.ts` | `lib/tools/x/transaction.js` | 全量移植 |
| `src/platforms/x/web/client.ts` | `lib/tools/x/client.js` | 保留 cookie 会话与 graphqlPostQuery；GET/mutation/REST/媒体不移植 |
| `src/platforms/x/web/normalize.ts` | `lib/tools/x/normalize.js` | 保留 item、tweetResults、cursorOf；comment/user/chat 不移植 |
| `src/platforms/x/web/api.ts`、`commands.ts` | `lib/tools/x/search.js` | 只保留 searchWork 与 itemSearch；其余命令不移植 |
| `src/core/cookies.ts`、`http.ts` | `lib/tools/x/http.js` | 保留 cookie 罐与 JSON POST；form/multipart/跳转跟随不移植 |
| `src/core/py.ts` | `lib/tools/x/py.js` | 只保留 quote 与 compactJson |
| `src/core/errors.ts` | `lib/tools/x/errors.js` | 保留 X 错误词表与「上游已变」提示 |
| `src/platforms/x/index.ts` | `lib/tools/x/index.js` | 只注册 `x_search` 一条只读命令 |
| `static/x/graphql.json` | `lib/tools/x/static/graphql.json` | 裁剪到 SearchTimeline 操作，featureDefaults 全量保留 |
| `static/x/transaction_l1.json` | `lib/tools/x/static/transaction_l1.json` | 原样分发 |

未移植的 core 模块：auth-store、login、files、fsutil、export、log、registry、toolkit、schemas、options、vocab 等；不引入 `zod`，仅新增运行时依赖 `wreq-js`。

MIT License

Copyright (c) 2026 cv-cat

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

上游溯源：catbus 的 X 模块包装 [cv-cat/XApis](https://github.com/cv-cat/XApis)（Python），catbus 锁定其 commit `3fe6ea7d9700a415c14919e267d5826fc9be3e34`。XApis 无许可证；本仓库未复制其任何 Python 源码，仅在此记录来源。

## Runtime npm dependencies

| Package | License | Role |
|---|---|---|
| [`@deepseek-ai/schemastery`](https://github.com/deepseek-ai/deepseek-harness/tree/master/vendor/schemastery) | MIT | Configuration schema validation |
| [`wreq-js`](https://github.com/sqdshguy/wreq-js) | MIT | X 搜索的浏览器 TLS 指纹 HTTP 客户端 |

## Peer dependencies

These packages are provided by the DSH host and are not bundled with this plugin.

| Package | License | Role |
|---|---|---|
| [`@deepseek-ai/cordis`](https://github.com/cordiverse/cordis) | MIT | Plugin runtime |
| `@deepseek-ai/dsh-credentials` | MIT | Credential lookup |
| `@deepseek-ai/dsh-tools` | MIT | Tool registry |
| `@deepseek-ai/dsh-web` | MIT | Web provider contract |

## Development dependencies

Development-only packages are declared in `package.json` and pinned in `pnpm-lock.yaml`. They are not distributed with the plugin. The full transitive closure and each package's license are recorded in the lockfile; inspect them with `pnpm licenses list`.
