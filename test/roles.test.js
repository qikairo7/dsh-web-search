import test from 'node:test';
import assert from 'node:assert/strict';

import {
  paidSearchFallback,
  providerEntry,
  providersWithCapability,
} from '../lib/catalog.js';
import { DEFAULT_SEARCH_ORDERS, SEARCH_ROLES, searchRole } from '../lib/roles.js';
import { DEFAULT_SETTINGS } from '../lib/settings.js';

test('role tables reference only free-tier search providers', () => {
  const searchProviders = providersWithCapability('search');
  for (const table of [SEARCH_ROLES.zh, SEARCH_ROLES.en]) {
    for (const row of Object.values(table)) {
      for (const id of row.quality) {
        assert.equal(providerEntry(id).tier, 'free', `${id} quality tier`);
        assert.ok(searchProviders.includes(id), `${id} search capability`);
      }
      if (row.fast !== null) {
        for (const id of row.fast) {
          assert.equal(providerEntry(id).tier, 'free', `${id} fast tier`);
          assert.ok(searchProviders.includes(id), `${id} search capability`);
        }
      }
    }
  }
});

test('Chinese rows keep Zhihu; English rows drop it (ADR-0010)', () => {
  assert.ok(SEARCH_ROLES.zh.general.quality.includes('zhihu'));
  assert.equal(SEARCH_ROLES.en.general.quality.includes('zhihu'), false);
  assert.equal(SEARCH_ROLES.en['ai-news'].quality.includes('zhihu'), false);
  assert.equal(SEARCH_ROLES.zh['ai-news'].quality[0], 'aihot');
  assert.equal(SEARCH_ROLES.en['ai-news'].quality[0], 'aihot');
});

test('searchRole falls back to the general row for unmapped intents', () => {
  assert.equal(searchRole('zh', 'chinese-community'), SEARCH_ROLES.zh.general);
  assert.equal(searchRole('en', 'chinese-community'), SEARCH_ROLES.en.general);
});

test('default orders end with the catalog paid tail and stay free before it', () => {
  const paid = paidSearchFallback();
  const fetchProviders = providersWithCapability('fetch');
  for (const order of Object.values(DEFAULT_SEARCH_ORDERS)) {
    assert.deepEqual(order.slice(-paid.length), paid);
    for (const id of order.slice(0, -paid.length)) {
      assert.equal(providerEntry(id).tier, 'free', `${id} tier before the paid tail`);
    }
  }
  for (const id of DEFAULT_SEARCH_ORDERS.fetchOrder) {
    assert.ok(fetchProviders.includes(id), `${id} fetch capability`);
  }
  for (const id of DEFAULT_SEARCH_ORDERS.cleanFetchOrder) {
    assert.ok(fetchProviders.includes(id), `${id} fetch capability`);
  }
});

test('settings-level order defaults derive from the role table', () => {
  for (const [key, value] of Object.entries(DEFAULT_SEARCH_ORDERS)) {
    assert.equal(DEFAULT_SETTINGS[key], value, key);
  }
});
