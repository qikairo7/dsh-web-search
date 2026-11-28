import test from 'node:test';
import assert from 'node:assert/strict';

import { Config } from '../lib/index.js';
import {
  fieldAnchors,
  findNode,
  loadClientDefinition,
  openSettingsPage,
  settingsSection,
  textOf,
} from './helpers/client-fixture.js';

// Four settings are order tables, and the host schema stores each as one comma
// separated string (lib/index.js kind:'order' -> z.string()). The page edits them as
// text, so the value it renders and the value it writes are the same string: a page
// that wrote an array the host rejects would save nothing and say it saved.

const definition = loadClientDefinition();
const ORDER_KEYS = ['qualityExcludedProviders', 'cleanExtractProviders', 'defaultSearchOrder', 'fetchOrder'];

function open(overrides) {
  return openSettingsPage({ definition, section: settingsSection(overrides) });
}

const inputOf = (tree, key) => findNode(fieldAnchors(tree, key)[0], (entry) => entry.type === 'input');
const saveOf = (tree) => findNode(tree, (entry) => entry.type === 'button' && textOf(entry) === 'Save');

test('every order field renders the stored comma string as-is', async () => {
  const page = await open({
    qualityExcludedProviders: '',
    cleanExtractProviders: 'keenable,anysearch',
    defaultSearchOrder: 'keenable,exa',
    fetchOrder: 'keenable,http,anysearch',
  });
  const tree = page.getTree();
  assert.equal(inputOf(tree, 'qualityExcludedProviders').props.value, '', 'an empty order renders empty');
  assert.equal(inputOf(tree, 'cleanExtractProviders').props.value, 'keenable,anysearch');
  assert.equal(inputOf(tree, 'defaultSearchOrder').props.value, 'keenable,exa');
  assert.equal(inputOf(tree, 'fetchOrder').props.value, 'keenable,http,anysearch');
});

test('editing an order field writes one comma string per field, never an array', async () => {
  const page = await open({ qualityExcludedProviders: '', cleanExtractProviders: 'keenable,anysearch' });
  let tree = page.getTree();
  inputOf(tree, 'qualityExcludedProviders').props.onChange({ target: { value: 'github' } });
  tree = await page.settle();
  inputOf(tree, 'cleanExtractProviders').props.onChange({ target: { value: 'keenable,anysearch,exa' } });
  tree = await page.settle();
  saveOf(tree).props.onClick();
  await page.settle();

  assert.equal(page.harness.formMutateCalls.length, 1, 'the save must issue exactly one mutation');
  const operations = page.harness.formMutateCalls[0].ops;
  const byKey = (key) => operations.find((operation) => operation.path[0] === key);
  const quality = byKey('qualityExcludedProviders');
  assert.ok(quality, 'excluding GitHub must emit a qualityExcludedProviders operation');
  assert.equal(quality.value, 'github', 'the excluded list must be written as a comma-separated string');
  assert.equal(typeof quality.value, 'string', 'the host z.string() field rejects arrays');
  const clean = byKey('cleanExtractProviders');
  assert.ok(clean, 'adding Exa must emit a cleanExtractProviders operation');
  assert.equal(clean.value, 'keenable,anysearch,exa');
  for (const operation of operations) {
    assert.equal(Array.isArray(operation.value), false, `${operation.path[0]} must not be written as an array`);
  }
});

test('clearing an order field stages a clear instead of storing an empty string', async () => {
  const page = await open({ fetchOrder: 'keenable,http' });
  let tree = page.getTree();
  inputOf(tree, 'fetchOrder').props.onChange({ target: { value: '' } });
  tree = await page.settle();
  saveOf(tree).props.onClick();
  await page.settle();
  const clear = page.harness.formMutateCalls[0].ops.find((operation) => operation.path[0] === 'fetchOrder');
  assert.deepEqual(JSON.parse(JSON.stringify(clear)), { op: 'unset', path: ['fetchOrder'] },
    'an emptied field must re-inherit the deployment value, not override it with ""');
});

test('every order field in the table is an order-kind string the host accepts', () => {
  for (const key of ORDER_KEYS) {
    assert.doesNotThrow(() => Config({ [key]: 'keenable,exa' }), `${key} must accept a comma string`);
    assert.throws(() => Config({ [key]: ['keenable'] }), /expected string/u, `${key} must reject an array`);
  }
});