/** Register the optional provider-specific model-facing tools. */

import { webError } from '../errors.js';
import { registerCapabilitiesTool } from './anysearch-capabilities.js';
import { registerAdvancedSearchTool } from './anysearch-search.js';
import { registerBatchSearchTool } from './anysearch-batch.js';
import { registerTavilySearchTool } from './tavily-search.js';
import { registerTavilyExtractTool } from './tavily-extract.js';
import { registerAihotTools } from './aihot.js';

/**
 * Register the optional provider-specific tools on the Harness tool registry.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{
 *   getClient: () => import('../providers/anysearchClient.js').AnySearchClient,
 *   getMaxRenderedContentChars: () => number,
 *   isEnabled?: () => boolean,
 * }} options
 */
export function registerAnySearchTools(ctx, options) {
  if (ctx.tools === undefined || typeof ctx.tools.register !== 'function') return;
  const assertEnabled = () => {
    if (typeof options.isEnabled === 'function' && !options.isEnabled()) {
      throw webError('AnySearch provider is disabled', 'WEB_PROVIDER_UNAVAILABLE');
    }
  };
  const client = {
    search: (...args) => {
      assertEnabled();
      return options.getClient().search(...args);
    },
    listDomains: (...args) => {
      assertEnabled();
      return options.getClient().listDomains(...args);
    },
    getSubDomains: (...args) => {
      assertEnabled();
      return options.getClient().getSubDomains(...args);
    },
  };
  registerCapabilitiesTool(ctx, client);
  registerAdvancedSearchTool(ctx, client, options.getMaxRenderedContentChars);
  if (typeof options.isBatchEnabled !== 'function' || options.isBatchEnabled()) {
    registerBatchSearchTool(ctx, client, options.getMaxRenderedContentChars);
  }
}

/** Register Tavily-specific advanced tools when the tool registry is available. */
export function registerTavilyTools(ctx, provider) {
  if (ctx.tools === undefined || typeof ctx.tools.register !== 'function') return;
  registerTavilySearchTool(ctx, provider);
  registerTavilyExtractTool(ctx, provider);
}

/** Register AIHOT's free curated-news tools. */
export function registerAihotToolset(ctx, provider) {
  if (ctx.tools === undefined || typeof ctx.tools.register !== 'function') return;
  registerAihotTools(ctx, provider);
}
