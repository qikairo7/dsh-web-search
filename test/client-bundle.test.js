import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

function loadClientBundle() {
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

test('client bundle registers a browser half for the package', () => {
  const definition = loadClientBundle();
  assert.equal(definition.id, pkg.name);
  const React = {
    createElement: () => ({}),
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
  };
  const plugin = definition.factory((name) => {
    assert.equal(name, 'react');
    return React;
  });
  assert.deepEqual([...plugin.inject], ['slots', 'locale', 'remote', 'remote.settings', 'remote.credentials']);
  assert.equal(typeof plugin.apply, 'function');
});

test('client bundle contributes the bundle settings page', () => {
  const plugin = loadClientBundle().factory(() => ({
    createElement: () => ({}),
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
  }));
  const registrations = [];
  const injected = [];
  const ctx = {
    effect: (fn) => fn(),
    locale: {
      register: () => {},
      bind: () => (key) => key,
    },
    slots: {
      inject: (name, callback) => {
        injected.push(name);
        return callback();
      },
      register: (entry) => {
        registrations.push(entry);
        return () => {};
      },
    },
  };
  plugin.apply(ctx);
  assert.deepEqual(injected, ['plugins.bundle.config']);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].name, 'plugins.bundle.config');
  assert.equal(registrations[0].key, pkg.name);
});

test('package manifest points at the client bundle', () => {
  assert.equal(pkg.exports['./client'], './client.js');
  assert.equal(pkg.files.includes('client.js'), true);
  assert.equal(pkg.dsh.client.platform, 'web');
  assert.equal(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-plugin-manager'), true);
});
