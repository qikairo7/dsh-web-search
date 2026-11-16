import { test } from 'node:test';
import assert from 'node:assert/strict';

import { layerOf, findViolations } from '../scripts/check-architecture.mjs';

test('layerOf classifies lib files', () => {
  assert.equal(layerOf('lib/index.js'), 'index');
  assert.equal(layerOf('lib/providers/bing.js'), 'provider');
  assert.equal(layerOf('lib/tools/anysearch.mjs'), 'provider');
  assert.equal(layerOf('lib/settings.js'), 'shared');
  assert.equal(layerOf('scripts/check-syntax.mjs'), null);
  assert.equal(layerOf('test/bing.test.js'), null);
});

test('shared modules must not import providers or index', () => {
  assert.deepEqual(findViolations('lib/settings.js', ['./errors.js']), []);
  assert.equal(findViolations('lib/errors.js', ['./providers/bing.js']).length, 1);
  assert.equal(findViolations('lib/errors.js', ['./index.js']).length, 1);
});

test('providers must not import index', () => {
  assert.deepEqual(findViolations('lib/providers/bing.js', ['../settings.js']), []);
  assert.equal(findViolations('lib/providers/bing.js', ['../index.js']).length, 1);
});

test('bare package imports are not governed', () => {
  assert.deepEqual(findViolations('lib/settings.js', ['node:path', 'zod']), []);
});
