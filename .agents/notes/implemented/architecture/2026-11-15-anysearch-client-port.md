# Agent Note: Port the AnySearch DSH client into the multi-backend plugin

Status: implemented

## Problem

The multi-backend plugin's AnySearch adapter worked, but it lacked the vendor client's defensive response validation, versioned traffic identifier, rich error codes, and retry diagnostics. The reference implementation `anysearch-team/anysearch-dsh` (MIT) showed a cleaner provider seam, and the user asked to port its source into this project while keeping the multi-backend router.

## Decision

Port the reference's `AnySearchClient` core into `lib/providers/anysearchClient.js` and make `lib/providers/anysearch.js` use it for search and Extract fetch. The port keeps the reference's `x-anysearch-client` / `user-agent` identifier, credential/placeholder checks, structured `AnySearchClientError`, response validation, and AnySearch business error codes. Also port its three optional model-facing tools (`anysearch_capabilities`, `anysearch_search`, `anysearch_batch_search`) into `lib/tools/` under ADR-0004. ADR-0005 and ADR-0006 later added the optional Tavily tools (`tavily_search`, `tavily_extract`) and AIHOT tools (`aihot_latest`, `aihot_hot`). The multi-backend router and provider ids stay unchanged; ADR-0007 later made Keenable first and changed the default and clean fetch orders.

## Alternatives considered

- **Replace this plugin with `@anysearch/anysearch-dsh`**: rejected because it only supports AnySearch; in the 14-URL probe it succeeded on 8/14, failing PDF, Zhihu, gov.cn, and other pages that the current HTTP/Keenable/Tavily/Firecrawl fallbacks cover.
- **Make AnySearch Extract the default first fetch provider**: rejected after measurement; clean order with AnySearch first averaged 3,949 ms versus 994 ms for the existing clean order, and long pages such as Sohu and Zhihu waited 12–14 seconds before falling back.
- **Leave the reference's advanced tools out to keep the plugin provider-only**: considered, but rejected because the user explicitly asked to port them and the reference implementation already defines the tool contracts. ADR-0004 records the AnySearch exception to ADR-0001; ADR-0005 and ADR-0006 record the later Tavily and AIHOT exceptions.

## Consequences

- AnySearch requests now carry `dsh/0.7.2` as the client identifier, use the vendor's response validation, and map `extract_*` error codes onto the seam's `WEB_*` vocabulary.
- The generic tool layer remains `dsh-tool-web`; model-facing additions now comprise the three AnySearch-specific tools, the two Tavily tools, and the two AIHOT tools.
- AnySearch-first fetch is not the default; the current clean order is `keenable → anysearch → exa → http → tavily → firecrawl`, still a quality/coverage trade-off.
- `anysearchMaxRenderedContentChars` (default 12000) caps rendered content for the advanced tools.
