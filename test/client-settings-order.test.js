import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { Config } from '../lib/index.js';

// The settings page works with arrays for the two order fields
// (qualityExcludedProviders, cleanExtractProviders) while the host schema stores
// them as comma-separated strings (lib/index.js kind:'order' -> z.string()). These
// tests drive the real SettingsPage through the factory: if configDraft stops
// splitting the stored string on read, or configOperations stops joining the array
// back into a string on write, they go red.

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

function createFakeReact() {
  const instances = new Map();
  const setterLog = [];
  let current = null;
  let dirty = false;
  let pendingEffects = [];

  const instanceFor = (component) => {
    let instance = instances.get(component);
    if (instance === undefined) {
      instance = { hooks: [], cursor: 0 };
      instances.set(component, instance);
    }
    return instance;
  };

  const React = {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children };
    },
    useState(initial) {
      const instance = current;
      const slot = instance.cursor++;
      if (!(slot in instance.hooks)) {
        instance.hooks[slot] = typeof initial === 'function' ? initial() : initial;
      }
      const setter = (next) => {
        setterLog.push({ value: next });
        const previous = instance.hooks[slot];
        instance.hooks[slot] = typeof next === 'function' ? next(previous) : next;
        dirty = true;
      };
      return [instance.hooks[slot], setter];
    },
    useCallback(callback) {
      const instance = current;
      const slot = instance.cursor++;
      if (!(slot in instance.hooks)) instance.hooks[slot] = callback;
      return instance.hooks[slot];
    },
    useEffect(effect) {
      const instance = current;
      const slot = instance.cursor++;
      if (!(slot in instance.hooks)) {
        instance.hooks[slot] = true;
        pendingEffects.push(effect);
      }
    },
  };

  const renderComponent = (component, props) => {
    const instance = instanceFor(component);
    const previous = current;
    current = instance;
    instance.cursor = 0;
    try {
      return component(props);
    } finally {
      current = previous;
    }
  };

  const expand = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean') return null;
    if (typeof node === 'string' || typeof node === 'number') return { text: String(node) };
    if (Array.isArray(node)) return node.map(expand).filter((child) => child !== null);
    if (typeof node.type === 'function') {
      return expand(renderComponent(node.type, { ...node.props, children: node.children }));
    }
    const children = [];
    for (const child of node.children) {
      const expanded = expand(child);
      if (expanded === null) continue;
      if (Array.isArray(expanded)) children.push(...expanded);
      else children.push(expanded);
    }
    return { type: node.type, props: node.props, children };
  };

  return {
    React,
    setterLog,
    render(factoryPage) {
      pendingEffects = [];
      dirty = false;
      const tree = expand(renderComponent(factoryPage, {}));
      for (const effect of pendingEffects) effect();
      return tree;
    },
    get dirty() {
      return dirty;
    },
  };
}

function flatten(node, out = []) {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out);
    return out;
  }
  out.push(node);
  if (node.children !== undefined) for (const child of node.children) flatten(child, out);
  return out;
}

function textOf(node) {
  if (node.text !== undefined) return node.text;
  return (node.children ?? []).map(textOf).join('');
}

function findNode(node, predicate) {
  return flatten(node).find((entry) => entry.type !== undefined && predicate(entry));
}

async function mountSettingsPage(definition, behavior) {
  const fake = createFakeReact();
  const dicts = {};
  const mutateCalls = [];
  let page = null;
  const ctx = {
    effect(effect) {
      effect();
      return () => {};
    },
    locale: {
      register(namespace, value) {
        dicts[namespace] = value;
      },
      bind(namespace) {
        const bundle = dicts[namespace] ?? {};
        const table = bundle.en ?? bundle;
        return (key, params) => {
          const template = table[key] ?? key;
          if (params === undefined) return template;
          return Object.entries(params).reduce(
            (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
            template,
          );
        };
      },
    },
    slots: {
      inject(_name, register) {
        register();
      },
      register(_spec, component) {
        page = component;
      },
    },
    remote: {
      settings: {
        async describe() {
          return behavior.describe();
        },
        async mutate(namespace, operations, revision) {
          mutateCalls.push({ namespace, operations, revision });
          return behavior.mutate();
        },
      },
      credentials: {
        async describe() {
          return behavior.credentialsDescribe();
        },
        async set() {
          return { ok: true };
        },
        async unset() {
          return { ok: true };
        },
      },
    },
  };
  const plugin = definition.factory((name) => {
    if (name === 'react') return fake.React;
    throw new Error(`unexpected require: ${name}`);
  });
  plugin.apply(ctx);
  if (page === null) throw new Error('factory did not register a settings page');

  let tree = null;
  const settle = async () => {
    for (let round = 0; round < 40; round += 1) {
      tree = fake.render(page);
      for (let tick = 0; tick < 500; tick += 1) await Promise.resolve();
      if (!fake.dirty) return tree;
    }
    throw new Error('settings page did not settle');
  };
  await settle();
  return { fake, mutateCalls, settle, getTree: () => tree };
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

function checkboxFor(tree, key) {
  const cell = findNode(tree, (entry) => entry.props !== undefined && entry.props.key === key);
  assert.ok(cell, `${key} must render`);
  return findNode(cell, (entry) => entry.type === 'input');
}

test('stored order strings rehydrate into the matching checkbox selections', async () => {
  const page = await mountSettingsPage(loadDefinition(), {
    describe: () => ({ ok: true, value: namespaceValue({ qualityExcludedProviders: 'github', cleanExtractProviders: 'keenable,anysearch' }) }),
    credentialsDescribe: () => ({ ok: true, value: {} }),
    set: () => ({ ok: true }),
    mutate: () => ({ ok: true }),
  });
  const tree = page.getTree();

  // 'github' in the stored string means GitHub is excluded from quality mode -> unchecked.
  assert.equal(checkboxFor(tree, 'quality-github').props.checked, false,
    'stored qualityExcludedProviders "github" must leave GitHub unchecked');
  assert.equal(checkboxFor(tree, 'quality-keenable').props.checked, true,
    'a provider absent from the excluded string stays checked');

  // 'keenable,anysearch' means Keenable/AnySearch extract, Exa does not -> Exa unchecked.
  assert.equal(checkboxFor(tree, 'clean-keenable').props.checked, true);
  assert.equal(checkboxFor(tree, 'clean-anysearch').props.checked, true);
  assert.equal(checkboxFor(tree, 'clean-exa').props.checked, false,
    'stored cleanExtractProviders without exa must leave Exa unchecked');
});

test('saving the order fields writes comma-separated strings, not arrays', async () => {
  const page = await mountSettingsPage(loadDefinition(), {
    describe: () => ({ ok: true, value: namespaceValue({ qualityExcludedProviders: '', cleanExtractProviders: 'keenable,anysearch' }) }),
    credentialsDescribe: () => ({ ok: true, value: {} }),
    set: () => ({ ok: true }),
    mutate: () => ({ ok: true }),
  });

  // Exclude GitHub from quality mode and add Exa to clean extraction.
  checkboxFor(page.getTree(), 'quality-github').props.onChange({ target: { checked: false } });
  await page.settle();
  checkboxFor(page.getTree(), 'clean-exa').props.onChange({ target: { checked: true } });
  await page.settle();

  const saveBar = findNode(page.getTree(), (entry) => entry.props !== undefined
    && entry.props.role === 'status'
    && flatten(entry).some((child) => child.type === 'button' && textOf(child) === 'Save'));
  assert.ok(saveBar, 'the unsaved-changes save bar must render after editing');
  findNode(saveBar, (entry) => entry.type === 'button' && textOf(entry) === 'Save').props.onClick();
  await page.settle();

  assert.equal(page.mutateCalls.length, 1, 'the save must issue exactly one mutate call');
  const operations = page.mutateCalls[0].operations;
  const byPath = (path) => operations.find((operation) => operation.path[0] === path);

  const quality = byPath('qualityExcludedProviders');
  assert.ok(quality, 'excluding GitHub must emit a qualityExcludedProviders operation');
  assert.equal(quality.value, 'github', 'the excluded list must be written as a comma-separated string');
  assert.equal(typeof quality.value, 'string', 'the host z.string() field rejects arrays');

  const clean = byPath('cleanExtractProviders');
  assert.ok(clean, 'adding Exa must emit a cleanExtractProviders operation');
  assert.equal(clean.value, 'keenable,anysearch,exa', 'the clean list must be written as a comma-separated string');
  assert.equal(typeof clean.value, 'string', 'the host z.string() field rejects arrays');

  for (const operation of operations) {
    assert.equal(Array.isArray(operation.value), false, `${operation.path[0]} must not be written as an array`);
  }
});

// Anchors the contract the page must respect: the host Config schema stores these
// two fields as z.string(), so the comma strings the page writes are accepted and
// the arrays it used to write are rejected.
test('host Config accepts the comma strings the page writes and rejects the old arrays', () => {
  assert.doesNotThrow(
    () => Config({ qualityExcludedProviders: 'github', cleanExtractProviders: 'keenable,anysearch' }),
    'comma-separated strings must pass the host schema',
  );
  assert.throws(() => Config({ qualityExcludedProviders: ['github'] }), /expected string/u);
  assert.throws(() => Config({ cleanExtractProviders: ['keenable', 'anysearch'] }), /expected string/u);
});
