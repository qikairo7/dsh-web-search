import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadDefinition() {
  let definition;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(value) { definition = value; },
      },
    },
  };
  vm.runInNewContext(readFileSync('client.js', 'utf8'), sandbox);
  return definition;
}

const { handleKeySave } = loadDefinition();
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
