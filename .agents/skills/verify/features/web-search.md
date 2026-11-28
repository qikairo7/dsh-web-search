# web_search 搜索

`web_search` 让模型一次拿到多个真实来源。用户在会话里问一句，答案底下带着标题、链接和摘要。这份文件讲怎么证明这条链路还通。

## Sub-features

- `search-zh` 中文查询返回多来源结果，含中文信源。
- `search-en` 英文技术查询返回多来源结果，官方文档靠前。
- `search-fields` 每条结果有标题、URL、摘要三个字段。
- `search-backend` 应答后端不是只有兜底信源。
- `search-tool-shape` 工具层的入参和结果形状不变：`queries` 数组进，`sources` 数组出。

## How to get to it (user POV)

- 在 DSH 会话里问一句需要实时信息的问题，模型自己决定调 `web_search`。
- 用户不直接看见工具调用，只看见答案里的来源列表。

## Driving it with ego

Preconditions:

- 隔离 web 实例已起，Doctor 通过。
- 实例所在 profile 装的是本仓库当前代码。
- keyless 路径下不需要任何 Key；keyed 路径下按 [`../SKILL.md`](../SKILL.md) 的 keyed 一节注入。

- **跑中文查询。** 直驱插件的 auto 搜索 provider。跑 `node .agents/skills/verify/scripts/drive-web.mjs`。它对「Node.js 文件读取」跑一次搜索，输出结果条数、应答后端和前三条的标题、URL、摘要长度。期望：条数大于零，前三条的 title/url/snippet 三个计数都不为零。
- **跑英文查询。** 同一次运行里对「site:nodejs.org fs.readFile」再跑一次。期望：条数大于零，前三条里有 nodejs.org 的官方文档页面。
- **核应答后端。** 脚本输出里的 `answered=[...]` 列出应答了的后端。期望：不只有 bing、tavily、firecrawl 这三家兜底信源。keyless 下典型值是 keenable 和 anysearch。
- **核字段形状。** 前三条每条都打印 `title | url | snippet:<长度>`。期望：三个字段都有内容，URL 以 `http` 开头。
- **走用户视角。** 在实例的会话里问一句「Node.js 怎么读文件」，等回答完整，截图答案里的来源列表。期望：回答引用了真实来源，带可点的链接，不是空洞回答。keyed 和 dogfooding 路径做这一步；keyless 路径的实例没有模型，跳过。
- **留证据。** 脚本输出存成 `provider-drive.log`。会话那一步存截图。

## Gotchas

- 直驱走的是 provider 层，不经过 `dsh-tool-web` 的工具层。工具层的入参（`queries` 数组）和结果形状（`sources` 数组，每条含 `url`、`title`、`snippet`）由 `dsh-tool-web` 定义，插件只提供 provider。断言工具形状要连模型一起验，keyless 路径验不了。
- 结果非空不等于通过。只有兜底信源应答也算失败。
- 中文查询要核中文信源，不止核条数。上一轮实测里中文查询返回 10 条，其中 5 到 6 条是中文站点。
- 英文查询用 `site:` 前缀，官方文档才会靠前。不用 `site:` 的话官方文档不一定在前三条。
- 质量模式默认会抓前 5 条做证据增强，一个后端的调用预算会被击穿。直驱时关掉 enrichment。
- 差分场景（重构前后对比）不在本技能的范围内。
