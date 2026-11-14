import test from 'node:test';
import assert from 'node:assert/strict';

import { HttpFetchProvider } from '../lib/providers/http.js';
import { withFetch } from './helpers/withFetch.js';

function httpSettings() {
  return {
    requestTimeoutMs: 5_000,
    maxFetchChars: 10_000,
    minDirectHtmlChars: 2_048,
    http: { enabled: true },
  };
}

test('HTTP fetch returns HTML for the tool layer to convert', async () => {
  await withFetch(
    async () =>
      new Response('<!doctype html><html><body><h1>Hello</h1></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    async () => {
      const provider = new HttpFetchProvider({ settings: httpSettings });
      const result = await provider.fetch({ url: 'https://example.com/' });
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.kind, 'html');
      assert.match(result.body.content, /Hello/);
    },
  );
});

test('HTTP fetch converts GitHub HTML to cleaned text', async () => {
  const html = [
    '<!doctype html><html><body>',
    '<h1>deepseek-ai/dsh-web-search</h1>',
    '<h2>Releases</h2>',
    '<p>Latest release notes.</p>',
    '<ul><li><a href="/login">Login</a></li><li><a href="/features/discussions">Discussions</a></li></ul>',
    '<h2>About</h2>',
    '<p>Free-tier-first providers.</p>',
    '<script>window.__DATA__ = 1;</script>',
    '</body></html>',
  ].join('');
  await withFetch(
    async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    async () => {
      const provider = new HttpFetchProvider({ settings: httpSettings });
      const result = await provider.fetch({ url: 'https://github.com/deepseek-ai/dsh-web-search' });
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.kind, 'text');
      assert.doesNotMatch(result.body.content, /<html|<body|<h[1-6]/iu);
      assert.match(result.body.content, /deepseek-ai\/dsh-web-search/u);
      assert.match(result.body.content, /Free-tier-first providers\./u);
      assert.doesNotMatch(result.body.content, /^Releases$/mu);
      assert.doesNotMatch(result.body.content, /^Login$/mu);
    },
  );
});

test('HTTP fetch rejects PDF responses so the router can fall back', async () => {
  await withFetch(
    async () => new Response('%PDF-1.7', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    async () => {
      const provider = new HttpFetchProvider({ settings: httpSettings });
      await assert.rejects(
        () => provider.fetch({ url: 'https://example.com/file.pdf' }),
        (error) => error.code === 'WEB_UNSUPPORTED_CONTENT_TYPE',
      );
    },
  );
});

test('HTTP fetch detects a small SPA shell and asks for fallback', async () => {
  const shell = '<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>';
  await withFetch(
    async () => new Response(shell, { status: 200, headers: { 'content-type': 'text/html' } }),
    async () => {
      const provider = new HttpFetchProvider({ settings: httpSettings });
      await assert.rejects(
        () => provider.fetch({ url: 'https://spa.example/' }),
        (error) => error.code === 'WEB_PROVIDER_ERROR' && /app shell/.test(error.message),
      );
    },
  );
});

test('HTTP fetch returns 404 as a result, not an error', async () => {
  await withFetch(
    async () => new Response('<html><body>missing</body></html>', { status: 404, headers: { 'content-type': 'text/html' } }),
    async () => {
      const provider = new HttpFetchProvider({ settings: httpSettings });
      const result = await provider.fetch({ url: 'https://example.com/missing' });
      assert.equal(result.statusCode, 404);
    },
  );
});

test('HTTP fetch throws on a server error', async () => {
  await withFetch(
    async () => new Response('server error', { status: 500, headers: { 'content-type': 'text/plain' } }),
    async () => {
      const provider = new HttpFetchProvider({ settings: httpSettings });
      await assert.rejects(
        () => provider.fetch({ url: 'https://example.com/error' }),
        (error) => error.code === 'WEB_PROVIDER_ERROR',
      );
    },
  );
});

test('HTTP fetch follows a redirect and reports the final URL', async () => {
  let call = 0;
  await withFetch(
    async () => {
      call += 1;
      if (call === 1) {
        return new Response(null, { status: 302, headers: { location: 'https://example.com/final' } });
      }
      return new Response('<html><body>final</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    },
    async () => {
      const provider = new HttpFetchProvider({ settings: httpSettings });
      const result = await provider.fetch({ url: 'https://example.com/start' });
      assert.equal(result.url, 'https://example.com/final');
      assert.equal(result.statusCode, 200);
    },
  );
});
