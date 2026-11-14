import test from 'node:test';
import assert from 'node:assert/strict';

import { clampCount, jsonHeaders, requireKey, textResult } from '../lib/providers/shared.js';
import { AnySearchProvider } from '../lib/providers/anysearch.js';
import { TavilyProvider } from '../lib/providers/tavily.js';
import { FirecrawlProvider } from '../lib/providers/firecrawl.js';

test('clampCount keeps valid counts, bounds them, and falls back for invalid input', () => {
  assert.equal(clampCount(5, 10, 20), 5);
  assert.equal(clampCount(50, 10, 20), 20);
  assert.equal(clampCount('7', 10, 20), 7);
  assert.equal(clampCount(0, 10, 20), 10);
  assert.equal(clampCount(undefined, 10, 20), 10);
});

test('jsonHeaders adds a bearer token only when a key exists', () => {
  assert.deepEqual(jsonHeaders('secret'), {
    authorization: 'Bearer secret',
    'content-type': 'application/json',
    'user-agent': 'dsh-web-search-router/0.1.0',
  });
  assert.deepEqual(jsonHeaders(undefined), {
    'content-type': 'application/json',
    'user-agent': 'dsh-web-search-router/0.1.0',
  });
  assert.equal(jsonHeaders('secret', { 'x-request-timestamp': '1' })['x-request-timestamp'], '1');
});

test('textResult truncates content at maxChars and reports it', () => {
  assert.deepEqual(textResult('https://example.com/', 'abcdef', 4), {
    url: 'https://example.com/',
    statusCode: 200,
    body: { kind: 'text', content: 'abcd' },
    truncated: true,
  });
  assert.deepEqual(textResult('https://example.com/', 'abc', 4), {
    url: 'https://example.com/',
    statusCode: 200,
    body: { kind: 'text', content: 'abc' },
    truncated: false,
  });
});

test('requireKey returns the key and throws the credential-missing code', () => {
  assert.equal(requireKey('secret', 'Tavily API key'), 'secret');
  assert.throws(
    () => requireKey(undefined, 'Tavily API key'),
    (error) =>
      error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING' &&
      error.message === 'Tavily API key is not configured',
  );
});

test('Tavily fetch truncates extracted content at maxFetchChars', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ results: [{ url: 'https://example.com/', raw_content: 'x'.repeat(50) }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  try {
    const provider = new TavilyProvider({
      settings: () => ({
        requestTimeoutMs: 5_000,
        maxFetchChars: 10,
        maxSnippetChars: 800,
        tavily: {
          enabled: true,
          apiKeyEnv: 'TAVILY_API_KEY',
          baseURL: 'https://api.tavily.com',
          includeAnswer: false,
        },
      }),
      resolveKey: async () => 'key',
    });
    const result = await provider.fetch({ url: 'https://example.com/' });
    assert.equal(result.body.content, 'x'.repeat(10));
    assert.equal(result.truncated, true);
  } finally {
    globalThis.fetch = original;
  }
});

test('AnySearch fetch truncates extracted content at maxFetchChars', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: 0, data: { content: 'y'.repeat(50) } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  try {
    const provider = new AnySearchProvider({
      settings: () => ({
        requestTimeoutMs: 5_000,
        maxFetchChars: 10,
        anysearch: {
          enabled: true,
          apiKeyEnv: 'ANYSEARCH_API_KEY',
          baseURL: 'https://api.anysearch.com',
        },
      }),
      resolveKey: async () => undefined,
    });
    const result = await provider.fetch({ url: 'https://example.com/' });
    assert.equal(result.body.content, 'y'.repeat(10));
    assert.equal(result.truncated, true);
  } finally {
    globalThis.fetch = original;
  }
});

test('Firecrawl fetch keeps the page status code and truncates content', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: {
          markdown: 'z'.repeat(50),
          metadata: { url: 'https://example.com/final', statusCode: 404 },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  try {
    const provider = new FirecrawlProvider({
      settings: () => ({
        requestTimeoutMs: 5_000,
        maxFetchChars: 10,
        firecrawl: {
          enabled: true,
          apiKeyEnv: 'FIRECRAWL_API_KEY',
          baseURL: 'https://api.firecrawl.dev',
        },
      }),
      resolveKey: async () => 'key',
    });
    const result = await provider.fetch({ url: 'https://example.com/' });
    assert.equal(result.url, 'https://example.com/final');
    assert.equal(result.statusCode, 404);
    assert.equal(result.body.content, 'z'.repeat(10));
    assert.equal(result.truncated, true);
  } finally {
    globalThis.fetch = original;
  }
});
