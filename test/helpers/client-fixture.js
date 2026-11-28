/**
 * Shared harness for the browser bundle's settings-page tests.
 *
 * `client.js` is a classic script that registers itself on `window.__ModuleLoader__`
 * and asks the host for two modules by name. The fixture supplies both: a fake
 * React with the three hooks the page uses, and hook-free stubs for the host
 * component library. It also supplies a fake plugin context, so a test can mount
 * the real settings page and drive it like a user instead of re-implementing the
 * page's flow.
 */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/** Load `client.js` in a fresh sandbox and return the entry it registers. */
export function loadClientDefinition(options = {}) {
  let definition;
  const sandbox = {
    window: { __ModuleLoader__: { load(value) { definition = value; } } },
  };
  if (typeof options.fetch === 'function') sandbox.fetch = options.fetch;
  vm.runInNewContext(readFileSync('client.js', 'utf8'), sandbox);
  return definition;
}

/**
 * A fake React: `createElement` plus `useState`, `useCallback` and `useEffect`
 * keyed by component identity, with a render loop that re-renders until no hook
 * setter ran. Function components are called, so a test walks the rendered tree
 * the way React would.
 */
export function createFakeReact() {
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
    render(page) {
      pendingEffects = [];
      dirty = false;
      const tree = expand(renderComponent(page, {}));
      for (const effect of pendingEffects) effect();
      return tree;
    },
    get dirty() {
      return dirty;
    },
    /** Re-render until every hook setter has settled. */
    async renderUntilSettled(page, { rounds = 60, ticks = 800 } = {}) {
      for (let round = 0; round < rounds; round += 1) {
        const tree = this.render(page);
        for (let tick = 0; tick < ticks; tick += 1) await Promise.resolve();
        if (!this.dirty) return tree;
      }
      throw new Error('settings page did not settle');
    },
  };
}

/**
 * Stubs for the host component library. Each is a hook-free function component
 * that renders the same observable surface the real component does: the same
 * control element, the same label text, the same callback wiring. Nothing here
 * mirrors layout or styling, which the tests do not assert.
 */
export function createPrimitivesStubs() {
  const h = (type, props, ...children) => ({ type, props: props ?? {}, children });

  const Switch = ({ checked, onChange, label, disabled = false, title }) => h('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': checked === true,
    'aria-label': label,
    title,
    disabled,
    onClick: () => { onChange(checked !== true); },
  });

  const SettingsValueField = ({
    id, label, hint, text, overridden, invalid, overriddenLabel, resetLabel, invalidLabel,
    disabled, onEdit, onReset, numeric, placeholder,
  }) => h('div', { 'data-control': 'value' },
    h('label', { htmlFor: id }, label),
    overridden
      ? h('span', { 'data-overridden': true },
        overriddenLabel,
        h('button', { type: 'button', disabled, onClick: onReset }, resetLabel))
      : null,
    h('input', {
      id,
      type: 'text',
      inputMode: numeric === true ? 'numeric' : undefined,
      value: text,
      placeholder: placeholder ?? '',
      disabled,
      onChange: (event) => { onEdit(event.target.value); },
    }),
    hasValueMessage(invalid, hint)
      ? h('p', { 'data-invalid': invalid === true }, invalid ? invalidLabel : hint)
      : null);

  const SettingsSecretField = ({ id, label, hint, text, disabled, onEdit, configured, stateLabel }) => h('div', { 'data-control': 'secret' },
    h('label', { htmlFor: id }, label),
    h('span', { 'data-configured': configured === true }, stateLabel),
    h('input', {
      id,
      type: 'password',
      autoComplete: 'new-password',
      value: text,
      disabled,
      onChange: (event) => { onEdit(event.target.value); },
    }),
    h('p', null, hint));

  const SettingsForm = ({ labels, state, onSave, onDiscard, children }) => (state.available !== true
    ? h('p', { role: 'status' }, labels.unavailable)
    : h('div', { 'data-form': true },
      state.writable !== true ? h('p', { role: 'status' }, labels.readOnly) : null,
      children,
      h('div', { 'data-footer': true },
        state.failed === true ? h('p', { role: 'status' }, labels.saveFailed) : null,
        h('button', {
          type: 'button',
          disabled: state.dirty !== true || state.invalid === true || state.saving === true,
          onClick: onSave,
        }, state.saving === true ? labels.saving : labels.save)),
      onDiscard === undefined ? null : h('span', { 'data-discard': true })));

  const Menu = ({ open, anchor, items = [], children, selectedId, onSelect, onClose }) => h('div', { 'data-menu': true },
    anchor,
    open === true
      ? h('div', { role: 'menu' },
        ...items.map((item) => h('button', {
          key: item.id,
          type: 'button',
          role: 'menuitem',
          'data-id': item.id,
          'aria-current': selectedId === item.id ? 'true' : undefined,
          disabled: item.disabled === true,
          onClick: () => { onSelect(item.id); },
        }, item.label)),
        ...children ?? [],
        h('button', { type: 'button', 'data-close': true, onClick: onClose }, 'close'))
      : null);

  const MenuItemButton = ({ children, onSelect, current, disabled }) => h('button', {
    type: 'button',
    role: 'menuitem',
    'aria-current': current === true ? 'true' : undefined,
    disabled: disabled === true,
    onClick: onSelect,
  }, children);

  const Checkbox = ({ checked, onChange, label, disabled = false, title }) => h('label', { title },
    h('input', {
      type: 'checkbox',
      checked: checked === true,
      disabled,
      onChange: (event) => { onChange(event.target.checked); },
    }),
    h('span', null, label));

  const StateDot = ({ state, size }) => h('span', { 'data-state': state, 'aria-hidden': 'true', 'data-size': size });

  const Button = ({ variant, size, icon, children, ...rest }) => h('button', { type: 'button', ...rest },
    icon ?? null,
    children);

  const Tag = ({ tone = 'outline', children }) => h('span', { 'data-tone': tone }, children);

  return {
    Switch,
    SettingsValueField,
    SettingsSecretField,
    SettingsForm,
    Menu,
    MenuItemButton,
    Checkbox,
    StateDot,
    Button,
    Tag,
  };
}

function hasValueMessage(invalid, hint) {
  return invalid === true || (typeof hint === 'string' && hint.length > 0);
}

/** A plugin `require` that answers by module name and refuses anything else. */
export function createFakeRequire(React, primitives = createPrimitivesStubs()) {
  return (name) => {
    if (name === 'react') return React;
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
    throw new Error(`unexpected require: ${name}`);
  };
}

/**
 * A fake plugin context with the surfaces the settings page reads: the locale
 * dictionary, the bundle-config slot, the settings/credentials remotes, and the
 * shared configuration forms over an in-memory settings document.
 *
 * @param options.describe - settings describe answer for the legacy remote.
 * @param options.mutate - settings mutate answer for the legacy remote.
 * @param options.credentialsDescribe - credential status by reference.
 * @param options.setCredential - credential write; resolves to `{ ok }`.
 * @param options.section - settings document a `configForms` consumer reads.
 */
export function createFakeCtx(options = {}) {
  const dicts = {};
  const registrations = [];
  const pages = [];
  const settingsDescribeCalls = [];
  const settingsMutateCalls = [];
  const credentialsDescribeCalls = [];
  const credentialSetCalls = [];
  const credentialUnsetCalls = [];
  const formMutateCalls = [];
  const listeners = new Set();

  const section = options.section ?? {
    status: 'ready',
    value: {},
    base: {},
    user: {},
    revision: 1,
    writable: true,
  };

  const form = {
    getSnapshot: () => section,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async mutate(ops, expectedRevision) {
      formMutateCalls.push({ ops, expectedRevision });
      const accepted = options.formMutate === undefined ? true : options.formMutate(ops, expectedRevision);
      if (accepted === true) {
        for (const op of ops) {
          if (op.op === 'set') section.value = { ...section.value, [op.path[0]]: op.value };
          else if (op.op === 'unset') {
            const next = { ...section.value };
            delete next[op.path[0]];
            section.value = next;
          }
        }
        section.revision = (section.revision ?? 0) + 1;
      }
      for (const listener of listeners) listener();
      return accepted;
    },
  };

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
      inject(name, register) {
        registrations.push(name);
        register();
      },
      register(spec, component) {
        pages.push({ spec, component });
      },
    },
    remote: {
      settings: {
        async describe(...args) {
          settingsDescribeCalls.push(args);
          return options.describe === undefined ? { ok: true, value: { namespaces: [] } } : options.describe();
        },
        async mutate(namespace, operations, revision) {
          settingsMutateCalls.push({ namespace, operations, revision });
          return options.mutate === undefined ? { ok: true } : options.mutate(namespace, operations, revision);
        },
      },
      credentials: {
        async describe(refs) {
          credentialsDescribeCalls.push(refs);
          return options.credentialsDescribe === undefined
            ? { ok: true, value: {} }
            : options.credentialsDescribe(refs);
        },
        async set(ref, value) {
          credentialSetCalls.push([ref, value]);
          return options.setCredential === undefined ? { ok: true } : options.setCredential(ref, value);
        },
        async unset(ref) {
          credentialUnsetCalls.push(ref);
          return options.unsetCredential === undefined ? { ok: true } : options.unsetCredential(ref);
        },
      },
    },
    configForms: {
      get(namespace) {
        return { namespace, ...form };
      },
    },
  };

  return {
    ctx,
    section,
    dicts,
    registrations,
    pages,
    settingsDescribeCalls,
    settingsMutateCalls,
    credentialsDescribeCalls,
    credentialSetCalls,
    credentialUnsetCalls,
    formMutateCalls,
    notify: () => { for (const listener of listeners) listener(); },
  };
}

/** Walk a rendered tree depth-first, in render order. */
export function flatten(node, out = []) {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out);
    return out;
  }
  out.push(node);
  if (node.children !== undefined) for (const child of node.children) flatten(child, out);
  return out;
}

/** Concatenate the text nodes of one rendered subtree. */
export function textOf(node) {
  if (node.text !== undefined) return node.text;
  return (node.children ?? []).map(textOf).join('');
}

/** First element in the subtree matching a predicate. */
export function findNode(node, predicate) {
  return flatten(node).find((entry) => entry.type !== undefined && predicate(entry));
}

/** Every element in the subtree matching a predicate. */
export function findAll(node, predicate) {
  return flatten(node).filter((entry) => entry.type !== undefined && predicate(entry));
}

/** Every `data-field` anchor carrying one settings field's key. */
export function fieldAnchors(tree, key) {
  return findAll(tree, (entry) => entry.props?.['data-field'] === key);
}

/** Load and mount in one step; the common entry point for page-level tests. */
export async function openSettingsPage(options = {}) {
  const definition = options.definition ?? loadClientDefinition({ fetch: options.fetch });
  const fake = createFakeReact();
  const harness = createFakeCtx(options);
  const primitives = options.primitives ?? createPrimitivesStubs();
  const plugin = definition.factory(createFakeRequire(fake.React, primitives));
  plugin.apply(harness.ctx);
  const page = harness.pages[0]?.component;
  if (page === undefined) throw new Error('factory did not register a settings page');
  const state = { tree: await fake.renderUntilSettled(page) };
  return {
    definition,
    fake,
    harness,
    plugin,
    page,
    state,
    getTree: () => state.tree,
    /** Re-render until settled and return the new tree. */
    async settle() {
      state.tree = await fake.renderUntilSettled(page);
      return state.tree;
    },
  };
}