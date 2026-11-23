import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load the browser bundle, optionally injecting a fetch so the settings page's
// real Test button can be driven end to end (the C error-mapping wiring).
function loadDefinition(fetchImpl) {
  let definition;
  const sandbox = {
    window: { __ModuleLoader__: { load(value) { definition = value; } } },
  };
  if (typeof fetchImpl === 'function') sandbox.fetch = fetchImpl;
  vm.runInNewContext(readFileSync('client.js', 'utf8'), sandbox);
  return definition;
}

const helpers = loadDefinition();
const { humanizeVerifyError, maskSavedKey } = helpers;

// ---- C: verification failure copy maps to readable Chinese, no internal code,
// no duplicated prefix (walkthrough P2 验证失败文案). ----

test('humanizeVerifyError maps a 401 to an actionable Chinese hint without the internal code or a repeated prefix', () => {
  const text = humanizeVerifyError({
    code: 'WEB_PROVIDER_ERROR',
    message: 'WEB_PROVIDER_ERROR: GitHub search failed: GitHub search failed (HTTP 401): Bad credentials',
  });
  assert.equal(text, 'PAT 无效或已过期（HTTP 401），请重新生成后保存');
  assert.equal(text.includes('WEB_PROVIDER_ERROR'), false, 'internal code must not leak');
  assert.equal(/GitHub search failed: GitHub search failed/u.test(text), false, 'duplicated prefix must be gone');
});

test('humanizeVerifyError maps 429 and 5xx to readable hints', () => {
  assert.equal(humanizeVerifyError({ code: 'WEB_PROVIDER_ERROR', message: 'GitHub search failed (HTTP 429)' }),
    '触发限流（HTTP 429），请稍后重试');
  assert.equal(humanizeVerifyError({ code: 'WEB_PROVIDER_ERROR', message: 'GitHub search failed (HTTP 502)' }),
    'Provider 暂时不可用（HTTP 502），请稍后重试');
});

test('humanizeVerifyError collapses a repeated prefix on a non-status failure and keeps the detail', () => {
  const text = humanizeVerifyError({ code: 'WEB_PROVIDER_ERROR', message: 'WEB_PROVIDER_ERROR: GitHub search failed: GitHub search failed: socket hang up' });
  assert.equal(text.includes('WEB_PROVIDER_ERROR'), false);
  assert.equal(text.includes('GitHub search failed: GitHub search failed'), false);
  assert.match(text, /socket hang up/u, 'the underlying cause detail is kept');
});

// ---- F: the saved-key preview shows only the last four characters. ----

test('maskSavedKey shows only the last four characters behind a fixed mask', () => {
  const shown = maskSavedKey('ghp_abcdef1234564qWU');
  assert.equal(shown, '••••4qWU');
  assert.equal(shown.includes('ghp_'), false, 'no key prefix leaks');
  assert.equal(shown.includes('abcdef123456'), false, 'no middle characters leak');
});

test('maskSavedKey handles empty and short previews', () => {
  assert.equal(maskSavedKey(''), '');
  assert.equal(maskSavedKey('abc'), '••••');
});

// ---- Wiring: the settings page Test button routes a failed verification
// through humanizeVerifyError (drives the real factory closure). ----

function createFakeReact() {
  const instances = new Map();
  let current = null;
  let dirty = false;
  let pendingEffects = [];
  const instanceFor = (component) => {
    let instance = instances.get(component);
    if (instance === undefined) { instance = { hooks: [], cursor: 0 }; instances.set(component, instance); }
    return instance;
  };
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
    useState(initial) {
      const instance = current; const slot = instance.cursor++;
      if (!(slot in instance.hooks)) instance.hooks[slot] = typeof initial === 'function' ? initial() : initial;
      const setter = (next) => { const previous = instance.hooks[slot]; instance.hooks[slot] = typeof next === 'function' ? next(previous) : next; dirty = true; };
      return [instance.hooks[slot], setter];
    },
    useCallback(callback) { const instance = current; const slot = instance.cursor++; if (!(slot in instance.hooks)) instance.hooks[slot] = callback; return instance.hooks[slot]; },
    useEffect(effect) { const instance = current; const slot = instance.cursor++; if (!(slot in instance.hooks)) { instance.hooks[slot] = true; pendingEffects.push(effect); } },
  };
  const renderComponent = (component, props) => {
    const instance = instanceFor(component); const previous = current; current = instance; instance.cursor = 0;
    try { return component(props); } finally { current = previous; }
  };
  const expand = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean') return null;
    if (typeof node === 'string' || typeof node === 'number') return { text: String(node) };
    if (Array.isArray(node)) return node.map(expand).filter((child) => child !== null);
    if (typeof node.type === 'function') return expand(renderComponent(node.type, { ...node.props, children: node.children }));
    const children = [];
    for (const child of node.children) { const e = expand(child); if (e === null) continue; if (Array.isArray(e)) children.push(...e); else children.push(e); }
    return { type: node.type, props: node.props, children };
  };
  return {
    React,
    render(page) { pendingEffects = []; dirty = false; const tree = expand(renderComponent(page, {})); for (const effect of pendingEffects) effect(); return tree; },
    get dirty() { return dirty; },
  };
}
function flatten(node, out = []) {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) { for (const c of node) flatten(c, out); return out; }
  out.push(node); if (node.children !== undefined) for (const c of node.children) flatten(c, out); return out;
}
function textOf(node) { if (node.text !== undefined) return node.text; return (node.children ?? []).map(textOf).join(''); }
function findNode(node, predicate) { return flatten(node).find((entry) => entry.type !== undefined && predicate(entry)); }

test('the settings page Test button shows the humanized 401 hint, not the raw error', async () => {
  const fetchImpl = async () => ({ json: async () => ({ ok: false, code: 'WEB_PROVIDER_ERROR', message: 'WEB_PROVIDER_ERROR: GitHub search failed: GitHub search failed (HTTP 401): Bad credentials' }) });
  const definition = loadDefinition(fetchImpl);
  const fake = createFakeReact();
  const dicts = {};
  let page = null;
  const ctx = {
    effect(effect) { effect(); return () => {}; },
    locale: {
      register(ns, value) { dicts[ns] = value; },
      bind(ns) { const bundle = dicts[ns] ?? {}; const table = bundle.en ?? bundle; return (key, params) => { const template = table[key] ?? key; if (params === undefined) return template; return Object.entries(params).reduce((text, [name, value]) => text.replaceAll('{' + name + '}', String(value)), template); }; },
    },
    slots: { inject(_n, register) { register(); }, register(_spec, component) { page = component; } },
    remote: {
      settings: { async describe() { return { ok: true, value: { namespaces: [{ ns: 'web-search-router', revision: 1, value: { searchMode: 'quality', fetchMode: 'clean' } }] } }; } },
      credentials: { async describe() { return { ok: true, value: {} }; }, async set() { return { ok: true }; }, async unset() { return { ok: true }; } },
    },
  };
  const plugin = definition.factory((name) => { if (name === 'react') return fake.React; throw new Error('unexpected require ' + name); });
  plugin.apply(ctx);
  if (page === null) throw new Error('no settings page');
  const settle = async () => { let tree = null; for (let round = 0; round < 60; round += 1) { tree = fake.render(page); for (let t = 0; t < 800; t += 1) await Promise.resolve(); if (!fake.dirty) return tree; } throw new Error('did not settle'); };
  let tree = await settle();
  const card = findNode(tree, (e) => e.props.key === 'github');
  assert.ok(card, 'the github card must render');
  const testButton = findNode(card, (e) => e.type === 'button' && textOf(e) === 'Test');
  assert.ok(testButton, 'the Test button must render');
  testButton.props.onClick();
  tree = await settle();
  const status = findNode(findNode(tree, (e) => e.props.key === 'github'), (e) => e.type === 'p' && e.props.role === 'status');
  assert.ok(status, 'a status message must render');
  const text = textOf(status);
  assert.match(text, /PAT 无效或已过期/u, 'shows the actionable Chinese hint');
  assert.equal(text.includes('WEB_PROVIDER_ERROR'), false, 'no internal code leaks to the UI');
  assert.equal(text.includes('GitHub search failed: GitHub search failed'), false, 'no duplicated prefix reaches the UI');
});

// ---- Review F1: a settings refresh keeps the verification verdict ----
// (walkthrough W6 acceptance: the badge must survive a refresh until re-verified).

test('a settings refresh keeps the verified badge instead of resetting it', async () => {
  const fetchImpl = async () => ({ json: async () => ({ ok: true, capability: 'search', latencyMs: 42, count: 1 }) });
  const definition = loadDefinition(fetchImpl);
  const fake = createFakeReact();
  const dicts = {};
  let page = null;
  let describeCalls = 0;
  const ctx = {
    effect(effect) { effect(); return () => {}; },
    locale: {
      register(ns, value) { dicts[ns] = value; },
      bind(ns) { const bundle = dicts[ns] ?? {}; const table = bundle.en ?? bundle; return (key, params) => { const template = table[key] ?? key; if (params === undefined) return template; return Object.entries(params).reduce((text, [name, value]) => text.replaceAll('{' + name + '}', String(value)), template); }; },
    },
    slots: { inject(_n, register) { register(); }, register(_spec, component) { page = component; } },
    remote: {
      settings: { async describe() { describeCalls += 1; return { ok: true, value: { namespaces: [{ ns: 'web-search-router', revision: describeCalls, value: { searchMode: 'quality', fetchMode: 'clean' } }] } }; } },
      credentials: { async describe() { return { ok: true, value: { KEENABLE_API_KEY: { configured: true, masked: 'ke_***' } } }; }, async set() { return { ok: true }; }, async unset() { return { ok: true }; } },
    },
  };
  const plugin = definition.factory((name) => { if (name === 'react') return fake.React; throw new Error('unexpected require ' + name); });
  plugin.apply(ctx);
  if (page === null) throw new Error('no settings page');
  const settle = async () => { let tree = null; for (let round = 0; round < 60; round += 1) { tree = fake.render(page); for (let t = 0; t < 800; t += 1) await Promise.resolve(); if (!fake.dirty) return tree; } throw new Error('did not settle'); };
  let tree = await settle();
  const cardOf = () => findNode(tree, (e) => e.props.key === 'keenable');
  const testButton = findNode(cardOf(), (e) => e.type === 'button' && textOf(e) === 'Test');
  assert.ok(testButton, 'the Test button must render');
  testButton.props.onClick();
  tree = await settle();
  const badgeText = () => {
    const card = cardOf();
    const badge = findNode(card, (e) => e.type === 'span' && textOf(e).includes('Configured'));
    return badge === undefined ? null : textOf(badge);
  };
  assert.equal(badgeText(), 'Configured · verified', 'a successful Test must mark the card verified');
  // Refresh status (the page-bottom button) must not wipe the verdict.
  const refreshButton = findNode(tree, (e) => e.type === 'button' && textOf(e) === 'Refresh status');
  assert.ok(refreshButton, 'the Refresh status button must render');
  refreshButton.props.onClick();
  tree = await settle();
  assert.ok(describeCalls >= 2, 'refresh must re-describe settings');
  assert.equal(badgeText(), 'Configured · verified', 'refresh must keep the verification verdict');
});
