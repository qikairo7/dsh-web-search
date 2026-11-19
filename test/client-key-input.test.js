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

// Values built inside the vm context have foreign prototypes; normalize before deepEqual.
const plain = (value) => JSON.parse(JSON.stringify(value));

const { splitKeyInput, planKeyWrites } = loadDefinition();
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
