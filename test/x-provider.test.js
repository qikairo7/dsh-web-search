import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { XProvider, X_PROVIDER_ID, mapXTweetSearch } from '../lib/providers/x.js';
import { providerEntry } from '../lib/catalog.js';
import { classifyFailure, isRecoverable } from '../lib/errors.js';
import { resolveSettings } from '../lib/settings.js';
import { setSender } from '../lib/tools/x/http.js';
import { verifyXTool } from '../lib/tools/x/verify.js';

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

function xSettings(over = {}) {
  return {
    requestTimeoutMs: 1_000,
    maxSnippetChars: 4_000,
    xTools: { enabled: true, cookieRef: 'X_COOKIE', ...over },
  };
}

function providerFor(settings, resolveKey = async () => COOKIE) {
  return new XProvider({ settings: () => settings, resolveKey });
}

async function searchError(impl, settings = xSettings()) {
  try {
    await withSender(impl, () => providerFor(settings).search({ query: 'ai' }, undefined));
  } catch (error) {
    return error;
  }
  throw new Error('expected search to reject');
}

test('catalog registers X as a search-only backend behind the xTools settings', () => {
  const entry = providerEntry(X_PROVIDER_ID);
  assert.equal(X_PROVIDER_ID, 'x');
  assert.deepEqual(entry.capabilities, ['search']);
  assert.equal(entry.settingsKey, 'xTools');
});

test('mapXTweetSearch maps tweets to standard sources with author+excerpt title and full-text snippet', () => {
  const result = mapXTweetSearch(JSON.parse(FIXTURE), 4_000);
  assert.equal(result.truncated, false);
  assert.equal(result.sources.length, 2);
  const [first, second] = result.sources;
  assert.equal(first.url, 'https://x.com/alice/status/111');
  assert.equal(first.title, 'Alice: hello from alice');
  assert.equal(first.snippet, 'hello from alice');
  assert.equal(first.publishedAt, '2026-11-20T12:00:00.000Z');
  assert.equal(second.url, 'https://x.com/bob/status/222');
  assert.equal(second.title, 'Bob: a photo tweet');
  assert.equal(second.snippet, 'a photo tweet');
});

test('mapXTweetSearch bounds the snippet without cutting the title author', () => {
  const response = JSON.parse(FIXTURE);
  const long = 'word '.repeat(100).trim();
  response.data.search_by_raw_query.search_timeline.timeline.instructions[0].entries[0]
    .content.itemContent.tweet_results.result.legacy.full_text = long;
  const result = mapXTweetSearch(response, 20);
  assert.equal(result.sources[0].snippet.length, 20);
  assert.equal(result.sources[0].snippet, long.slice(0, 20));
  assert.match(result.sources[0].title, /^Alice: /u);
});

test('mapXTweetSearch rejects a non-object payload as an invalid response', () => {
  assert.throws(() => mapXTweetSearch('not-json'), (error) => error.code === 'WEB_INVALID_RESPONSE');
});

test('the backend is off by default and reports unavailable', async () => {
  const settings = resolveSettings();
  const provider = providerFor(settings);
  assert.equal(settings.xTools.enabled, false);
  assert.equal(provider.available(), false);
  assert.equal(await provider.ready(), false);
});

test('a disabled backend refuses a direct search with WEB_PROVIDER_UNAVAILABLE', async () => {
  const provider = providerFor(xSettings({ enabled: false }));
  await assert.rejects(
    () => provider.search({ query: 'ai' }, undefined),
    (error) => error.code === 'WEB_PROVIDER_UNAVAILABLE',
  );
});

test('an empty cookie reference makes the backend unavailable', async () => {
  const provider = providerFor(xSettings({ cookieRef: '' }));
  assert.equal(provider.available(), false);
  assert.equal(await provider.ready(), false);
  await assert.rejects(
    () => provider.search({ query: 'ai' }, undefined),
    (error) => error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING',
  );
});

test('a stored cookie reference is ready only when the credential resolves', async () => {
  const missing = providerFor(xSettings(), async () => undefined);
  assert.equal(missing.available(), true);
  assert.equal(await missing.ready(), false);
  await assert.rejects(
    () => missing.search({ query: 'ai' }, undefined),
    (error) => error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING',
  );
  assert.equal(await providerFor(xSettings()).ready(), true);
});

test('search returns standard sources through the backend interface', async () => {
  let seen;
  const result = await withSender(
    async (_prepared, options) => {
      seen = options;
      return jsonResponse(FIXTURE);
    },
    () => providerFor(xSettings()).search({ query: 'ai framework', maxResults: 10 }, new AbortController().signal),
  );
  assert.equal(result.sources.length, 2);
  assert.equal(result.truncated, false);
  assert.equal(result.sources[0].url, 'https://x.com/alice/status/111');
  assert.equal(seen.timeoutMs, 1_000);
});

test('cookie shape failures surface as a recoverable missing credential, not a bare error', async () => {
  const cases = [
    ['empty cookie', ''],
    ['auth_token without ct0', 'auth_token=abc'],
    ['malformed JSON cookie array', '[{"name":"auth_token"'],
  ];
  for (const [name, cookie] of cases) {
    await withSender(async () => jsonResponse(FIXTURE), async () => {
      await assert.rejects(
        () => providerFor(xSettings(), async () => cookie).search({ query: 'ai' }, undefined),
        (error) => error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING' && isRecoverable(error) === true,
        name,
      );
    });
  }
});

test('upstream failures map onto recoverable WEB_* codes so fallback continues', async () => {
  const cases = [
    { name: 'HTTP 401', impl: async () => jsonResponse({}, 401), code: 'WEB_PROVIDER_CREDENTIAL_MISSING', failureClass: 'auth' },
    { name: 'HTTP 403', impl: async () => jsonResponse({}, 403), code: 'WEB_PROVIDER_CREDENTIAL_MISSING', failureClass: 'auth' },
    { name: 'HTTP 429', impl: async () => jsonResponse({}, 429), code: 'WEB_RATE_LIMITED', failureClass: 'quota' },
    { name: 'HTTP 404 moved endpoint', impl: async () => new Response('<html>not found</html>', { status: 404 }), code: 'WEB_INVALID_RESPONSE', failureClass: 'invalid-response' },
    { name: 'GraphQL auth code 32', impl: async () => jsonResponse({ errors: [{ code: 32, message: 'Could not authenticate you' }] }), code: 'WEB_PROVIDER_CREDENTIAL_MISSING', failureClass: 'auth' },
    { name: 'GraphQL risk code 88', impl: async () => jsonResponse({ errors: [{ code: 88, message: 'Rate limit exceeded' }] }), code: 'WEB_RATE_LIMITED', failureClass: 'quota' },
    { name: 'GraphQL unknown error', impl: async () => jsonResponse({ errors: [{ code: 999, message: 'bad operation' }] }), code: 'WEB_INVALID_RESPONSE', failureClass: 'invalid-response' },
    { name: 'network failure', impl: async () => { throw new Error('socket hang up'); }, code: 'WEB_PROVIDER_ERROR', failureClass: 'unknown' },
  ];
  for (const entry of cases) {
    const error = await searchError(entry.impl);
    assert.equal(error.code, entry.code, entry.name);
    assert.equal(classifyFailure(error), entry.failureClass, entry.name);
    assert.equal(isRecoverable(error), true, entry.name);
  }
});

test('an already-cancelled signal keeps the request off the wire', async () => {
  const controller = new AbortController();
  controller.abort();
  let sent = 0;
  await withSender(
    async (_prepared, options) => {
      if (options.signal?.aborted === true) throw options.signal.reason;
      sent += 1;
      return jsonResponse(FIXTURE);
    },
    async () => {
      await assert.rejects(
        () => providerFor(xSettings()).search({ query: 'ai' }, controller.signal),
        (error) => error.code === 'WEB_ABORTED' && isRecoverable(error) === false,
      );
    },
  );
  assert.equal(sent, 0);
});

test('the HTTP timeout never exceeds the tool budget', async () => {
  let seen;
  await withSender(
    async (_prepared, options) => {
      seen = options;
      return jsonResponse(FIXTURE);
    },
    () => providerFor(xSettings({ requestTimeoutMs: 120_000 })).search({ query: 'ai' }, undefined),
  );
  assert.ok(seen.timeoutMs <= 30_000, `timeoutMs ${seen.timeoutMs} exceeds the tool budget`);
});

test('verifyXTool rejects a disabled backend before any request', async () => {
  const settings = () => ({ requestTimeoutMs: 1_000, xTools: { enabled: false, cookieRef: 'X_COOKIE' } });
  await assert.rejects(() => verifyXTool(settings, async () => COOKIE), (error) => error.code === 'WEB_PROVIDER_UNAVAILABLE');
});

test('verifyXTool rejects an enabled backend without a stored cookie', async () => {
  const settings = () => ({ requestTimeoutMs: 1_000, xTools: { enabled: true, cookieRef: 'X_COOKIE' } });
  await assert.rejects(() => verifyXTool(settings, async () => undefined), (error) => error.code === 'WEB_PROVIDER_UNAVAILABLE');
});

test('verifyXTool runs one minimal search and reports latency with the stored cookie', async () => {
  const settings = () => ({ requestTimeoutMs: 1_000, xTools: { enabled: true, cookieRef: 'X_COOKIE' } });
  const result = await withSender(async () => jsonResponse(FIXTURE), () => verifyXTool(settings, async () => COOKIE));
  assert.equal(result.ok, true);
  assert.equal(result.capability, 'search');
  assert.equal(result.count, 2);
  assert.ok(Number.isFinite(result.latencyMs));
});
