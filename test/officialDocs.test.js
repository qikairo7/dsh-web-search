import test from 'node:test';
import assert from 'node:assert/strict';

import { filterOfficialDocs, isDeprecatedDocUrl, officialDomainsForQuery } from '../lib/officialDocs.js';

test('officialDomainsForQuery returns official docs domains', () => {
  assert.deepEqual(officialDomainsForQuery('DeepSeek Harness 插件开发'), [
    'deepseek-harness.github.io',
    'api-docs.deepseek.com',
  ]);
  assert.deepEqual(officialDomainsForQuery('Node.js fetch timeout'), ['nodejs.org']);
  assert.deepEqual(officialDomainsForQuery('Docker compose volume'), ['docs.docker.com']);
  assert.deepEqual(officialDomainsForQuery('random weather'), []);
  assert.deepEqual(officialDomainsForQuery('where to go on vacation'), []);
  assert.deepEqual(officialDomainsForQuery('go programming language tutorial'), ['go.dev']);
});

test('filters archived Node.js release docs', () => {
  assert.equal(isDeprecatedDocUrl('https://nodejs.org/download/release/v18.16.0/docs/api/globals.html'), true);
  assert.equal(isDeprecatedDocUrl('https://nodejs.org/en/blog/release/v18.13.0'), true);
  assert.equal(isDeprecatedDocUrl('https://nodejs.org/docs/v18.16.0/api/globals.html'), true);
  assert.equal(isDeprecatedDocUrl('https://nodejs.org/api/globals.html'), false);
  assert.deepEqual(
    filterOfficialDocs([
      { url: 'https://nodejs.org/download/release/v18.16.0/docs/api/globals.html' },
      { url: 'https://nodejs.org/api/globals.html' },
    ]).map((source) => source.url),
    ['https://nodejs.org/api/globals.html'],
  );
});
