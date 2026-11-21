import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { XClient } from '../lib/tools/x/client.js';
import { GraphQLOperation } from '../lib/tools/x/graphql.js';
import { setSender } from '../lib/tools/x/http.js';
import { searchTweets } from '../lib/tools/x/search.js';
import { registerXTool } from '../lib/tools/x/index.js';
import { transaction } from '../lib/tools/x/transaction.js';
import { resolveSettings } from '../lib/settings.js';

const FIXTURE = readFileSync(fileURLToPath(new URL('./fixtures/x-search-timeline.json', import.meta.url)), 'utf8');
const COOKIE = 'auth_token=abc; ct0=xyz; lang=zh-cn';

function jsonResponse(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function withSender(impl, fn) {
  const restore = setSender(impl);
  try {
    return await fn();
  } finally {
    restore();
  }
}

test('search maps fixture tweets to items with text, author, created_at and stats', async () => {
  const client = new XClient({ cookie: COOKIE, timeoutMs: 1_000 });
  await client.init();
  const result = await withSender(async () => jsonResponse(FIXTURE), () => searchTweets(client, { query: 'ai', sort: 'latest' }));
  assert.equal(result.query, 'ai');
  assert.equal(result.results.length, 2);
  assert.equal(result.cursor, 'CURSOR-NEXT');
  const [first, second] = result.results;
  assert.equal(first.id, '111');
  assert.equal(first.text, 'hello from alice');
  assert.deepEqual(first.author, { id: 'u-alice', name: 'Alice', url: 'https://x.com/alice' });
  assert.equal(first.created_at, '2026-11-20T12:00:00.000Z');
  assert.equal(first.stats.likes, 42);
  assert.equal(first.stats.views, 1234);
  assert.equal(second.id, '222');
  assert.equal(second.kind, 'image');
  assert.equal(second.media[0].url, 'https://pbs.twimg.com/media/m1.jpg');
  assert.equal(second.author.name, 'Bob');
});

test('an empty cookie fails explicitly before any request', async () => {
  const client = new XClient({ cookie: '' });
  await assert.rejects(() => client.init(), (error) => error.code === 'X_COOKIE_MISSING');
});

test('auth_token without ct0 fails explicitly', async () => {
  const client = new XClient({ cookie: 'auth_token=abc' });
  await assert.rejects(() => client.init(), (error) => error.code === 'X_COOKIE_INVALID');
});

test('a moved endpoint reports the upstream-changed hint, not a silent failure', async () => {
  const client = new XClient({ cookie: COOKIE, timeoutMs: 1_000 });
  await client.init();
  await assert.rejects(
    () => withSender(async () => new Response('<html>not found</html>', { status: 404 }), () => searchTweets(client, { query: 'ai' })),
    (error) => error.code === 'X_UPSTREAM_CHANGED' && error.message.includes('X 上游已变，等待移植更新'),
  );
});

test('GraphQL errors on a 200 response surface as upstream-changed', async () => {
  const client = new XClient({ cookie: COOKIE, timeoutMs: 1_000 });
  await client.init();
  await assert.rejects(
    () => withSender(async () => jsonResponse({ errors: [{ code: 999, message: 'bad operation' }] }), () => searchTweets(client, { query: 'ai' })),
    (error) => error.code === 'X_UPSTREAM_CHANGED',
  );
});

test('auth GraphQL errors map to a cookie error', async () => {
  const client = new XClient({ cookie: COOKIE, timeoutMs: 1_000 });
  await client.init();
  await assert.rejects(
    () => withSender(async () => jsonResponse({ errors: [{ code: 32, message: 'Could not authenticate you' }] }), () => searchTweets(client, { query: 'ai' })),
    (error) => error.code === 'X_COOKIE_INVALID',
  );
});

function captureTool() {
  const definitions = [];
  const ctx = { tools: { register(definition) { definitions.push(definition); } } };
  return { definitions, ctx };
}

test('the tool stays off by default and defaults to the X_COOKIE reference', () => {
  const settings = resolveSettings();
  assert.equal(settings.xTools.enabled, false);
  assert.equal(settings.xTools.cookieRef, 'X_COOKIE');
});

test('a disabled tool rejects with WEB_PROVIDER_UNAVAILABLE before any request', async () => {
  const { definitions, ctx } = captureTool();
  registerXTool(ctx, { settings: () => resolveSettings(), resolveKey: async () => COOKIE });
  const tool = definitions.find((definition) => definition.name === 'x_search');
  await assert.rejects(() => tool.execute({ query: 'ai' }, { signal: undefined }), (error) => error.code === 'WEB_PROVIDER_UNAVAILABLE');
});

test('an enabled tool without a cookie rejects with WEB_PROVIDER_UNAVAILABLE', async () => {
  const { definitions, ctx } = captureTool();
  const settings = { requestTimeoutMs: 1_000, xTools: { enabled: true, cookieRef: 'X_COOKIE' } };
  registerXTool(ctx, { settings: () => settings, resolveKey: async () => undefined });
  const tool = definitions.find((definition) => definition.name === 'x_search');
  await assert.rejects(() => tool.execute({ query: 'ai' }, { signal: undefined }), (error) => error.code === 'WEB_PROVIDER_UNAVAILABLE');
});

test('an enabled tool with a cookie returns a JSON-parseable tweet list', async () => {
  const { definitions, ctx } = captureTool();
  const settings = { requestTimeoutMs: 1_000, xTools: { enabled: true, cookieRef: 'X_COOKIE' } };
  registerXTool(ctx, { settings: () => settings, resolveKey: async () => COOKIE });
  const tool = definitions.find((definition) => definition.name === 'x_search');
  const value = await withSender(async () => jsonResponse(FIXTURE), () => tool.execute({ query: 'ai framework' }, { signal: undefined }));
  const parsed = JSON.parse(JSON.stringify(value));
  assert.equal(parsed.query, 'ai framework');
  assert.equal(parsed.results.length, 2);
  assert.equal(typeof parsed.results[0].text, 'string');
  assert.equal(typeof parsed.results[0].author, 'object');
  assert.equal(typeof parsed.results[0].created_at, 'string');
  assert.equal(typeof parsed.results[0].stats, 'object');
});

test('the search module exposes only the read-only search entry points', async () => {
  const searchModule = await import('../lib/tools/x/search.js');
  assert.deepEqual(Object.keys(searchModule).sort(), ['searchTweets', 'searchWork']);
});

test('only SearchTimeline is in the trimmed registry; other operations report upstream-changed', () => {
  assert.ok(new GraphQLOperation('SearchTimeline').url().includes('/i/api/graphql/'));
  assert.throws(() => new GraphQLOperation('CreateTweet'), (error) => error.code === 'X_UPSTREAM_CHANGED');
});

test('XCTID generation is deterministic for fixed time and random byte', () => {
  const generator = transaction();
  const first = generator.generate('POST', '/i/api/graphql/x/SearchTimeline', 1000, 7);
  const second = generator.generate('POST', '/i/api/graphql/x/SearchTimeline', 1000, 7);
  assert.equal(first, second);
  assert.match(first, /^[A-Za-z0-9+/]+$/);
  assert.notEqual(first, generator.generate('POST', '/i/api/graphql/x/SearchTimeline', 1000, 8));
});
