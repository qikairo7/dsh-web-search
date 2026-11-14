import test from 'node:test';
import assert from 'node:assert/strict';

import { officialDomainsForQuery } from '../lib/officialDocs.js';

test('officialDomainsForQuery returns official docs domains', () => {
  assert.deepEqual(officialDomainsForQuery('DeepSeek Harness 插件开发'), [
    'deepseek-harness.github.io',
    'api-docs.deepseek.com',
  ]);
  assert.deepEqual(officialDomainsForQuery('Node.js fetch timeout'), ['nodejs.org']);
  assert.deepEqual(officialDomainsForQuery('random weather'), []);
});
