/** Model-facing Tavily advanced search tool. */

import { defineTool } from '@deepseek-ai/dsh-tools';
import { assertToolProvider } from './guards.js';
import { UNTRUSTED_CONTENT_NOTICE } from './anysearch-format.js';

export const TAVILY_SEARCH_TOOL_NAME = 'tavily_search';

const sourceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    url: { type: 'string', required: true },
    title: { type: 'string' },
    snippet: { type: 'string' },
    summary: { type: 'string' },
    publishedAt: { type: 'string' },
  },
};

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    content: { type: 'string' },
    sources: { type: 'array', required: true, items: sourceSchema },
    truncated: { type: 'boolean', required: true },
  },
};

function renderSearch(value) {
  const lines = [`Tavily returned ${value.sources.length} result(s).`];
  lines.push(UNTRUSTED_CONTENT_NOTICE);
  if (value.content) {
    lines.push(`Answer: ${value.content}`);
  }
  for (const source of value.sources) {
    lines.push(`- [${source.title ?? source.url}](${source.url})${source.summary ? ` — ${source.summary}` : ''}`);
  }
  lines.push('Cite relevant source URLs as markdown links in the answer.');
  return lines.join('\n\n');
}

/** Register the Tavily advanced search tool. */
export function registerTavilySearchTool(ctx, provider) {
  ctx.tools.register(defineTool({
    name: TAVILY_SEARCH_TOOL_NAME,
    timeoutMs: 60_000,
    description: 'Run a Tavily search with advanced filters: search depth, topic, time range, domain include/exclude, generated answer, and raw content.',
    parameters: {
      query: { type: 'string', required: true, description: 'Search query.' },
      maxResults: { type: 'integer', description: 'Result count from 1 to 20.' },
      searchDepth: { type: 'string', enum: ['basic', 'advanced', 'fast', 'ultra-fast'], description: 'Tavily search depth.' },
      topic: { type: 'string', enum: ['general', 'news', 'finance'], description: 'Search topic.' },
      timeRange: { type: 'string', enum: ['day', 'week', 'month', 'year'], description: 'Publish-time window.' },
      startDate: { type: 'string', description: 'Start date in YYYY-MM-DD.' },
      endDate: { type: 'string', description: 'End date in YYYY-MM-DD.' },
      includeDomains: { type: 'array', items: { type: 'string' }, description: 'Domains to include.' },
      excludeDomains: { type: 'array', items: { type: 'string' }, description: 'Domains to exclude.' },
      includeAnswer: { type: 'boolean', description: 'Include Tavily generated answer.' },
      includeRawContent: { type: 'boolean', description: 'Include raw page content in snippets.' },
      country: { type: 'string', description: 'Country hint for news searches.' },
      chunksPerSource: { type: 'integer', description: 'Relevant chunks per source, 1 to 3.' },
      filterByPublishedDate: { type: 'boolean', description: 'Drop results without a detected publish date.' },
    },
    output: {
      schema: outputSchema,
      render: (_args, value) => [{ type: 'text', text: renderSearch(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      await assertToolProvider(provider);
      return provider.searchAdvanced(args, exec.signal);
    },
    presentCall: (args) => ({ card: 'generic', title: `Tavily: ${args.query}`, kind: 'search', rawInput: args.query }),
  }));
}
