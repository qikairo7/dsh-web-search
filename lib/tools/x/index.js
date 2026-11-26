/** Model-facing X (Twitter) read-only tweet search tool.
 * Ported from catbus src/platforms/x@163424c67471d323ac3b1cb68e2b35a3427398ce (MIT).
 * Read-only whitelist: only item search is exposed. Write paths (publish/like/follow/msg) are not ported.
 */

import { defineTool } from '@deepseek-ai/dsh-tools';
import { webError } from '../../errors.js';
import { UNTRUSTED_CONTENT_NOTICE } from '../anysearch-format.js';
import { XClient } from './client.js';
import { searchTweets } from './search.js';

/** Stable model-facing name for the X tweet search tool. */
export const X_SEARCH_TOOL_NAME = 'x_search';

const TOOL_TIMEOUT_MS = 30_000;

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', required: true },
    results: { type: 'array', required: true, items: { type: 'json' } },
    cursor: { type: 'string' },
  },
};

function renderValue(value) {
  return `${UNTRUSTED_CONTENT_NOTICE}\n\n${JSON.stringify(value, null, 2)}`;
}

/** Register the X search tool on the Harness tool registry. */
export function registerXTool(ctx, { settings, resolveKey }) {
  if (ctx.tools === undefined || typeof ctx.tools.register !== 'function') return;
  ctx.tools.register(defineTool({
    name: X_SEARCH_TOOL_NAME,
    timeoutMs: TOOL_TIMEOUT_MS,
    description: 'Search X (Twitter) public tweets through the signed-in web endpoint (cookie auth). Read-only, disabled by default; requires xToolsEnabled and a stored X cookie.',
    parameters: {
      query: { type: 'string', required: true, description: 'Search keywords or an X search query.' },
      sort: { type: 'string', enum: ['general', 'latest'], description: 'general = Top, latest = Latest.' },
      count: { type: 'integer', description: 'Tweet count per page (1-100, default 20).' },
      cursor: { type: 'string', description: 'Opaque next-page cursor from a previous call.' },
    },
    output: {
      schema: outputSchema,
      render: (_args, value) => [{ type: 'text', text: renderValue(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const current = settings();
      const config = current.xTools ?? {};
      if (config.enabled !== true) {
        throw webError('X 搜索未启用（xToolsEnabled=false）：请在配置里开启后再用', 'WEB_PROVIDER_UNAVAILABLE');
      }
      const reference = typeof config.cookieRef === 'string' ? config.cookieRef.trim() : '';
      const cookie = reference.length > 0 ? await resolveKey(reference) : undefined;
      if (cookie === undefined) {
        throw webError(`未配置 X cookie 凭据（${reference || 'X_COOKIE'}）：请把浏览器导出的 x.com cookie 存入 DSH 凭据库`, 'WEB_PROVIDER_UNAVAILABLE');
      }
      const count = args.count === undefined ? 20 : Math.min(Math.max(args.count, 1), 100);
      const timeoutMs = Math.min(Number(current.requestTimeoutMs) || TOOL_TIMEOUT_MS, TOOL_TIMEOUT_MS);
      const client = new XClient({ cookie, timeoutMs });
      await client.init();
      const result = await searchTweets(client, {
        query: args.query,
        sort: args.sort,
        count,
        cursor: args.cursor,
        signal: exec.signal,
      });
      return {
        query: result.query,
        results: result.results,
        ...(result.cursor === null ? {} : { cursor: result.cursor }),
      };
    },
    presentCall: (args) => ({ card: 'generic', title: `X 搜索: ${args.query}`, kind: 'search', rawInput: JSON.stringify(args) }),
  }));
}
