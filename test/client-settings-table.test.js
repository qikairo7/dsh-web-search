import test from 'node:test';
import assert from 'node:assert/strict';

import { SETTINGS_SPEC } from '../lib/settings.js';
import { loadClientDefinition } from './helpers/client-fixture.js';

// The page's field table is a second copy of the settings metadata, because the
// browser half is a classic script that cannot import `lib/settings.js`. These
// tests keep the copy honest: a field added to `SETTINGS_SPEC` without a row, a
// row whose bounds drift, or a row pointing at a card that does not exist all go
// red here instead of silently rendering a control nobody can trust.

// Values built inside the vm context have foreign prototypes; normalize before deepEqual.
const plain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

const { SETTINGS_UI, BACKENDS, CARDS } = loadClientDefinition();

const CONTROLS = new Set(['switch', 'number', 'text', 'menu', 'secret', 'checkgroup']);
const LEVELS = new Set(['common', 'advanced']);
const CARD_IDS = new Set(CARDS.map((card) => card.id));
const BACKEND_IDS = new Set(BACKENDS.map((backend) => backend.id));
const KEY_KINDS = new Set(['required', 'optional', 'none']);

function rowFor(key) {
  return SETTINGS_UI.find((row) => row.key === key);
}

test('the field table has one row per settings spec entry', () => {
  assert.equal(SETTINGS_SPEC.length, 88, 'the spec is the authority on how many fields exist');
  assert.equal(SETTINGS_UI.length, SETTINGS_SPEC.length, 'every setting needs exactly one row');
  assert.deepEqual(
    [...SETTINGS_UI.map((row) => row.key)].sort(),
    SETTINGS_SPEC.map((spec) => spec.key).sort(),
    'the row keys must equal the spec keys, in both directions',
  );
});

test('no two rows share a key', () => {
  const seen = new Set();
  const duplicates = [...SETTINGS_UI].filter((row) => {
    if (seen.has(row.key)) return true;
    seen.add(row.key);
    return false;
  }).map((row) => row.key);
  assert.deepEqual(duplicates, [], 'a duplicated key would render one field twice');
});

test('every row mirrors the spec kind, bounds and enum members', () => {
  const mismatches = [];
  for (const spec of SETTINGS_SPEC) {
    const row = rowFor(spec.key);
    if (row === undefined) continue;
    if (row.kind !== spec.kind) mismatches.push(`${spec.key}: kind ${row.kind} != ${spec.kind}`);
    if (row.min !== spec.min) mismatches.push(`${spec.key}: min ${row.min} != ${spec.min}`);
    if (row.max !== spec.max) mismatches.push(`${spec.key}: max ${row.max} != ${spec.max}`);
    const options = plain(row.options);
    if (spec.values === undefined) {
      if (options !== undefined) mismatches.push(`${spec.key}: has options the spec does not declare`);
    } else if (JSON.stringify(options) !== JSON.stringify([...spec.values])) {
      mismatches.push(`${spec.key}: options ${JSON.stringify(options)} != ${JSON.stringify([...spec.values])}`);
    }
  }
  assert.deepEqual(mismatches, []);
});

test('every row names a known card, level and control', () => {
  const invalid = [...SETTINGS_UI].filter((row) => !CARD_IDS.has(row.card)
    || !LEVELS.has(row.level)
    || !CONTROLS.has(row.control)
    || (row.group !== null && typeof row.group !== 'string')).map((row) => row.key);
  assert.deepEqual(invalid, [], 'a row with an unknown card, level, control or group cannot render');
});

test('each card is declared and each declared card carries fields', () => {
  assert.deepEqual([...CARDS.map((card) => card.id)], ['search', 'fetch', 'backends', 'routing']);
  for (const card of CARDS) {
    assert.ok(
      SETTINGS_UI.some((row) => row.card === card.id),
      `card ${card.id} must carry at least one field`,
    );
  }
});

test('backend groups and the backend table agree in both directions', () => {
  const groups = [...new Set(SETTINGS_UI.filter((row) => row.group !== null && row.group.startsWith('backend:'))
    .map((row) => row.group.slice('backend:'.length)))];
  assert.deepEqual([...groups].sort(), [...BACKEND_IDS].sort(),
    'every backend group needs a table row, and no row may name a group with no fields');
  assert.equal(BACKENDS.length, 12,
    'twelve backend groups: eleven provider ids minus the zhihu-site alias plus SiliconFlow and X search');
});

test('every backend row names fields that exist and a toggle that exists', () => {
  const invalid = [...BACKENDS].filter((backend) => !SETTINGS_UI.some((row) => row.key === backend.toggleKey))
    .map((backend) => `${backend.id}: ${backend.toggleKey}`);
  assert.deepEqual(invalid, [], 'the header switch must drive a real field');
  const refs = [...BACKENDS].filter((backend) => backend.refKey !== null && !SETTINGS_UI.some((row) => row.key === backend.refKey))
    .map((backend) => `${backend.id}: ${backend.refKey}`);
  assert.deepEqual(refs, [], 'the credential reference must be a real field');
  const needingKeyWithoutRef = [...BACKENDS].filter((backend) => backend.needsKey && backend.refKey === null)
    .map((backend) => backend.id);
  assert.deepEqual(needingKeyWithoutRef, [], 'a backend that needs a key must name its reference field');
});

test('every backend says how it treats its credential', () => {
  const unknown = [...BACKENDS].filter((backend) => !KEY_KINDS.has(backend.keyKind)).map((backend) => backend.id);
  assert.deepEqual(unknown, [], 'a backend without a key kind cannot report its credential state');
  const inconsistent = [...BACKENDS]
    .filter((backend) => (backend.keyKind === 'none') !== (backend.refKey === null))
    .map((backend) => backend.id);
  assert.deepEqual(inconsistent, [],
    'a backend with no credential must name no reference, and one with a reference must declare how it is treated');
});

test('the keyless backends are the ones the provider code runs without a credential', () => {
  // Read off `lib/providers/`: bing, aihot and http carry no credential field at
  // all; anysearch, keenable and github run anonymously and a key only raises
  // the allowance; exa, tavily, firecrawl, zhihu, x and siliconflow refuse to
  // run without one.
  const expected = {
    anysearch: 'optional',
    keenable: 'optional',
    exa: 'required',
    bing: 'none',
    github: 'optional',
    tavily: 'required',
    firecrawl: 'required',
    zhihu: 'required',
    aihot: 'none',
    http: 'none',
    x: 'required',
    siliconflow: 'required',
  };
  const actual = Object.fromEntries(BACKENDS.map((backend) => [backend.id, backend.keyKind]));
  assert.deepEqual(actual, expected,
    'the credential state a backend reports must match what its provider code accepts');
});