import test from 'node:test';
import assert from 'node:assert/strict';

import { readProviderUsage, recordProviderUsage } from '../lib/quotaStore.js';

test('quota store keeps the last finite remaining reading', () => {
  recordProviderUsage('test-provider', { credits_remaining: 42, sku: 'search.pro', paid: true });
  assert.deepEqual(readProviderUsage('test-provider'), {
    remaining: 42,
    at: readProviderUsage('test-provider').at,
    sku: 'search.pro',
    paid: true,
  });
});
