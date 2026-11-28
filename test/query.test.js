import test from 'node:test';
import assert from 'node:assert/strict';

import { parseQuerySyntax } from '../lib/query.js';
import { TavilyProvider } from '../lib/providers/tavily.js';
import { FirecrawlProvider } from '../lib/providers/firecrawl.js';
import { withFetch } from './helpers/withFetch.js';

test('parses site, lang, after and before operators', () => {
  const parsed = parseQuerySyntax('DeepSeek site:github.com lang:zh after:2025-01-01 before:2026');
  assert.equal(parsed.site, 'github.com');
  assert.equal(parsed.lang, 'zh');
  assert.equal(parsed.after, '2025-01-01');
  assert.equal(parsed.before, '2026');
});

test('drops a site value that is not a domain', () => {
  assert.equal(parseQuerySyntax('中文 site:a.com"||host=="b.com').site, undefined);
  assert.equal(parseQuerySyntax('中文 site:zhihu.com"').site, undefined);
});

test('drops after and before values that are not real calendar days', () => {
  assert.equal(parseQuerySyntax('x after:2024-13-45').after, undefined);
  assert.equal(parseQuerySyntax('x before:2026-02-30').before, undefined);
  assert.equal(parseQuerySyntax('x after:2024-13').after, undefined);
  assert.equal(parseQuerySyntax('x before:2023-02-29').before, undefined);
  assert.equal(parseQuerySyntax('x after:2024-02-29').after, '2024-02-29');
});

function providerSettings() {
  return {
    requestTimeoutMs: 5_000,
    maxSnippetChars: 300,
    languageRouting: true,
    tavily: { enabled: true, apiKeyEnv: 'TAVILY_API_KEY', baseURL: 'https://api.tavily.example' },
    firecrawl: { enabled: true, apiKeyEnv: 'FIRECRAWL_API_KEY', baseURL: 'https://api.firecrawl.example' },
  };
}

test('illegal date operators never reach the Tavily or Firecrawl request body', async () => {
  const bodies = [];
  await withFetch(
    (url, init) => {
      bodies.push(JSON.parse(init.body));
      const payload = url.includes('/v2/search') ? { success: true, data: {} } : { results: [] };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    async () => {
      const query = 'quiet topic after:2023-13-45 before:2023-02-30';
      await new TavilyProvider({ settings: providerSettings, resolveKey: async () => 'k' }).search({
        query,
        maxResults: 5,
      });
      await new FirecrawlProvider({ settings: providerSettings, resolveKey: async () => 'k' }).search({
        query,
        maxResults: 5,
      });
    },
  );
  const [tavilyBody, firecrawlBody] = bodies;
  assert.equal(tavilyBody.start_date, undefined);
  assert.equal(tavilyBody.end_date, undefined);
  assert.equal(firecrawlBody.tbs, undefined);
});
