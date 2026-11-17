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

test('JSDoc import() mentions are not treated as imports (R-ghost-specifier regression)', async () => {
  const { default: fs } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const tmp = await fs.mkdtemp(tmpdir() + '/arch-jsdoc-');
  const f = tmp + '/probe.mjs';
  await fs.writeFile(f, "/** Docs say import('../lib/providers/x.js') works. */\nexport const a = 1;\n", 'utf8');
  const { extractSpecifiers } = await import('../scripts/check-architecture.mjs');
  const specifiers = await extractSpecifiers(f);
  assert.deepEqual(specifiers, []);
  await fs.rm(tmp, { recursive: true, force: true });
});
