/** Model-facing Tavily batch extract tool. */

import { defineTool } from '@deepseek-ai/dsh-tools';
import { assertToolProvider } from './guards.js';
import { UNTRUSTED_CONTENT_NOTICE } from './anysearch-format.js';

export const TAVILY_EXTRACT_TOOL_NAME = 'tavily_extract';

const resultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    url: { type: 'string', required: true },
    title: { type: 'string' },
    publishedDate: { type: 'string' },
    content: { type: 'string', required: true },
    truncated: { type: 'boolean', required: true },
  },
};

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    results: { type: 'array', required: true, items: resultSchema },
    failed: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string', required: true },
          error: { type: 'string', required: true },
        },
      },
    },
  },
};

const MAX_CONTENT_CHARS = 12_000;

function renderExtract(value) {
  const lines = [`Tavily extracted ${value.results.length} URL(s); ${value.failed.length} failed.`];
  let remaining = MAX_CONTENT_CHARS;
  let noticed = false;
  for (const result of value.results) {
    lines.push(`## ${result.title ?? result.url}\n${result.url}`);
    if (remaining > 0) {
      const shown = result.content.slice(0, remaining);
      if (!noticed) {
        lines.push(UNTRUSTED_CONTENT_NOTICE);
        noticed = true;
      }
      lines.push(shown);
      remaining -= shown.length;
    }
  }
  if (value.failed.length > 0) {
    lines.push('Failed URLs:');
    for (const failure of value.failed) lines.push(`- ${failure.url}: ${failure.error}`);
  }
  return lines.join('\n\n');
}

/** Register the Tavily batch extract tool. */
export function registerTavilyExtractTool(ctx, provider) {
  ctx.tools.register(defineTool({
    name: TAVILY_EXTRACT_TOOL_NAME,
    timeoutMs: 60_000,
    description: 'Extract clean Markdown from one to twenty URLs through Tavily Extract, with per-URL failures kept separate.',
    parameters: {
      urls: { type: 'array', required: true, items: { type: 'string' }, description: 'One to twenty absolute HTTP(S) URLs.' },
      extractDepth: { type: 'string', enum: ['basic', 'advanced'], description: 'Extraction depth.' },
      format: { type: 'string', enum: ['markdown', 'text'], description: 'Output format.' },
      includeImages: { type: 'boolean', description: 'Include extracted images.' },
      includePublishedDate: { type: 'boolean', description: 'Include Tavily published-date estimate.' },
      query: { type: 'string', description: 'Rerank extracted chunks against this intent.' },
      chunksPerSource: { type: 'integer', description: 'Relevant chunks per source, 1 to 5.' },
    },
    output: {
      schema: outputSchema,
      render: (_args, value) => [{ type: 'text', text: renderExtract(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      await assertToolProvider(provider);
      const urls = Array.isArray(args.urls) ? args.urls.map((url) => url.trim()).filter((url) => url.length > 0) : [];
      if (urls.length < 1 || urls.length > 20) throw new Error('urls must contain 1 to 20 non-empty URLs');
      return provider.extractMany(urls, args, exec.signal);
    },
    presentCall: (args) => ({ card: 'generic', title: `Tavily extract (${args.urls?.length ?? 0})`, kind: 'fetch', rawInput: (args.urls ?? []).join('\n') }),
  }));
}
