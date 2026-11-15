import test from 'node:test';
import assert from 'node:assert/strict';

import { registerAnySearchTools, registerTavilyTools, registerAihotToolset } from '../lib/tools/index.js';
import { TavilyProvider } from '../lib/providers/tavily.js';
import { AihotProvider } from '../lib/providers/aihot.js';

function captureTools() {
  const definitions = [];
  return {
    definitions,
    ctx: { tools: { register(definition) { definitions.push(definition); } } },
  };
}

test('AnySearch tools reject a disabled provider before the client call', async () => {
  const { definitions, ctx } = captureTools();
  let called = false;
  registerAnySearchTools(ctx, {
    getClient: () => ({
      search: async () => { called = true; return {}; },
      listDomains: async () => { called = true; return {}; },
      getSubDomains: async () => { called = true; return {}; },
    }),
    getMaxRenderedContentChars: () => 1_000,
    isEnabled: () => false,
  });
  const tool = definitions.find((definition) => definition.name === 'anysearch_capabilities');
  await assert.rejects(
    () => tool.execute({}, { signal: undefined }),
    (error) => error.code === 'WEB_PROVIDER_UNAVAILABLE',
  );
  assert.equal(called, false);
});

test('Tavily tools reject a disabled provider before any request', async () => {
  const { definitions, ctx } = captureTools();
  const settings = {
    requestTimeoutMs: 1_000,
    maxSnippetChars: 100,
    maxFetchChars: 100,
    tavily: {
      enabled: false,
      apiKeyEnv: 'TAVILY_API_KEY',
      baseURL: 'https://api.tavily.com',
      includeAnswer: true,
    },
  };
  registerTavilyTools(ctx, new TavilyProvider({ settings: () => settings, resolveKey: async () => 'tvly_test' }));
  const tool = definitions.find((definition) => definition.name === 'tavily_search');
  await assert.rejects(
    () => tool.execute({ query: 'x' }, { signal: undefined }),
    (error) => error.code === 'WEB_PROVIDER_UNAVAILABLE',
  );
});

test('AIHOT tools reject a disabled provider before any request', async () => {
  const { definitions, ctx } = captureTools();
  registerAihotToolset(ctx, new AihotProvider({
    settings: () => ({
      requestTimeoutMs: 1_000,
      maxSnippetChars: 100,
      aihot: { enabled: false, baseURL: 'https://aihot.news' },
    }),
  }));
  const tool = definitions.find((definition) => definition.name === 'aihot_latest');
  await assert.rejects(
    () => tool.execute({}, { signal: undefined }),
    (error) => error.code === 'WEB_PROVIDER_UNAVAILABLE',
  );
});
