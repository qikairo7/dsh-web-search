import test from 'node:test';
import assert from 'node:assert/strict';

import { assertPublicHttpUrl, hostMatchesDomain, normalizeHostname } from '../lib/host.js';

test('normalizeHostname lowercases and strips one leading www label', () => {
  assert.equal(normalizeHostname('WWW.Example.COM'), 'example.com');
  assert.equal(normalizeHostname('www.example.com'), 'example.com');
  assert.equal(normalizeHostname('example.com'), 'example.com');
  assert.equal(normalizeHostname('www.www.example.com'), 'www.example.com');
  assert.equal(normalizeHostname('wwwexample.com'), 'wwwexample.com');
});

test('hostMatchesDomain accepts the domain itself and its subdomains only', () => {
  assert.equal(hostMatchesDomain('https://nodejs.org/api/fs.html', 'nodejs.org'), true);
  assert.equal(hostMatchesDomain('https://WWW.nodejs.org/api', 'nodejs.org'), true);
  assert.equal(hostMatchesDomain('https://nodejs.org/api', 'www.nodejs.org'), true);
  assert.equal(hostMatchesDomain('https://blog.rust-lang.org/2024', 'rust-lang.org'), true);
  assert.equal(hostMatchesDomain('https://notnodejs.org/api', 'nodejs.org'), false);
  assert.equal(hostMatchesDomain('https://nodejs.org.evil.com/', 'nodejs.org'), false);
});

test('hostMatchesDomain returns false for invalid URLs and invalid domains', () => {
  assert.equal(hostMatchesDomain('not a url', 'nodejs.org'), false);
  assert.equal(hostMatchesDomain(undefined, 'nodejs.org'), false);
  assert.equal(hostMatchesDomain('https://nodejs.org/api', undefined), false);
  assert.equal(hostMatchesDomain('https://nodejs.org/api', ''), false);
});

test('assertPublicHttpUrl returns the addresses it validated so the connection can pin them', async () => {
  const addresses = await assertPublicHttpUrl('https://example.com/', {
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    env: {},
  });
  assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]);
});

test('assertPublicHttpUrl rejects a validation-time DNS failure instead of letting it through', async () => {
  const cause = Object.assign(new Error('getaddrinfo ENOTFOUND probe.invalid'), { code: 'ENOTFOUND' });
  await assert.rejects(
    () =>
      assertPublicHttpUrl('https://probe.invalid/', {
        lookup: async () => {
          throw cause;
        },
        env: {},
      }),
    (error) =>
      error.code === 'WEB_PRIVATE_URL' &&
      /could not be resolved at validation time/u.test(error.message) &&
      error.cause === cause,
  );
});

test('assertPublicHttpUrl pins a literal public address and still blocks a literal private one', async () => {
  assert.deepEqual(await assertPublicHttpUrl('https://93.184.216.34/', { env: {} }), [
    { address: '93.184.216.34', family: 4 },
  ]);
  await assert.rejects(
    () => assertPublicHttpUrl('http://[::1]/', { env: {} }),
    (error) => error.code === 'WEB_PRIVATE_URL',
  );
});
