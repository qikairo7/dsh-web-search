import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROVIDER_CATALOG,
  PROVIDER_IDS,
  providersWithCapability,
  settingsKeyForProvider,
} from '../lib/catalog.js';
import { providerSettings, resolveSettings } from '../lib/settings.js';

test('catalog lists every standard provider in registration order', () => {
  assert.deepEqual(PROVIDER_IDS, [
    'anysearch',
    'keenable',
    'tavily',
    'firecrawl',
    'zhihu',
    'zhihu-site',
    'aihot',
    'exa',
    'http',
  ]);
  for (const entry of PROVIDER_CATALOG) {
    assert.ok(entry.capabilities.length > 0, `${entry.id} has a capability`);
    for (const capability of entry.capabilities) {
      assert.ok(['search', 'fetch'].includes(capability), `${entry.id} capability`);
    }
  }
});

test('catalog exposes the search and fetch capability lists', () => {
  assert.deepEqual(providersWithCapability('search'), [
    'anysearch',
    'keenable',
    'tavily',
    'firecrawl',
    'zhihu',
    'zhihu-site',
    'aihot',
    'exa',
  ]);
  assert.deepEqual(providersWithCapability('fetch'), [
    'anysearch',
    'keenable',
    'tavily',
    'firecrawl',
    'exa',
    'http',
  ]);
});

test('every provider maps to a resolved settings section', () => {
  const settings = resolveSettings();
  for (const entry of PROVIDER_CATALOG) {
    assert.equal(settingsKeyForProvider(entry.id), entry.settingsKey);
    const section = providerSettings(settings, entry.id);
    assert.ok(section !== null && typeof section === 'object', `${entry.id} settings section`);
    assert.equal(typeof section.enabled, 'boolean', `${entry.id} enabled flag`);
  }
});

test('catalog declares the official-docs and news-boost capabilities', () => {
  assert.equal(PROVIDER_CATALOG.find((entry) => entry.id === 'tavily').officialDocs, true);
  assert.equal(PROVIDER_CATALOG.find((entry) => entry.id === 'aihot').newsBoost, 0.5);
});

test('zhihu-site shares the zhihu settings section', () => {
  const settings = resolveSettings();
  assert.equal(providerSettings(settings, 'zhihu-site'), settings.zhihu);
});
