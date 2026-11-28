import test from 'node:test';
import assert from 'node:assert/strict';

import { Config } from '../lib/index.js';
import {
  findNode,
  flatten,
  loadClientDefinition,
  openSettingsPage,
  textOf,
} from './helpers/client-fixture.js';

// The settings page works with arrays for the two order fields
// (qualityExcludedProviders, cleanExtractProviders) while the host schema stores
// them as comma-separated strings (lib/index.js kind:'order' -> z.string()). These
// tests drive the real SettingsPage through the factory: if the stored string stops
// rehydrating into the control's selection, or the save stops joining the selection
// back into a string, they go red.

function mountSettingsPage(definition, behavior) {
  return openSettingsPage({
    definition,
    describe: behavior.describe,
    credentialsDescribe: behavior.credentialsDescribe,
    mutate: behavior.mutate,
  });
}

function namespaceValue(overrides = {}) {
  return {
    namespaces: [{
      ns: 'web-search-router',
      revision: 1,
      value: { searchMode: 'quality', fetchMode: 'clean', ...overrides },
    }],
  };
}

function checkboxFor(tree, key) {
  const cell = findNode(tree, (entry) => entry.props !== undefined && entry.props.key === key);
  assert.ok(cell, `${key} must render`);
  return findNode(cell, (entry) => entry.type === 'input');
}

test('stored order strings rehydrate into the matching checkbox selections', async () => {
  const page = await mountSettingsPage(loadClientDefinition(), {
    describe: () => ({ ok: true, value: namespaceValue({ qualityExcludedProviders: 'github', cleanExtractProviders: 'keenable,anysearch' }) }),
    credentialsDescribe: () => ({ ok: true, value: {} }),
    mutate: () => ({ ok: true }),
  });
  const tree = page.getTree();

  // 'github' in the stored string means GitHub is excluded from quality mode -> unchecked.
  assert.equal(checkboxFor(tree, 'quality-github').props.checked, false,
    'stored qualityExcludedProviders "github" must leave GitHub unchecked');
  assert.equal(checkboxFor(tree, 'quality-keenable').props.checked, true,
    'a provider absent from the excluded string stays checked');

  // 'keenable,anysearch' means Keenable/AnySearch extract, Exa does not -> Exa unchecked.
  assert.equal(checkboxFor(tree, 'clean-keenable').props.checked, true);
  assert.equal(checkboxFor(tree, 'clean-anysearch').props.checked, true);
  assert.equal(checkboxFor(tree, 'clean-exa').props.checked, false,
    'stored cleanExtractProviders without exa must leave Exa unchecked');
});

test('saving the order fields writes comma-separated strings, not arrays', async () => {
  const page = await mountSettingsPage(loadClientDefinition(), {
    describe: () => ({ ok: true, value: namespaceValue({ qualityExcludedProviders: '', cleanExtractProviders: 'keenable,anysearch' }) }),
    credentialsDescribe: () => ({ ok: true, value: {} }),
    mutate: () => ({ ok: true }),
  });

  // Exclude GitHub from quality mode and add Exa to clean extraction.
  checkboxFor(page.getTree(), 'quality-github').props.onChange({ target: { checked: false } });
  await page.settle();
  checkboxFor(page.getTree(), 'clean-exa').props.onChange({ target: { checked: true } });
  await page.settle();

  const saveBar = findNode(page.getTree(), (entry) => entry.props !== undefined
    && entry.props.role === 'status'
    && flatten(entry).some((child) => child.type === 'button' && textOf(child) === 'Save'));
  assert.ok(saveBar, 'the unsaved-changes save bar must render after editing');
  findNode(saveBar, (entry) => entry.type === 'button' && textOf(entry) === 'Save').props.onClick();
  await page.settle();

  assert.equal(page.harness.settingsMutateCalls.length, 1, 'the save must issue exactly one mutate call');
  const operations = page.harness.settingsMutateCalls[0].operations;
  const byPath = (path) => operations.find((operation) => operation.path[0] === path);

  const quality = byPath('qualityExcludedProviders');
  assert.ok(quality, 'excluding GitHub must emit a qualityExcludedProviders operation');
  assert.equal(quality.value, 'github', 'the excluded list must be written as a comma-separated string');
  assert.equal(typeof quality.value, 'string', 'the host z.string() field rejects arrays');

  const clean = byPath('cleanExtractProviders');
  assert.ok(clean, 'adding Exa must emit a cleanExtractProviders operation');
  assert.equal(clean.value, 'keenable,anysearch,exa', 'the clean list must be written as a comma-separated string');
  assert.equal(typeof clean.value, 'string', 'the host z.string() field rejects arrays');

  for (const operation of operations) {
    assert.equal(Array.isArray(operation.value), false, `${operation.path[0]} must not be written as an array`);
  }
});

// Anchors the contract the page must respect: the host Config schema stores these
// two fields as z.string(), so the comma strings the page writes are accepted and
// the arrays it used to write are rejected.
test('host Config accepts the comma strings the page writes and rejects the old arrays', () => {
  assert.doesNotThrow(
    () => Config({ qualityExcludedProviders: 'github', cleanExtractProviders: 'keenable,anysearch' }),
    'comma-separated strings must pass the host schema',
  );
  assert.throws(() => Config({ qualityExcludedProviders: ['github'] }), /expected string/u);
  assert.throws(() => Config({ cleanExtractProviders: ['keenable', 'anysearch'] }), /expected string/u);
});