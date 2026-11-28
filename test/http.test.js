import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import { HttpFetchProvider } from '../lib/providers/http.js';
import { fetchPinned } from '../lib/pinnedFetch.js';

function httpSettings() {
  return {
    requestTimeoutMs: 5_000,
    maxFetchChars: 10_000,
    minDirectHtmlChars: 2_048,
    http: { enabled: true },
  };
}

// DNS stub keeps the private-address guard offline in unit tests: every host
// resolves to one public address unless a test overrides it.
const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

/** Build a provider whose transport is a fake, so no test opens a socket. */
function providerWith(fetchImpl, lookup = publicLookup) {
  return new HttpFetchProvider({ settings: httpSettings, lookup, fetch: fetchImpl });
}

test('HTTP fetch returns HTML for the tool layer to convert', async () => {
  const provider = providerWith(
    async () =>
      new Response('<!doctype html><html><body><h1>Hello</h1></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
  );
  const result = await provider.fetch({ url: 'https://example.com/' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.kind, 'html');
  assert.match(result.body.content, /Hello/);
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
  const provider = providerWith(
    async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
  );
  const result = await provider.fetch({ url: 'https://github.com/deepseek-ai/dsh-web-search' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.kind, 'text');
  assert.doesNotMatch(result.body.content, /<html|<body|<h[1-6]/iu);
  assert.match(result.body.content, /deepseek-ai\/dsh-web-search/u);
  assert.match(result.body.content, /Free-tier-first providers\./u);
  assert.doesNotMatch(result.body.content, /^Releases$/mu);
  assert.doesNotMatch(result.body.content, /^Login$/mu);
});

test('HTTP fetch rejects PDF responses so the router can fall back', async () => {
  const provider = providerWith(
    async () => new Response('%PDF-1.7', { status: 200, headers: { 'content-type': 'application/pdf' } }),
  );
  await assert.rejects(
    () => provider.fetch({ url: 'https://example.com/file.pdf' }),
    (error) => error.code === 'WEB_UNSUPPORTED_CONTENT_TYPE',
  );
});

test('HTTP fetch detects a small SPA shell and asks for fallback', async () => {
  const shell = '<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>';
  const provider = providerWith(
    async () => new Response(shell, { status: 200, headers: { 'content-type': 'text/html' } }),
  );
  await assert.rejects(
    () => provider.fetch({ url: 'https://spa.example/' }),
    (error) => error.code === 'WEB_INVALID_RESPONSE' && /app shell/.test(error.message),
  );
});

test('HTTP fetch keeps a small page with visible content', async () => {
  const html = `<!doctype html><html><body><div id="root"><h1>Title</h1><p>${'Real content. '.repeat(30)}</p></div><script src="/app.js"></script></body></html>`;
  const provider = providerWith(
    async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
  );
  const result = await provider.fetch({ url: 'https://static.example/' });
  assert.match(result.body.content, /Real content\./u);
});

test('HTTP fetch rejects a body that exceeds the byte cap while streaming', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(5_000_001));
      controller.close();
    },
  });
  const provider = providerWith(
    async () => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } }),
  );
  await assert.rejects(
    () => provider.fetch({ url: 'https://large.example/' }),
    (error) => error.code === 'WEB_FETCH_TOO_LARGE',
  );
});

test('HTTP fetch decodes a declared non-UTF-8 charset', async () => {
  const gbk = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]);
  const provider = providerWith(
    async () => new Response(gbk, { status: 200, headers: { 'content-type': 'text/plain; charset=gbk' } }),
  );
  const result = await provider.fetch({ url: 'https://gbk.example/' });
  assert.equal(result.body.content, '中文');
});

test('HTTP fetch returns 404 as a result, not an error', async () => {
  const provider = providerWith(
    async () =>
      new Response('<html><body>missing</body></html>', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      }),
  );
  const result = await provider.fetch({ url: 'https://example.com/missing' });
  assert.equal(result.statusCode, 404);
});

test('HTTP fetch throws on a server error', async () => {
  const provider = providerWith(
    async () => new Response('server error', { status: 500, headers: { 'content-type': 'text/plain' } }),
  );
  await assert.rejects(
    () => provider.fetch({ url: 'https://example.com/error' }),
    (error) => error.code === 'WEB_PROVIDER_ERROR' && error.status === 500,
  );
});

test('HTTP fetch follows a redirect and reports the final URL', async () => {
  let call = 0;
  const provider = providerWith(async () => {
    call += 1;
    if (call === 1) {
      return new Response(null, { status: 302, headers: { location: 'https://example.com/final' } });
    }
    return new Response('<html><body>final</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  });
  const result = await provider.fetch({ url: 'https://example.com/start' });
  assert.equal(result.url, 'https://example.com/final');
  assert.equal(result.statusCode, 200);
});

test('HTTP fetch blocks loopback, private, link-local and metadata addresses', async () => {
  const blocked = [
    'http://127.0.0.1/',
    'http://10.1.2.3/',
    'http://172.16.0.5/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[fc00::1]/',
    'http://[::ffff:127.0.0.1]/',
  ];
  let requested = false;
  const provider = providerWith(async () => {
    requested = true;
    return new Response('internal', { status: 200, headers: { 'content-type': 'text/plain' } });
  });
  for (const url of blocked) {
    await assert.rejects(() => provider.fetch({ url }), (error) => error.code === 'WEB_PRIVATE_URL');
  }
  assert.equal(requested, false, 'a blocked URL must never be fetched');
});

test('HTTP fetch blocks a redirect into a private address and cancels the redirect body', async () => {
  let calls = 0;
  let cancelled = false;
  const redirectBody = () =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() {
        cancelled = true;
      },
    });
  const provider = providerWith(async () => {
    calls += 1;
    return new Response(redirectBody(), { status: 302, headers: { location: 'http://127.0.0.1/secret' } });
  });
  await assert.rejects(
    () => provider.fetch({ url: 'https://public.example/start' }),
    (error) => error.code === 'WEB_PRIVATE_URL',
  );
  assert.equal(calls, 1, 'the private redirect target must not be fetched');
  assert.equal(cancelled, true, 'the private redirect response body must be cancelled before throwing');
});

test('HTTP fetch cancels the redirect body before throwing on a non-HTTP redirect', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
    },
    cancel() {
      cancelled = true;
    },
  });
  const provider = providerWith(
    async () => new Response(stream, { status: 302, headers: { location: 'ftp://example.com/file' } }),
  );
  await assert.rejects(
    () => provider.fetch({ url: 'https://example.com/start' }),
    (error) => error.code === 'WEB_REDIRECT_BLOCKED',
  );
  assert.equal(cancelled, true, 'a non-HTTP redirect body must be cancelled before throwing');
});

test('HTTP fetch cancels each redirect body before throwing when redirects are exhausted', async () => {
  let cancelled = 0;
  const redirectBody = () =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() {
        cancelled += 1;
      },
    });
  const provider = providerWith(
    async () => new Response(redirectBody(), { status: 302, headers: { location: 'https://example.com/loop' } }),
  );
  await assert.rejects(
    () => provider.fetch({ url: 'https://example.com/start' }),
    (error) => error.code === 'WEB_REDIRECT_BLOCKED',
  );
  // Hops 0..MAX_REDIRECTS all return 302; the last body is cancelled before throwing.
  assert.equal(cancelled, 6, 'every redirect body must be cancelled');
});

test('HTTP fetch blocks a public hostname that resolves to a private address', async () => {
  let requested = false;
  const provider = providerWith(
    async () => {
      requested = true;
      return new Response('internal', { status: 200, headers: { 'content-type': 'text/plain' } });
    },
    async () => [{ address: '10.0.0.9', family: 4 }],
  );
  await assert.rejects(
    () => provider.fetch({ url: 'https://rebind.example/' }),
    (error) => error.code === 'WEB_PRIVATE_URL',
  );
  assert.equal(requested, false, 'a host resolving to a private address must never be fetched');
});

test('HTTP fetch reaches a private host when the escape hatch is enabled', async () => {
  const previous = process.env.DSH_WEB_HTTP_ALLOW_PRIVATE;
  process.env.DSH_WEB_HTTP_ALLOW_PRIVATE = '1';
  try {
    const provider = providerWith(
      async () =>
        new Response('<html><body>local debug</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );
    const result = await provider.fetch({ url: 'http://127.0.0.1:1324/' });
    assert.equal(result.statusCode, 200);
    assert.match(result.body.content, /local debug/u);
  } finally {
    if (previous === undefined) delete process.env.DSH_WEB_HTTP_ALLOW_PRIVATE;
    else process.env.DSH_WEB_HTTP_ALLOW_PRIVATE = previous;
  }
});

test('HTTP fetch cancels the response body before throwing on 403, 429 and 5xx', async () => {
  for (const status of [403, 429, 500]) {
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = new Response(stream, { status, headers: { 'content-type': 'text/plain' } });
    const provider = providerWith(async () => response);
    await assert.rejects(
      () => provider.fetch({ url: 'https://example.com/error' }),
      (error) => {
        const expected = status === 429 ? 'WEB_RATE_LIMITED' : 'WEB_PROVIDER_ERROR';
        return error.code === expected && error.status === status;
      },
    );
    assert.equal(cancelled, true, `status ${status} must cancel the body before throwing`);
  }
});

test('HTTP fetch cancels the response body before throwing on an unsupported content type', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = new Response(stream, { status: 200, headers: { 'content-type': 'application/pdf' } });
  const provider = providerWith(async () => response);
  await assert.rejects(
    () => provider.fetch({ url: 'https://example.com/file.pdf' }),
    (error) => error.code === 'WEB_UNSUPPORTED_CONTENT_TYPE',
  );
  assert.equal(cancelled, true, 'an unsupported content type must cancel the body before throwing');
});

test('HTTP fetch pins the connection to the address it validated, not to its own resolution', async () => {
  const seen = [];
  const provider = providerWith(async (url, init) => {
    seen.push({ url, addresses: init.addresses });
    return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });
  });
  await provider.fetch({ url: 'https://rebind.example/' });
  assert.deepEqual(seen, [
    { url: 'https://rebind.example/', addresses: [{ address: '93.184.216.34', family: 4 }] },
  ]);
  assert.equal(
    seen[0].addresses.some((entry) => entry.address === '127.0.0.1'),
    false,
    'the connection must not re-resolve the hostname to a loopback address',
  );
});

test('HTTP fetch rejects a host whose validation lookup fails and never reaches the transport', async () => {
  let calls = 0;
  const provider = providerWith(
    async () => {
      calls += 1;
      return new Response('internal', { status: 200, headers: { 'content-type': 'text/plain' } });
    },
    async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND probe.invalid'), { code: 'ENOTFOUND' });
    },
  );
  await assert.rejects(
    () => provider.fetch({ url: 'https://probe.invalid/' }),
    (error) => error.code === 'WEB_PRIVATE_URL' && /could not be resolved at validation time/u.test(error.message),
  );
  assert.equal(calls, 0, 'a validation-time DNS failure must not open a connection');
});

test('HTTP fetch rejects a redirect whose validation lookup fails and cancels the redirect body', async () => {
  let calls = 0;
  let cancelled = false;
  const redirectBody = () =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() {
        cancelled = true;
      },
    });
  const lookups = [
    async () => [{ address: '93.184.216.34', family: 4 }],
    async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND second.example'), { code: 'ENOTFOUND' });
    },
  ];
  let lookupCalls = 0;
  const provider = providerWith(
    async () => {
      calls += 1;
      return new Response(redirectBody(), { status: 302, headers: { location: 'https://second.example/' } });
    },
    () => lookups[Math.min(lookupCalls++, lookups.length - 1)](),
  );
  await assert.rejects(
    () => provider.fetch({ url: 'https://first.example/' }),
    (error) => error.code === 'WEB_PRIVATE_URL',
  );
  assert.equal(calls, 1, 'the second hop must not be fetched');
  assert.equal(cancelled, true, 'the redirect body must be cancelled before throwing');
});

test('HTTP fetch leaves the connection unpinned when the escape hatch is enabled', async () => {
  const previous = process.env.DSH_WEB_HTTP_ALLOW_PRIVATE;
  process.env.DSH_WEB_HTTP_ALLOW_PRIVATE = '1';
  try {
    const seen = [];
    const provider = providerWith(async (url, init) => {
      seen.push({ url, init });
      return new Response('local debug', { status: 200, headers: { 'content-type': 'text/plain' } });
    });
    const result = await provider.fetch({ url: 'http://127.0.0.1:1324/' });
    assert.equal(result.body.content, 'local debug');
    assert.equal(seen[0].init.addresses, undefined, 'the escape hatch falls back to default resolution');
  } finally {
    if (previous === undefined) delete process.env.DSH_WEB_HTTP_ALLOW_PRIVATE;
    else process.env.DSH_WEB_HTTP_ALLOW_PRIVATE = previous;
  }
});

test('HTTP fetch pins a validated IPv6 address and keeps the URL hostname', async () => {
  const seen = [];
  const provider = providerWith(
    async (url, init) => {
      seen.push({ url, init });
      return new Response('v6', { status: 200, headers: { 'content-type': 'text/plain' } });
    },
    async () => [{ address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }],
  );
  const result = await provider.fetch({ url: 'https://v6.example/path' });
  assert.equal(result.statusCode, 200);
  assert.equal(seen[0].url, 'https://v6.example/path', 'the pinned request keeps the URL hostname for Host and SNI');
  assert.deepEqual(seen[0].init.addresses, [{ address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }]);
});

/** Build a fake `request` whose response headers arrive but whose body never ends. */
function stalledRequest() {
  const captured = { calls: 0, responded: false, options: undefined, abortBody: undefined };
  const request = (options, onResponse) => {
    captured.calls += 1;
    captured.options = options;
    const handlers = {};
    const handle = {
      on(event, handler) {
        handlers[event] = handler;
        return this;
      },
      destroy(reason) {
        handlers.error?.(reason);
      },
      end() {},
    };
    setImmediate(() => {
      const message = new Readable({ read() {} });
      message.statusCode = 200;
      message.headers = { 'content-type': 'text/plain' };
      captured.responded = true;
      captured.abortBody = () => message.destroy(new DOMException('stop', 'AbortError'));
      onResponse(message);
    });
    return handle;
  };
  captured.request = request;
  return captured;
}

/** Build a provider whose transport is the real pinned fetch over a fake `request`. */
function providerWithStalledRequest(fake, { requestTimeoutMs } = {}) {
  return new HttpFetchProvider({
    settings: () => ({ ...httpSettings(), requestTimeoutMs }),
    lookup: publicLookup,
    fetch: (url, init) => fetchPinned(url, { ...init, request: fake.request }),
  });
}

test('HTTP fetch enforces the request timeout after the response headers on a stalled body', async () => {
  const fake = stalledRequest();
  const provider = providerWithStalledRequest(fake, { requestTimeoutMs: 200 });
  const outcome = await Promise.race([
    provider.fetch({ url: 'https://stall.example/' }).then(
      (result) => `OK:${result.statusCode}`,
      (error) => `THROW:${error.code}`,
    ),
    new Promise((resolve) => setTimeout(() => resolve('stalled'), 1_500)),
  ]);
  fake.abortBody?.();
  assert.equal(fake.responded, true, 'the response headers must arrive before the body stalls');
  assert.equal(outcome, 'THROW:WEB_FETCH_TIMEOUT', 'the request timeout must cut off a stalled body after the headers');
});

test('HTTP fetch honors caller cancellation after the response headers on a stalled body', async () => {
  const fake = stalledRequest();
  const provider = providerWithStalledRequest(fake, { requestTimeoutMs: 30_000 });
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 150);
  const outcome = await Promise.race([
    provider.fetch({ url: 'https://stall.example/' }, controller.signal).then(
      (result) => `OK:${result.statusCode}`,
      (error) => `THROW:${error.code}`,
    ),
    new Promise((resolve) => setTimeout(() => resolve('stalled'), 1_500)),
  ]);
  fake.abortBody?.();
  assert.equal(fake.responded, true, 'the response headers must arrive before the cancellation');
  assert.equal(outcome, 'THROW:WEB_ABORTED', 'caller cancellation must cut off a stalled body after the headers');
});
