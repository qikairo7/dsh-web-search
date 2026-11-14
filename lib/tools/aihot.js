/** Model-facing AIHOT curated news tools (anonymous, free). */

import { defineTool } from '@deepseek-ai/dsh-tools';

export const AIHOT_LATEST_TOOL_NAME = 'aihot_latest';
export const AIHOT_HOT_TOOL_NAME = 'aihot_hot';

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { markdown: { type: 'string', required: true } },
};

function render(value) {
  return value.markdown;
}

/** Register AIHOT's latest-news and hot-topic tools. */
export function registerAihotTools(ctx, provider) {
  ctx.tools.register(defineTool({
    name: AIHOT_LATEST_TOOL_NAME,
    timeoutMs: 60_000,
    description: 'Read AIHOT curated AI news for today or the last week. Anonymous and free.',
    parameters: {
      window: { type: 'string', enum: ['24h', '7d'], description: 'Time window.' },
      category: { type: 'string', enum: ['ai-models', 'ai-products', 'industry', 'paper', 'tip', 'opinion'], description: 'News category.' },
      mode: { type: 'string', enum: ['selected', 'all'], description: 'Curated or all public items.' },
      limit: { type: 'integer', description: 'Item count from 1 to 30.' },
    },
    output: {
      schema: outputSchema,
      render: (_args, value) => [{ type: 'text', text: render(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const limit = args.limit === undefined ? undefined : Math.min(Math.max(args.limit, 1), 30);
      return { markdown: await provider.latest({ ...args, limit }, exec.signal) };
    },
    presentCall: (args) => ({ card: 'generic', title: `AIHOT latest: ${args.window ?? '24h'}`, kind: 'search', rawInput: JSON.stringify(args) }),
  }));

  ctx.tools.register(defineTool({
    name: AIHOT_HOT_TOOL_NAME,
    timeoutMs: 60_000,
    description: 'Read current AIHOT hot topics. Anonymous and free.',
    parameters: {},
    output: {
      schema: outputSchema,
      render: (_args, value) => [{ type: 'text', text: render(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      return { markdown: await provider.hot(exec.signal) };
    },
    presentCall: () => ({ card: 'generic', title: 'AIHOT hot topics', kind: 'search', rawInput: 'hot' }),
  }));
}
