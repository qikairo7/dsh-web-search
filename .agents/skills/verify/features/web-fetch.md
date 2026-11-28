# web_fetch 抓取

`web_fetch` 让模型直连抓一个网页的正文，拿到能读的文本而不是链接。用户给一个 URL，模型读完再回答。

## Sub-features

- `fetch-content` 抓到的正文非空。
- `fetch-status` 上游返回 200。
- `fetch-kind` 返回体带 `kind`，HTML 页面走 HTML 抽取。
- `fetch-tool-shape` 工具层的入参和结果形状不变：`url` 字符串进，正文和状态码出。

## How to get to it (user POV)

- 在 DSH 会话里给一个网页 URL，说「读一下这个页面」或「总结这个链接」。
- 用户不直接看见工具调用，只看见基于页面内容的回答。

## Driving it with ego

Preconditions:

- 隔离 web 实例已起，Doctor 通过。
- 目标页面是公开可访问的，不需要登录。

- **抓一次。** 直驱插件的 auto 抓取 provider。跑 `node .agents/skills/verify/scripts/drive-web.mjs`。它对 `https://nodejs.org/api/path.html` 抓一次，输出 HTTP 状态、`kind` 和正文字符数，正文前 300 字符也打出来。期望：HTTP 200，`kind` 是 `html`，正文字符数远大于零（上一轮实测 17999）。
- **核正文是正文不是外壳。** 脚本输出的前 300 字符应当是页面标题和正文开头，不是导航菜单或脚本。期望：开头能看到页面标题文字。
- **走用户视角。** 在实例的会话里给一个 URL 让模型总结，等回答完整，截图。期望：总结里的事实能在抓到的正文里找到，不是模型自己的通识。keyed 和 dogfooding 路径做这一步；keyless 路径的实例没有模型，跳过。
- **留证据。** 脚本输出存成 `provider-drive.log`，会话那一步存截图。

## Gotchas

- 抓取默认顺序里 Keenable 在前，会多花一次后端配额。直驱时显式指定 `order: ['http']`，走直连 HTTP 那一路。
- `body.kind` 是 `html` 时，provider 给的是 HTML 原文，正文要过一遍抽取才成文本。直接数 HTML 字符数没有意义。
- 直驱走的是 provider 层，不经过 `dsh-tool-web` 的工具层。工具层会把 HTML 转成 Markdown 再给模型，转换由 `dsh-tool-web` 负责，provider 不该自己做这件事。
- 目标页面要稳定。挑文档页这种长期不动的，不要挑带时间戳的页面。
