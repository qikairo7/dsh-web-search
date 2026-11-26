import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import { fetchPinned } from '../lib/pinnedFetch.js';
import { readResponseText } from '../lib/http.js';

const PUBLIC_ADDRESS = [{ address: '93.184.216.34', family: 4 }];

/** Build a fake IncomingMessage that carries one chunk and ends. */
function incoming({ statusCode = 200, headers = {}, body = '' } = {}) {
  const message = Readable.from([Buffer.from(body)]);
  message.statusCode = statusCode;
  message.headers = headers;
  return message;
}

/** Build a fake `request` that records its options and answers with `response`. */
function fakeRequest(response = incoming()) {
  const captured = { options: undefined, calls: 0 };
  const request = (options, onResponse) => {
    captured.options = options;
    captured.calls += 1;
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
    setImmediate(() => onResponse(response));
    return handle;
  };
  captured.request = request;
  return captured;
}

test('the pinned lookup answers every pinned address and honors the all option', async () => {
  const captured = fakeRequest();
  await fetchPinned('http://example.com/', { addresses: PUBLIC_ADDRESS, request: captured.request });
  const { lookup } = captured.options;
  const many = await new Promise((resolve, reject) =>
    lookup('example.com', { all: true }, (error, value) => (error ? reject(error) : resolve(value))),
  );
  assert.deepEqual(many, PUBLIC_ADDRESS, 'all: true must answer the whole validated list for happy eyeballs');
  const one = await new Promise((resolve, reject) =>
    lookup('example.com', {}, (error, address, family) =>
      error ? reject(error) : resolve({ address, family }),
    ),
  );
  assert.deepEqual(one, { address: '93.184.216.34', family: 4 }, 'all: false keeps the single-address form');
});

test('the request keeps the URL hostname, the default port and the full path', async () => {
  const httpCall = fakeRequest();
  await fetchPinned('http://example.com/a/b?q=1', { addresses: PUBLIC_ADDRESS, request: httpCall.request });
  assert.equal(httpCall.options.hostname, 'example.com', 'the Host header and SNI name come from the URL');
  assert.equal(httpCall.options.port, 80);
  assert.equal(httpCall.options.path, '/a/b?q=1');

  const httpsDefault = fakeRequest();
  await fetchPinned('https://example.com/', { addresses: PUBLIC_ADDRESS, request: httpsDefault.request });
  assert.equal(httpsDefault.options.port, 443);

  const httpsExplicit = fakeRequest();
  await fetchPinned('https://example.com:8443/x', {
    addresses: PUBLIC_ADDRESS,
    request: httpsExplicit.request,
  });
  assert.equal(httpsExplicit.options.port, 8443);
});

test('the request leaves certificate verification on and lets Node derive SNI', async () => {
  const captured = fakeRequest();
  await fetchPinned('https://example.com/', { addresses: PUBLIC_ADDRESS, request: captured.request });
  assert.equal('rejectUnauthorized' in captured.options, false, 'TLS verification must stay at its default');
  assert.equal('servername' in captured.options, false, 'Node takes SNI from hostname; passing it would drift');
});

test('an aborted signal rejects before the request starts and destroys an in-flight request', async () => {
  const before = new AbortController();
  before.abort(new DOMException('stop', 'AbortError'));
  const skipped = fakeRequest();
  await assert.rejects(
    () => fetchPinned('http://example.com/', { addresses: PUBLIC_ADDRESS, signal: before.signal, request: skipped.request }),
    (error) => error.name === 'AbortError',
  );
  assert.equal(skipped.calls, 0, 'a pre-aborted signal must not open a socket');

  const inFlight = new AbortController();
  const captured = fakeRequest();
  const pending = fetchPinned('http://example.com/', {
    addresses: PUBLIC_ADDRESS,
    signal: inFlight.signal,
    request: captured.request,
  });
  const reason = new DOMException('stop', 'AbortError');
  inFlight.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
});

test('the response looks enough like fetch for readResponseText', async () => {
  const captured = fakeRequest(incoming({ headers: { 'content-type': 'text/html; charset=utf-8' }, body: 'Hello' }));
  const response = await fetchPinned('https://example.com/page', {
    addresses: PUBLIC_ADDRESS,
    request: captured.request,
  });
  assert.equal(response.status, 200);
  assert.equal(response.ok, true);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(response.url, 'https://example.com/page');
  assert.equal(await readResponseText(response), 'Hello');
});

test('an empty address list falls back to the default resolver', async () => {
  const captured = fakeRequest();
  await fetchPinned('http://example.com/', { addresses: undefined, request: captured.request });
  assert.equal('lookup' in captured.options, false, 'the escape hatch must not pin when there is nothing to pin');
});