import test from 'node:test';
import assert from 'node:assert/strict';

import { loadClientDefinition } from './helpers/client-fixture.js';

// Values built inside the vm context have foreign prototypes; normalize before deepEqual.
const plain = (value) => JSON.parse(JSON.stringify(value));

const { splitKeyInput, planKeyWrites, applyKeyPlan, beginKeySave, saveKey } = loadClientDefinition();
const REFS = ['KEY', 'KEY_2', 'KEY_3', 'KEY_4', 'KEY_5', 'KEY_6', 'KEY_7', 'KEY_8'];

test('splits a pasted key box on commas and whitespace', () => {
  assert.deepEqual(plain(splitKeyInput('k1,k2')), ['k1', 'k2']);
  assert.deepEqual(plain(splitKeyInput('k1 k2')), ['k1', 'k2']);
  assert.deepEqual(plain(splitKeyInput('  k1 ,  k2,\n k3  ')), ['k1', 'k2', 'k3']);
  assert.deepEqual(plain(splitKeyInput('k1，k2')), ['k1', 'k2']);
});

test('an all-separator value yields no keys', () => {
  assert.deepEqual(plain(splitKeyInput('  , ,\n ')), []);
  assert.deepEqual(plain(splitKeyInput('')), []);
});

test('writes a single key to the first free ref', () => {
  const plan = planKeyWrites([{ ref: null, value: ' a ' }], REFS, {});
  assert.deepEqual(plain(plan), { writes: [{ ref: 'KEY', value: 'a' }], overflow: false });
});

test('writes pasted keys to consecutive numbered refs', () => {
  const plan = planKeyWrites([{ ref: null, value: 'k1, k2 k3' }], REFS, {});
  assert.deepEqual(plain(plan.writes), [
    { ref: 'KEY', value: 'k1' },
    { ref: 'KEY_2', value: 'k2' },
    { ref: 'KEY_3', value: 'k3' },
  ]);
  assert.equal(plan.overflow, false);
});

test('skips refs that are already configured', () => {
  const rows = [{ ref: 'KEY', value: '' }, { ref: null, value: 'k2' }];
  const plan = planKeyWrites(rows, REFS, { KEY: { configured: true } });
  assert.deepEqual(plain(plan.writes), [{ ref: 'KEY_2', value: 'k2' }]);
});

test('refuses a paste that exceeds the eight-ref limit', () => {
  const ten = Array.from({ length: 10 }, (_, index) => `k${index + 1}`).join(',');
  const plan = planKeyWrites([{ ref: null, value: ten }], REFS, {});
  assert.equal(plan.overflow, true);
  assert.equal(plan.writes.length, 8);
});

test('counts existing keys toward the eight-ref limit', () => {
  const rows = REFS.slice(0, 6).map((ref) => ({ ref, value: '' })).concat([{ ref: null, value: 'n1,n2,n3' }]);
  const credentials = Object.fromEntries(REFS.slice(0, 6).map((ref) => [ref, { configured: true }]));
  const plan = planKeyWrites(rows, REFS, credentials);
  assert.equal(plan.overflow, true);
  assert.equal(plan.writes.length, 2);
});

test('an overflowing plan writes no credentials', async () => {
  const ten = Array.from({ length: 10 }, (_, index) => `k${index + 1}`).join(',');
  const plan = planKeyWrites([{ ref: null, value: ten }], REFS, {});
  const calls = [];
  const status = await applyKeyPlan(plan, (ref, value) => {
    calls.push([ref, value]);
    return { ok: true };
  });
  assert.equal(status, 'overflow');
  assert.equal(calls.length, 0);
});

test('a ready plan writes every key once in order', async () => {
  const plan = planKeyWrites([{ ref: null, value: 'k1 k2' }], REFS, {});
  const calls = [];
  const status = await applyKeyPlan(plan, (ref, value) => {
    calls.push([ref, value]);
    return { ok: true };
  });
  assert.equal(status, 'saved');
  assert.deepEqual(plain(calls), [['KEY', 'k1'], ['KEY_2', 'k2']]);
});

test('an empty plan writes nothing', async () => {
  const plan = planKeyWrites([{ ref: null, value: '  , ' }], REFS, {});
  const calls = [];
  const status = await applyKeyPlan(plan, () => {
    calls.push('x');
    return { ok: true };
  });
  assert.equal(status, 'empty');
  assert.equal(calls.length, 0);
});

test('invalid input never raises the busy saving state', () => {
  const ten = Array.from({ length: 10 }, (_, index) => `k${index + 1}`).join(',');
  const overflow = planKeyWrites([{ ref: null, value: ten }], REFS, {});
  const empty = planKeyWrites([{ ref: null, value: '  , ' }], REFS, {});
  for (const plan of [overflow, empty]) {
    const busy = [];
    assert.equal(beginKeySave(plan, (value) => busy.push(value)), false);
    assert.deepEqual(busy, []);
  }
});

test('valid input raises the busy saving state exactly once', () => {
  const plan = planKeyWrites([{ ref: null, value: 'k1 k2' }], REFS, {});
  const busy = [];
  assert.equal(beginKeySave(plan, (value) => busy.push(value)), true);
  assert.deepEqual(busy, [true]);
});

// Wiring coverage: the real save path (saveKey) must refuse invalid plans before touching busy,
// so the #117 flashing write (setBusy before the gate) turns these tests red.
test('saveKey refuses invalid input without raising busy', async () => {
  const ten = Array.from({ length: 10 }, (_, index) => `k${index + 1}`).join(',');
  const cases = [
    { plan: planKeyWrites([{ ref: null, value: ten }], REFS, {}), prompt: 'tooManyKeys' },
    { plan: planKeyWrites([{ ref: null, value: '  , ' }], REFS, {}), prompt: 'enterKey' },
  ];
  for (const { plan, prompt } of cases) {
    const busy = [];
    const prompts = [];
    let writes = 0;
    await saveKey({
      plan,
      setBusy: (value) => busy.push(value),
      setCredential: () => { writes += 1; return { ok: true }; },
      onRefused: (kind) => prompts.push(kind),
      onSaved: () => prompts.push('saved'),
      onFailed: () => prompts.push('failed'),
    });
    assert.deepEqual(busy, [], 'invalid input must not raise busy');
    assert.equal(writes, 0, 'invalid input must not write credentials');
    assert.deepEqual(prompts, [prompt]);
  }
});

test('saveKey writes a valid plan and lowers busy after saving', async () => {
  const plan = planKeyWrites([{ ref: null, value: 'k1 k2' }], REFS, {});
  const calls = [];
  const busy = [];
  await saveKey({
    plan,
    setBusy: (value) => busy.push(value),
    setCredential: (ref, value) => { calls.push([ref, value]); return { ok: true }; },
    onRefused: (kind) => calls.push(['refused', kind]),
    onSaved: () => calls.push(['saved']),
    onFailed: () => calls.push(['failed']),
  });
  assert.deepEqual(plain(calls), [['KEY', 'k1'], ['KEY_2', 'k2'], ['saved']]);
  assert.deepEqual(busy, [true, false]);
});

test('saveKey lowers busy after a failed write', async () => {
  const plan = planKeyWrites([{ ref: null, value: 'k1' }], REFS, {});
  const busy = [];
  const events = [];
  await saveKey({
    plan,
    setBusy: (value) => busy.push(value),
    setCredential: () => ({ ok: false }),
    onRefused: (kind) => events.push(['refused', kind]),
    onSaved: () => events.push('saved'),
    onFailed: () => events.push('failed'),
  });
  assert.deepEqual(events, ['failed']);
  assert.deepEqual(busy, [true, false]);
});
