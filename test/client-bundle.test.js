import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  createFakeCtx,
  createFakeReact,
  createFakeRequire,
  loadClientDefinition,
} from './helpers/client-fixture.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

test('client bundle registers a browser half for the package', () => {
  const definition = loadClientDefinition();
  assert.equal(definition.id, pkg.name);
  const plugin = definition.factory(createFakeRequire(createFakeReact().React));
  assert.deepEqual([...plugin.inject], ['slots', 'locale', 'remote', 'remote.credentials', 'configForms'],
    'the page reads the host configuration form and the credential store, so those services must be declared');
  assert.equal(typeof plugin.apply, 'function');
});

test('client bundle contributes the bundle settings page', () => {
  const plugin = loadClientDefinition().factory(createFakeRequire(createFakeReact().React));
  const harness = createFakeCtx();
  plugin.apply(harness.ctx);
  assert.deepEqual(harness.registrations, ['plugins.bundle.config']);
  assert.equal(harness.pages.length, 1);
  assert.deepEqual(harness.pages.map((entry) => entry.spec.name), ['plugins.bundle.config']);
  assert.equal(harness.pages[0].spec.key, pkg.name);
});

test('package manifest points at the client bundle', () => {
  assert.equal(pkg.exports['./client'], './client.js');
  assert.equal(pkg.files.includes('client.js'), true);
  assert.equal(pkg.dsh.client.platform, 'web');
  assert.equal(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-plugin-manager'), true);
});