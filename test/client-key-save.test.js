import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findAll,
  findNode,
  loadClientDefinition,
  openSettingsPage,
  settingsSection,
  textOf,
} from './helpers/client-fixture.js';

// Credential writes ride the host credential store, not the settings document: a key
// typed into a backend's box goes to that backend's reference, a failed write is
// reported in place, and the boxes clear only after the host accepted the write.

const definition = loadClientDefinition();

function open(options = {}) {
  return openSettingsPage({
    definition,
    section: settingsSection(),
    credentialsDescribe: options.credentialsDescribe ?? (() => ({ ok: true, value: {} })),
    setCredential: options.setCredential ?? (() => ({ ok: true })),
    unsetCredential: () => ({ ok: true }),
  });
}

const actionsOf = (tree, backend) => findAll(tree, (entry) => entry.props?.['data-backend-actions'] === backend)[0];
const keyInputOf = (tree, slot) => findNode(
  findAll(tree, (entry) => entry.props?.['data-secret'] === slot)[0],
  (entry) => entry.type === 'input',
);
const saveKeysOf = (tree, backend) => findNode(actionsOf(tree, backend),
  (entry) => entry.type === 'button' && textOf(entry) === 'Save key');

test('a key typed into a configured backend box is written to that backend reference', async () => {
  const page = await open({
    credentialsDescribe: () => ({ ok: true, value: { KEENABLE_API_KEY: { configured: true, masked: 'ke_***' } } }),
  });
  let tree = page.getTree();
  const input = keyInputOf(tree, 'keenable:1');
  assert.ok(input, 'a configured backend must offer a key box');
  input.props.onChange({ target: { value: 'fresh-key' } });
  tree = await page.settle();
  saveKeysOf(tree, 'keenable').props.onClick();
  tree = await page.settle();

  assert.deepEqual(page.harness.credentialSetCalls, [['KEENABLE_API_KEY', 'fresh-key']],
    'the write must target the reference the backend names');
  assert.equal(keyInputOf(tree, 'keenable:1').props.value, '', 'an accepted write clears the box');
  const confirm = findAll(tree, (entry) => entry.props?.['data-message'] === 'keenable')[0];
  assert.match(textOf(confirm), /Saved a key/u, 'the backend must confirm the write');
});

test('a failed credential write is reported in place and leaves the box usable', async () => {
  const page = await open({
    credentialsDescribe: () => ({ ok: true, value: { KEENABLE_API_KEY: { configured: true, masked: 'ke_***' } } }),
    setCredential: () => ({ ok: false }),
  });
  let tree = page.getTree();
  keyInputOf(tree, 'keenable:1').props.onChange({ target: { value: 'fresh-key' } });
  tree = await page.settle();
  saveKeysOf(tree, 'keenable').props.onClick();
  tree = await page.settle();

  assert.deepEqual(page.harness.credentialSetCalls, [['KEENABLE_API_KEY', 'fresh-key']],
    'a refused write still attempted the write once');
  const message = findAll(tree, (entry) => entry.props?.['data-message'] === 'keenable')[0];
  assert.ok(message, 'the failure must render in the backend group');
  assert.match(textOf(message), /could not be saved/u);
  assert.equal(findNode(actionsOf(tree, 'keenable'), (entry) => entry.type === 'button' && textOf(entry) === 'Save key').props.disabled,
    false, 'a failed write must leave the control usable');
});

test('a box holding more than one key is refused instead of writing a partial batch', async () => {
  const page = await open({
    credentialsDescribe: () => ({ ok: true, value: { KEENABLE_API_KEY: { configured: true, masked: 'ke_***' } } }),
  });
  let tree = page.getTree();
  keyInputOf(tree, 'keenable:1').props.onChange({ target: { value: 'k1 k2' } });
  tree = await page.settle();
  saveKeysOf(tree, 'keenable').props.onClick();
  tree = await page.settle();

  assert.deepEqual(page.harness.credentialSetCalls, [], 'one box carries one key; a list must not be half-written');
  const message = findAll(tree, (entry) => entry.props?.['data-message'] === 'keenable')[0];
  assert.match(textOf(message), /One key per box/u);
});

test('add key grows the backend with another empty box and remove drops it again', async () => {
  const page = await open();
  let tree = page.getTree();
  assert.equal(findAll(tree, (entry) => entry.props?.['data-secret'] === 'keenable:2').length, 0,
    'a backend with no configured keys starts with one box');
  findNode(actionsOf(tree, 'keenable'), (entry) => entry.type === 'button' && textOf(entry) === 'Add key').props.onClick();
  tree = await page.settle();
  assert.equal(findAll(tree, (entry) => entry.props?.['data-secret'] === 'keenable:2').length, 1,
    'add key must render a second box');
  const second = findAll(tree, (entry) => entry.props?.['data-secret'] === 'keenable:2');
  findNode(second[0], (entry) => entry.type === 'button' && textOf(entry) === 'Remove').props.onClick();
  tree = await page.settle();
  assert.equal(findAll(tree, (entry) => entry.props?.['data-secret'] === 'keenable:2').length, 0,
    'removing an empty box must drop it');
  assert.deepEqual(page.harness.credentialUnsetCalls, [], 'an empty box has no credential to unset');
});

test('the X backend takes a cookie through the same credential store', async () => {
  const page = await open();
  let tree = page.getTree();
  const input = keyInputOf(tree, 'x:1');
  assert.ok(input, 'the cookie backend must offer its box');
  input.props.onChange({ target: { value: 'cookie-value' } });
  tree = await page.settle();
  saveKeysOf(tree, 'x').props.onClick();
  await page.settle();
  assert.deepEqual(page.harness.credentialSetCalls, [['X_COOKIE', 'cookie-value']],
    'the cookie must be written under the reference the backend names');
});