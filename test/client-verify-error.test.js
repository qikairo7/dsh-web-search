import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findAll,
  findNode,
  loadClientDefinition,
  openSettingsPage,
  settingsSection,
  textOf,
} from './helpers/client-fixture.js';

const helpers = loadClientDefinition();
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

// ---- Wiring: the backend card's verify button routes a failed verification
// through humanizeVerifyError (drives the real factory closure). ----

function open(fetchImpl, options = {}) {
  return openSettingsPage({
    definition: options.definition ?? loadClientDefinition({ fetch: fetchImpl }),
    section: settingsSection(),
    credentialsDescribe: () => ({ ok: true, value: {} }),
  });
}

const verifyButtonOf = (tree, backend) => findNode(
  findAll(tree, (entry) => entry.props?.['data-backend-actions'] === backend)[0],
  (entry) => entry.type === 'button' && textOf(entry) === 'Verify',
);
const statusOf = (tree, backend) => findAll(tree, (entry) => entry.props?.['data-message'] === backend)[0];

test('a failed verification shows the humanized 401 hint, not the raw error', async () => {
  const fetchImpl = async () => ({ json: async () => ({ ok: false, code: 'WEB_PROVIDER_ERROR', message: 'WEB_PROVIDER_ERROR: GitHub search failed: GitHub search failed (HTTP 401): Bad credentials' }) });
  const page = await open(fetchImpl);
  let tree = page.getTree();
  const button = verifyButtonOf(tree, 'github');
  assert.ok(button, 'the github backend must offer a verify control');
  button.props.onClick();
  tree = await page.settle();

  const status = statusOf(tree, 'github');
  assert.ok(status, 'a verification failure must render a status line');
  const text = textOf(status);
  assert.match(text, /PAT 无效或已过期/u, 'shows the actionable Chinese hint');
  assert.equal(text.includes('WEB_PROVIDER_ERROR'), false, 'no internal code leaks to the UI');
  assert.equal(text.includes('GitHub search failed: GitHub search failed'), false, 'no duplicated prefix reaches the UI');
});

test('a successful verification marks the backend and survives a settings update', async () => {
  const fetchImpl = async () => ({ json: async () => ({ ok: true, capability: 'search', latencyMs: 42, count: 1 }) });
  const page = await open(fetchImpl);
  let tree = page.getTree();
  verifyButtonOf(tree, 'keenable').props.onClick();
  tree = await page.settle();

  const verdict = () => {
    const row = findAll(tree, (entry) => entry.props?.['data-backend'] === 'keenable')[0];
    return textOf(row);
  };
  assert.match(verdict(), /Verified/u, 'a passing verify must mark the backend');

  // Another client's write (or a settings reload) republishes the snapshot; the
  // verdict is the page's own state and must not be reset by the republication.
  page.harness.section.value = { ...page.harness.section.value, enrichTopN: 7 };
  page.harness.section.revision += 1;
  page.harness.notify();
  tree = await page.settle();
  assert.match(verdict(), /Verified/u, 'republication must keep the verification verdict');
});