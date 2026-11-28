import test from 'node:test';
import assert from 'node:assert/strict';

import { SETTINGS_SPEC } from '../lib/settings.js';
import {
  findAll,
  fieldAnchors,
  findNode,
  loadClientDefinition,
  openSettingsPage,
  settingsSection,
  textOf,
} from './helpers/client-fixture.js';

// The settings page renders four task cards over one host configuration form.
// These tests drive the page the way a user does — find a control by its field
// anchor, change it, save — so a dropped field, a draft that writes the wrong
// value, or a save that loses its revision fence turns them red.

const definition = loadClientDefinition();

function open(options = {}) {
  return openSettingsPage({
    definition,
    section: options.section ?? settingsSection(),
    ...options,
  });
}

const saveButton = (tree) => findNode(tree, (entry) => entry.type === 'button' && textOf(entry) === 'Save');
const anchorIn = (tree, key) => {
  const anchors = fieldAnchors(tree, key);
  assert.equal(anchors.length, 1, `${key} must render exactly one anchor`);
  return anchors[0];
};

test('the page draws four cards and every settings field exactly once', async () => {
  const page = await open();
  const tree = page.getTree();
  for (const card of ['search', 'fetch', 'backends', 'routing']) {
    assert.equal(findAll(tree, (entry) => entry.props?.['data-card'] === card).length, 1, `card ${card} must render`);
  }
  const missing = [];
  const duplicated = [];
  for (const spec of SETTINGS_SPEC) {
    const anchors = fieldAnchors(tree, spec.key);
    if (anchors.length === 0) missing.push(spec.key);
    if (anchors.length > 1) duplicated.push(spec.key);
  }
  assert.deepEqual(missing, [], 'a field with no anchor is a setting nobody can change');
  assert.deepEqual(duplicated, [], 'a field rendered twice would save from two controls');
});

test('the folded groups render their fields and can be opened', async () => {
  const page = await open();
  const tree = page.getTree();
  const folded = ['qualityMaxEngines', 'enrichTopN', 'requestTimeoutMs', 'fallbackFailureClasses'];
  for (const key of folded) anchorIn(tree, key);
  const toggle = findNode(tree, (entry) => entry.type === 'button' && textOf(entry) === '▸ Quality parameters');
  assert.ok(toggle, 'the quality group header must render');
  toggle.props.onClick();
  const opened = await page.settle();
  assert.ok(findNode(opened, (entry) => entry.type === 'button' && textOf(entry) === '▾ Quality parameters'),
    'clicking the group header must open it');
});

test('changing a switch, a number and a menu stages a save that writes them with the revision it started from', async () => {
  const page = await open();
  let tree = page.getTree();

  const rerank = anchorIn(tree, 'qualityRerankEnabled');
  findNode(rerank, (entry) => entry.props?.role === 'switch').props.onClick();
  tree = await page.settle();

  const engines = anchorIn(tree, 'qualityMaxEngines');
  findNode(engines, (entry) => entry.type === 'input').props.onChange({ target: { value: '6' } });
  tree = await page.settle();

  const mode = anchorIn(tree, 'searchMode');
  const anchorButton = findNode(mode, (entry) => entry.type === 'button' && textOf(entry) === 'Search mode: Quality');
  anchorButton.props.onClick();
  tree = await page.settle();
  const fastItem = findNode(tree, (entry) => entry.type === 'button' && entry.props?.['data-id'] === 'fast');
  fastItem.props.onClick();
  tree = await page.settle();

  const save = saveButton(tree);
  assert.equal(save.props.disabled, false, 'three staged edits must enable the save');
  save.props.onClick();
  await page.settle();

  assert.equal(page.harness.formMutateCalls.length, 1, 'one save is one mutation');
  const call = page.harness.formMutateCalls[0];
  assert.equal(call.expectedRevision, 1, 'the save must fence itself with the revision its drafts started from');
  const byKey = (key) => call.ops.find((operation) => operation.path[0] === key);
  const plain = (value) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(byKey('qualityRerankEnabled')), { op: 'set', path: ['qualityRerankEnabled'], value: false });
  assert.deepEqual(plain(byKey('qualityMaxEngines')), { op: 'set', path: ['qualityMaxEngines'], value: 6 },
    'a number field must write a number, not the draft text');
  assert.deepEqual(plain(byKey('searchMode')), { op: 'set', path: ['searchMode'], value: 'fast' });
});

test('an out-of-range number blocks the save instead of sending it', async () => {
  const page = await open();
  const engines = anchorIn(page.getTree(), 'qualityMaxEngines');
  findNode(engines, (entry) => entry.type === 'input').props.onChange({ target: { value: '99' } });
  const tree = await page.settle();
  assert.equal(saveButton(tree).props.disabled, true, 'a number outside the spec bounds must block the save');
  saveButton(tree).props.onClick();
  await page.settle();
  assert.equal(page.harness.formMutateCalls.length, 0, 'a blocked save must not reach the host');
});

test('saving a key writes it to the backend reference and clearing unset every configured key', async () => {
  let configured = { KEENABLE_API_KEY: { configured: true, masked: 'ke_***' } };
  const page = await open({
    credentialsDescribe: () => ({ ok: true, value: configured }),
    setCredential: () => ({ ok: true }),
    unsetCredential: () => ({ ok: true }),
  });
  let tree = page.getTree();

  const backend = findAll(tree, (entry) => entry.props?.['data-backend'] === 'keenable');
  assert.equal(backend.length, 1, 'the Keenable group must render');
  const slot = findNode(tree, (entry) => entry.props?.['data-secret'] === 'keenable:1');
  assert.ok(slot, 'a configured backend must show its first key box');
  assert.equal(configured.KEENABLE_API_KEY.configured, true);
  const secretInput = findNode(slot, (entry) => entry.type === 'input');
  secretInput.props.onChange({ target: { value: 'fresh-key' } });
  tree = await page.settle();
  const saveKey = findAll(tree, (entry) => entry.type === 'button' && textOf(entry) === 'Save key');
  assert.ok(saveKey.length > 0, 'each backend must offer a key save');
  const keenable = findAll(tree, (entry) => entry.props?.['data-backend-actions'] === 'keenable')[0];
  findNode(keenable, (entry) => entry.type === 'button' && textOf(entry) === 'Save key').props.onClick();
  await page.settle();
  assert.deepEqual(page.harness.credentialSetCalls.filter((call) => call[0] === 'KEENABLE_API_KEY'), [['KEENABLE_API_KEY', 'fresh-key']],
    'saving a key must write the reference the backend names');

  // Clearing is a two-step gesture: the first click only arms the confirm.
  tree = page.getTree();
  const actions = findAll(tree, (entry) => entry.props?.['data-backend-actions'] === 'keenable')[0];
  const clear = findNode(actions, (entry) => entry.type === 'button' && textOf(entry) === 'Clear all keys');
  assert.ok(clear, 'the clear control must render');
  clear.props.onClick();
  tree = await page.settle();
  const armed = findNode(findAll(tree, (entry) => entry.props?.['data-backend-actions'] === 'keenable')[0],
    (entry) => entry.type === 'button' && textOf(entry) === 'Click again to clear');
  assert.ok(armed, 'the first click must ask for confirmation');
  armed.props.onClick();
  await page.settle();
  assert.ok(page.harness.credentialUnsetCalls.includes('KEENABLE_API_KEY'),
    'confirming must unset the configured key');
});

test('every backend row reports a credential state that matches its own key kind', async () => {
  const page = await open();
  const tree = page.getTree();
  const stateText = (id) => {
    const row = findAll(tree, (entry) => entry.props?.['data-backend'] === id)[0];
    assert.ok(row, `the ${id} row must render`);
    const dot = findNode(row, (entry) => entry.props?.['data-state'] !== undefined && entry.type === 'span');
    assert.ok(dot, `the ${id} row must carry a status dot`);
    const text = textOf(row);
    return text;
  };
  // Nothing is configured in a fresh profile, and every backend starts enabled.
  assert.match(stateText('exa'), /Missing credentials/u, 'a backend that requires a key and has none is missing credentials');
  assert.match(stateText('anysearch'), /Works anonymously/u, 'a backend whose key is optional runs anonymously');
  assert.match(stateText('github'), /Works anonymously/u, 'a PAT only raises the allowance, so the key stays optional');
  assert.match(stateText('bing'), /No key needed/u, 'a backend with no credential at all needs no key');
  assert.match(stateText('aihot'), /No key needed/u, 'a backend with no credential at all needs no key');
});

test('a backend whose switch is off reports that it is off', async () => {
  const page = await open();
  let tree = page.getTree();
  const row = findAll(tree, (entry) => entry.props?.['data-backend'] === 'bing')[0];
  const toggle = findNode(row, (entry) => entry.type === 'button' && entry.props?.role === 'switch');
  assert.ok(toggle, 'every backend row must offer an enable switch');
  toggle.props.onClick();
  tree = await page.settle();
  const off = findAll(tree, (entry) => entry.props?.['data-backend'] === 'bing')[0];
  assert.match(textOf(off), /Off/u, 'a disabled backend must say so');
});

test('credential reads stay batched under the host limit', async () => {  const page = await open();
  assert.ok(page.harness.credentialsDescribeCalls.length >= 2,
    'eighty-eight references must not ride one describe call');
  for (const batch of page.harness.credentialsDescribeCalls) {
    assert.ok(Array.isArray(batch), 'a describe argument must be a reference list');
    assert.ok(batch.length <= 64, `a batch of ${batch.length} exceeds the host limit`);
  }
});

test('the page says it is loading before the host answers, not that the namespace is gone', async () => {
  const loading = await open({
    section: { status: 'loading', value: undefined, base: undefined, user: undefined, revision: undefined, writable: false },
  });
  const text = textOf(loading.getTree());
  assert.match(text, /Loading settings/u, 'the first read is loading and the page must say so');
  const unavailable = await open({
    section: { status: 'unavailable', value: undefined, base: undefined, user: undefined, revision: undefined, writable: false },
  });
  assert.match(textOf(unavailable.getTree()), /does not serve this plugin/u,
    'a namespace the host never serves must say so instead of rendering dead controls');
});

test('both dictionaries carry the same keys and every rendered string resolves', async () => {
  const page = await open();
  const bundle = page.harness.dicts.dshWebSearchSettings;
  assert.ok(bundle?.en !== undefined && bundle?.zh !== undefined, 'the page registers both dictionaries');
  const enKeys = Object.keys(bundle.en).sort();
  const zhKeys = Object.keys(bundle.zh).sort();
  assert.deepEqual(enKeys, zhKeys, 'one dictionary holding a key the other lacks means one language ships a raw key');
  const missing = [];
  for (const key of enKeys) {
    if (typeof bundle.en[key] !== 'string' || bundle.en[key].length === 0) missing.push(`en:${key}`);
    if (typeof bundle.zh[key] !== 'string' || bundle.zh[key].length === 0) missing.push(`zh:${key}`);
  }
  assert.deepEqual(missing, []);
  const tree = page.getTree();
  const rendered = textOf(tree);
  assert.equal(/undefined/u.test(rendered), false, 'an undefined interpolation means a missing prop');
});