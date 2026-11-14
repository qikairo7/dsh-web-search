import test from 'node:test';
import assert from 'node:assert/strict';

import { isHTTPURL, joinURL, ProviderRequestError, requestJSON, requestText } from '../lib/http.js';
import { withFetch } from './helpers/withFetch.js';

/**
 * A fetch that never answers by itself. Like the real fetch, it only settles
 * when its abort signal fires, so the timeout path in requestJSON can observe
 * the synthetic TimeoutError.
 */
function hangingFetch(url, init) {
  return new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  });
}

/** A response whose body read hangs until the abort signal fires. */
function hangingBody(url, init) {
  return {
    ok: true,
    status: 200,
    text: () =>
      new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason));
      }),
  };
}

test('requestJSON returns parsed JSON and forwards method, merged headers, and redirect policy', async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: String(url), init };
      return new Response(JSON.stringify({ ok: true, answer: 42 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    async () => {
      const { data, response } = await requestJSON('https://api.example.com/v1/search?query=dsh', {
        method: 'POST',
        headers: { authorization: 'Bearer key' },
        body: { query: 'dsh' },
        provider: 'keenable',
        operation: 'search',
      });
      assert.deepEqual(data, { ok: true, answer: 42 });
      assert.ok(response instanceof Response);
      assert.equal(response.status, 200);
      assert.equal(seen.url, 'https://api.example.com/v1/search?query=dsh');
      assert.equal(seen.init.method, 'POST');
      assert.equal(seen.init.redirect, 'error');
      assert.deepEqual(seen.init.headers, { accept: 'application/json', authorization: 'Bearer key' });
      assert.equal(seen.init.body, JSON.stringify({ query: 'dsh' }));
    },
  );
});

test('requestJSON defaults to a GET without a body', async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = init;
      return new Response('null');
    },
    async () => {
      const { data } = await requestJSON('https://api.example.com/ping');
      assert.equal(data, null);
      assert.equal(seen.method, 'GET');
      assert.equal(seen.redirect, 'error');
      assert.deepEqual(seen.headers, { accept: 'application/json' });
      assert.equal('body' in seen, false);
    },
  );
});

test('requestJSON passes a string body through unchanged', async () => {
  let seenBody;
  await withFetch(
    async (url, init) => {
      seenBody = init.body;
      return new Response('{}');
    },
    async () => {
      await requestJSON('https://api.example.com/extract', { method: 'POST', body: 'raw payload' });
      assert.equal(seenBody, 'raw payload');
    },
  );
});

test('requestJSON maps a timeout to the caller-provided timeoutCode', async () => {
  await withFetch(hangingFetch, async () => {
    await assert.rejects(
      () =>
        requestJSON('https://api.example.com/slow', {
          timeoutMs: 15,
          timeoutCode: 'WEB_SEARCH_TIMEOUT',
          provider: 'keenable',
          operation: 'search',
        }),
      (error) =>
        error instanceof ProviderRequestError &&
        error.code === 'WEB_SEARCH_TIMEOUT' &&
        error.message === 'keenable search timed out after 15 ms',
    );
  });
});

test('requestJSON falls back to WEB_PROVIDER_ERROR when no timeoutCode is given', async () => {
  await withFetch(hangingFetch, async () => {
    await assert.rejects(
      () => requestJSON('https://api.example.com/slow', { timeoutMs: 15 }),
      (error) =>
        error instanceof ProviderRequestError &&
        error.code === 'WEB_PROVIDER_ERROR' &&
        error.message === 'provider request timed out after 15 ms',
    );
  });
});

test('requestJSON maps an already-aborted caller signal to WEB_ABORTED', async () => {
  const controller = new AbortController();
  controller.abort();
  await withFetch(
    async (url, init) => {
      throw init.signal.reason;
    },
    async () => {
      await assert.rejects(
        () => requestJSON('https://api.example.com/cancelled', { signal: controller.signal }),
        (error) =>
          error instanceof ProviderRequestError &&
          error.code === 'WEB_ABORTED' &&
          error.message === 'provider request aborted',
      );
    },
  );
});

test('requestJSON maps caller cancellation during the request to WEB_ABORTED', async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);
  await withFetch(hangingFetch, async () => {
    await assert.rejects(
      () => requestJSON('https://api.example.com/cancelled', { signal: controller.signal, timeoutMs: 5_000 }),
      (error) => error instanceof ProviderRequestError && error.code === 'WEB_ABORTED',
    );
  });
});

test('requestJSON prefers caller cancellation over a timeout that already fired', async () => {
  const controller = new AbortController();
  await withFetch(
    async (url, init) => {
      // Let the 10 ms timeout fire first, then cancel from the caller side:
      // both branches are eligible, but WEB_ABORTED must win.
      await new Promise((resolve) => setTimeout(resolve, 40));
      controller.abort();
      throw init.signal.reason;
    },
    async () => {
      await assert.rejects(
        () =>
          requestJSON('https://api.example.com/race', {
            signal: controller.signal,
            timeoutMs: 10,
            timeoutCode: 'WEB_SEARCH_TIMEOUT',
          }),
        (error) => error instanceof ProviderRequestError && error.code === 'WEB_ABORTED',
      );
    },
  );
});

test('requestJSON wraps transport failures with the underlying message', async () => {
  await withFetch(
    async () => {
      throw new TypeError('fetch failed');
    },
    async () => {
      await assert.rejects(
        () => requestJSON('https://api.example.com/down'),
        (error) =>
          error instanceof ProviderRequestError &&
          error.code === 'WEB_PROVIDER_ERROR' &&
          error.message === 'provider request request failed: fetch failed',
      );
    },
  );
});

test('requestJSON maps a timeout while reading the response body', async () => {
  await withFetch(hangingBody, async () => {
    await assert.rejects(
      () => requestJSON('https://api.example.com/slow-body', { timeoutMs: 20, timeoutCode: 'WEB_FETCH_TIMEOUT' }),
      (error) =>
        error instanceof ProviderRequestError &&
        error.code === 'WEB_FETCH_TIMEOUT' &&
        error.message === 'provider request timed out after 20 ms',
    );
  });
});

test('requestJSON wraps response body read failures', async () => {
  await withFetch(
    async () => ({ ok: true, status: 200, text: async () => { throw new Error('stream reset'); } }),
    async () => {
      await assert.rejects(
        () => requestJSON('https://api.example.com/broken-stream'),
        (error) =>
          error instanceof ProviderRequestError &&
          error.code === 'WEB_PROVIDER_ERROR' &&
          error.message === 'provider request response read failed: stream reset',
      );
    },
  );
});

test('requestJSON maps HTTP 429 to WEB_RATE_LIMITED and surfaces the detail', async () => {
  await withFetch({ status: 429, body: '"slow down"' }, async () => {
    await assert.rejects(
      () => requestJSON('https://api.example.com/limited'),
      (error) =>
        error instanceof ProviderRequestError &&
        error.code === 'WEB_RATE_LIMITED' &&
        error.status === 429 &&
        error.message === 'provider request failed (HTTP 429): slow down',
    );
  });
});

test('requestJSON surfaces every backend error body shape in the failure message', async () => {
  const shapes = [
    ['a JSON string body', '"quota exhausted"', 'quota exhausted'],
    ['{error: string}', { error: 'quota exhausted' }, 'quota exhausted'],
    ['{error: {message}}', { error: { message: 'quota exhausted' } }, 'quota exhausted'],
    ['{error: {error}}', { error: { error: 'quota exhausted' } }, 'quota exhausted'],
    ['{message}', { message: 'quota exhausted' }, 'quota exhausted'],
    ['{detail: string}', { detail: 'quota exhausted' }, 'quota exhausted'],
    ['{detail: {error}}', { detail: { error: 'quota exhausted' } }, 'quota exhausted'],
    ['{detail: [{msg}]}', { detail: [{ msg: 'first failed' }, { msg: 'second failed' }, {}] }, 'first failed; second failed'],
  ];
  for (const [shape, payload, expectedDetail] of shapes) {
    await withFetch({ status: 500, body: payload }, async () => {
      await assert.rejects(
        () => requestJSON('https://api.example.com/error'),
        (error) => {
          assert.equal(error instanceof ProviderRequestError, true, shape);
          assert.equal(error.code, 'WEB_PROVIDER_ERROR', shape);
          assert.equal(error.status, 500, shape);
          assert.equal(error.message, `provider request failed (HTTP 500): ${expectedDetail}`, shape);
          return true;
        },
      );
    });
  }
});

test('requestJSON omits the detail suffix when the error body has none', async () => {
  await withFetch({ status: 502, body: '' }, async () => {
    await assert.rejects(
      () => requestJSON('https://api.example.com/empty-error'),
      (error) =>
        error instanceof ProviderRequestError &&
        error.code === 'WEB_PROVIDER_ERROR' &&
        error.message === 'provider request failed (HTTP 502)',
    );
  });
});

test('requestJSON reports invalid JSON with the response status', async () => {
  await withFetch({ status: 200, body: '<html>not json</html>' }, async () => {
    await assert.rejects(
      () => requestJSON('https://api.example.com/broken'),
      (error) =>
        error instanceof ProviderRequestError &&
        error.code === 'WEB_PROVIDER_ERROR' &&
        error.status === 200 &&
        /invalid JSON/.test(error.message),
    );
  });
});

test('requestJSON with parse text returns the raw body unchanged', async () => {
  await withFetch({ status: 200, body: '<b>not json</b>' }, async () => {
    const { data, response } = await requestJSON('https://api.example.com/raw', { parse: 'text' });
    assert.equal(data, '<b>not json</b>');
    assert.equal(response.status, 200);
  });
});

test('requestJSON leaves data undefined for an empty 200 body', async () => {
  await withFetch({ status: 200, body: '' }, async () => {
    const { data } = await requestJSON('https://api.example.com/empty');
    assert.equal(data, undefined);
  });
});

test('requestText applies the same policy with text parsing', async () => {
  await withFetch({ status: 200, body: '# markdown body' }, async () => {
    const { data } = await requestText('https://api.example.com/page');
    assert.equal(data, '# markdown body');
  });
});

test('joinURL validates the base and joins paths with trailing-slash tolerance', () => {
  assert.equal(joinURL('https://api.example.com', '/search'), 'https://api.example.com/search');
  assert.equal(joinURL('https://api.example.com/v1/', 'search'), 'https://api.example.com/v1/search');
  assert.equal(joinURL('https://api.example.com/v1///', '/search'), 'https://api.example.com/v1/search');
  assert.throws(
    () => joinURL('ftp://api.example.com', 'search'),
    (error) =>
      error instanceof ProviderRequestError &&
      error.code === 'WEB_PROVIDER_ERROR' &&
      /invalid base URL/.test(error.message),
  );
  assert.throws(() => joinURL('api.example.com', 'search'), /invalid base URL/);
});

test('isHTTPURL accepts only absolute http(s) URLs', () => {
  assert.equal(isHTTPURL('https://example.com/a'), true);
  assert.equal(isHTTPURL('http://localhost:3000'), true);
  assert.equal(isHTTPURL('ftp://example.com'), false);
  assert.equal(isHTTPURL('example.com/search'), false);
  assert.equal(isHTTPURL('   '), false);
  assert.equal(isHTTPURL(42), false);
  assert.equal(isHTTPURL(undefined), false);
});
