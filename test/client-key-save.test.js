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

// ---- Factory-closure coverage: drive the settings page save button end to end (#190) ----
// The tests above feed the module-level handleKeySave its callbacks directly, so they stay green
// even when the factory closure at client.js:794 is broken. These tests render the real
// SettingsPage through the factory and click the real Save button, so a stray busy raise, a
// dropped refresh(false), or a dropped failure notice inside that closure turns them red.

const ERROR_TEXT_COLOR = 'var(--dsw-alias-state-error-primary)';

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
  const describeCalls = [];
  const credentialsDescribeCalls = [];
  const setCalls = [];
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
        async describe(...args) {
          describeCalls.push(args);
          return behavior.describe();
        },
        async mutate() {
          return { ok: true };
        },
      },
      credentials: {
        async describe(refs) {
          credentialsDescribeCalls.push(refs);
          return behavior.credentialsDescribe(refs);
        },
        async set(ref, value) {
          setCalls.push([ref, value]);
          return behavior.set(ref, value);
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
  return { fake, describeCalls, credentialsDescribeCalls, setCalls, settle, getTree: () => tree };
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
  const definition = loadDefinition();
  const page = await mountSettingsPage(definition, {
    describe: () => ({ ok: true, value: namespaceValue() }),
    credentialsDescribe: () => ({ ok: true, value: {} }),
    set: () => ({ ok: true }),
  });
  const initialDescribeCalls = page.describeCalls.length;

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

  assert.deepEqual(page.setCalls, [['TAVILY_API_KEY', 'k1']], 'the save must write the key to the provider reference');
  assert.equal(page.describeCalls.length, initialDescribeCalls + 1, 'a successful save must trigger exactly one settings refresh(false)');
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
  const definition = loadDefinition();
  const page = await mountSettingsPage(definition, {
    describe: () => ({ ok: true, value: namespaceValue() }),
    credentialsDescribe: () => ({ ok: true, value: {} }),
    set: () => ({ ok: false }),
  });
  const initialDescribeCalls = page.describeCalls.length;

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

  assert.deepEqual(page.setCalls, [['TAVILY_API_KEY', 'k1']], 'the failed save still attempts the planned write once');
  assert.equal(page.describeCalls.length, initialDescribeCalls, 'a failed save must not refresh');
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
