import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROVIDER_CATALOG,
  PROVIDER_IDS,
  paidSearchFallback,
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
      assert.ok(['search', 'fetch', 'domainSearch'].includes(capability), `${entry.id} capability`);
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

test('catalog declares the domain-search capability, news supplement, and news boost', () => {
  const domainSearch = PROVIDER_CATALOG.filter((entry) =>
    entry.capabilities.includes('domainSearch'),
  );
  assert.deepEqual(domainSearch.map((entry) => entry.id), ['tavily']);
  assert.equal(PROVIDER_CATALOG.find((entry) => entry.id === 'tavily').newsSupplement, true);
  assert.equal(PROVIDER_CATALOG.find((entry) => entry.id === 'aihot').newsBoost, 0.5);
});

test('catalog declares a tier and operator set for every provider', () => {
  assert.deepEqual(
    PROVIDER_CATALOG.filter((entry) => entry.tier === 'paid').map((entry) => entry.id).sort(),
    ['firecrawl', 'tavily'],
  );
  for (const entry of PROVIDER_CATALOG) {
    assert.ok(['free', 'paid'].includes(entry.tier), `${entry.id} tier`);
    assert.ok(Array.isArray(entry.operators), `${entry.id} operators`);
    for (const operator of entry.operators) {
      assert.ok(
        ['site', 'lang', 'date', 'language', 'news'].includes(operator),
        `${entry.id} operator ${operator}`,
      );
    }
  }
});

test('paidSearchFallback lists paid search providers in the declared order', () => {
  const fallback = paidSearchFallback();
  assert.deepEqual(fallback, ['tavily', 'firecrawl']);
  for (const id of fallback) {
    const entry = PROVIDER_CATALOG.find((provider) => provider.id === id);
    assert.equal(entry.tier, 'paid', `${id} tier`);
    assert.ok(entry.capabilities.includes('search'), `${id} search capability`);
  }
});

test('zhihu-site shares the zhihu settings section', () => {
  const settings = resolveSettings();
  assert.equal(providerSettings(settings, 'zhihu-site'), settings.zhihu);
});
