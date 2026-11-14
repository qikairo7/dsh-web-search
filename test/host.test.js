import test from 'node:test';
import assert from 'node:assert/strict';

import { hostMatchesDomain, normalizeHostname } from '../lib/host.js';

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
