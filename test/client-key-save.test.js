import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findNode,
  loadClientDefinition,
  openSettingsPage,
  textOf,
} from './helpers/client-fixture.js';

const { handleKeySave } = loadClientDefinition();
const BASE = 'TAVILY_API_KEY';

// Component-level coverage for the factory's former inline handleSaveKey: it builds the
// write plan from the provider's current rows and the target reference, then drives the
// busy state and result callbacks through saveKey (#174). If the exported handler is
// removed or its plan wiring changes, these tests go red.

test('a valid save writes every planned key with one busy raise and one lower', async () => {
  const busy = [];
  const writes = [];
  await handleKeySave({
    rows: [{ ref: null, value: 'k1 k2' }],
    ref: BASE,
    setBusy: (value) => busy.push(value),
    setCredential: async (ref, value) => { writes.push([ref, value]); return { ok: true }; },
    onRefused: () => {},
    onSaved: async () => {},
    onFailed: () => {},
  });
  assert.deepEqual(writes, [[BASE, 'k1'], [`${BASE}_2`, 'k2']]);
  assert.deepEqual(busy, [true, false], 'busy must rise exactly once and fall exactly once');
});

test('invalid input is refused without raising busy or writing keys', async () => {
  const busy = [];
  const refused = [];
  let writes = 0;
  await handleKeySave({
    rows: [{ ref: null, value: '  , ' }],
    ref: BASE,
    setBusy: (value) => busy.push(value),
    setCredential: async () => { writes += 1; return { ok: true }; },
    onRefused: (kind) => refused.push(kind),
    onSaved: async () => refused.push('saved'),
    onFailed: () => refused.push('failed'),
  });
  assert.deepEqual(busy, [], 'invalid input must never raise the saving state');
  assert.equal(writes, 0, 'invalid input must never write a credential');
  assert.deepEqual(refused, ['enterKey']);
});

test('a failed write keeps the attempted write and still lowers busy', async () => {
  const busy = [];
  const writes = [];
  const events = [];
  await handleKeySave({
    rows: [{ ref: null, value: 'k1 k2' }],
    ref: BASE,
    setBusy: (value) => busy.push(value),
    setCredential: async (ref, value) => { writes.push([ref, value]); return { ok: false }; },
    onRefused: (kind) => events.push(['refused', kind]),
    onSaved: async () => events.push('saved'),
    onFailed: () => events.push('failed'),
  });
  assert.deepEqual(writes, [[BASE, 'k1']], 'the first planned write is attempted before failing');
  assert.deepEqual(events, ['failed']);
  assert.deepEqual(busy, [true, false], 'a failed save must still lower busy');
});

// ---- Factory-closure coverage: drive the settings page save button end to end (#190) ----
// The tests above feed the module-level handleKeySave its callbacks directly, so they stay green
// even when the factory closure is broken. These tests render the real SettingsPage through the
// factory and click the real Save button, so a stray busy raise, a dropped refresh(false), or a
// dropped failure notice inside that closure turns them red.

const ERROR_TEXT_COLOR = 'var(--dsw-alias-state-error-primary)';

function mountSettingsPage(definition, behavior) {
  return openSettingsPage({
    definition,
    describe: behavior.describe,
    credentialsDescribe: behavior.credentialsDescribe,
    setCredential: behavior.set,
    mutate: () => ({ ok: true }),
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

test('a successful factory save writes the key, refreshes once without resetting the draft, and shows the success notice', async () => {
  const page = await mountSettingsPage(loadClientDefinition(), {
    describe: () => ({ ok: true, value: namespaceValue() }),
    credentialsDescribe: () => ({ ok: true, value: {} }),
    set: () => ({ ok: true }),
  });
  const initialDescribeCalls = page.harness.settingsDescribeCalls.length;

  const card = findNode(page.getTree(), (entry) => entry.props.key === 'tavily');
  assert.ok(card, 'the tavily provider card must render');
  const input = findNode(card, (entry) => entry.type === 'input');
  input.props.onChange({ target: { value: 'k1' } });
  await page.settle();

  const modeSelect = findNode(page.getTree(), (entry) => entry.type === 'select' && entry.props['aria-label'] === 'Search mode');
  modeSelect.props.onChange({ target: { value: 'fast' } });
  await page.settle();

  const setterMark = page.fake.setterLog.length;
  const saveButton = findNode(
    findNode(page.getTree(), (entry) => entry.props.key === 'tavily'),
    (entry) => entry.type === 'button' && textOf(entry) === 'Save',
  );
  assert.ok(saveButton, 'the tavily save button must render');
  saveButton.props.onClick();
  await page.settle();

  assert.deepEqual(page.harness.credentialSetCalls, [['TAVILY_API_KEY', 'k1']], 'the save must write the key to the provider reference');
  assert.equal(page.harness.settingsDescribeCalls.length, initialDescribeCalls + 1, 'a successful save must trigger exactly one settings refresh(false)');
  const busyRaises = page.fake.setterLog.slice(setterMark).filter((entry) => entry.value === true).length;
  const busyLowers = page.fake.setterLog.slice(setterMark).filter((entry) => entry.value === false).length;
  assert.equal(busyRaises, 1, 'the save must raise busy exactly once');
  assert.equal(busyLowers, 1, 'the save must lower busy exactly once');

  const status = findNode(
    findNode(page.getTree(), (entry) => entry.props.key === 'tavily'),
    (entry) => entry.type === 'p' && entry.props.role === 'status',
  );
  assert.ok(status, 'the success notice must render in the provider card');
  assert.equal(textOf(status), 'Saved Tavily key.');
  assert.notEqual(status.props.style.color, ERROR_TEXT_COLOR, 'the success notice must not be styled as an error');

  const modeAfter = findNode(page.getTree(), (entry) => entry.type === 'select' && entry.props['aria-label'] === 'Search mode');
  assert.equal(modeAfter.props.value, 'fast', 'refresh(false) must not reset the unsaved draft back to the stored settings');
});

test('a failed factory save keeps busy down and shows an error notice without refreshing', async () => {
  const page = await mountSettingsPage(loadClientDefinition(), {
    describe: () => ({ ok: true, value: namespaceValue() }),
    credentialsDescribe: () => ({ ok: true, value: {} }),
    set: () => ({ ok: false }),
  });
  const initialDescribeCalls = page.harness.settingsDescribeCalls.length;

  const input = findNode(findNode(page.getTree(), (entry) => entry.props.key === 'tavily'), (entry) => entry.type === 'input');
  input.props.onChange({ target: { value: 'k1' } });
  await page.settle();

  const setterMark = page.fake.setterLog.length;
  const saveButton = findNode(
    findNode(page.getTree(), (entry) => entry.props.key === 'tavily'),
    (entry) => entry.type === 'button' && textOf(entry) === 'Save',
  );
  saveButton.props.onClick();
  await page.settle();

  assert.deepEqual(page.harness.credentialSetCalls, [['TAVILY_API_KEY', 'k1']], 'the failed save still attempts the planned write once');
  assert.equal(page.harness.settingsDescribeCalls.length, initialDescribeCalls, 'a failed save must not refresh');
  const busyRaises = page.fake.setterLog.slice(setterMark).filter((entry) => entry.value === true).length;
  const busyLowers = page.fake.setterLog.slice(setterMark).filter((entry) => entry.value === false).length;
  assert.equal(busyRaises, 1, 'the failed save must raise busy exactly once');
  assert.equal(busyLowers, 1, 'the failed save must lower busy exactly once');

  const card = findNode(page.getTree(), (entry) => entry.props.key === 'tavily');
  const status = findNode(card, (entry) => entry.type === 'p' && entry.props.role === 'status');
  assert.ok(status, 'the failure notice must render in the provider card');
  assert.ok(textOf(status).length > 0, 'the failure notice must not be empty');
  assert.equal(status.props.style.color, ERROR_TEXT_COLOR, 'keyMessages[provider.id].error must be true, styled as an error');

  const saveAfter = findNode(card, (entry) => entry.type === 'button' && textOf(entry) === 'Save');
  assert.equal(saveAfter.props.disabled, false, 'busy must be false after the failure, so the save button is enabled again');
});