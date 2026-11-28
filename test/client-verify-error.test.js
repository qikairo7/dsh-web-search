import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findNode,
  loadClientDefinition,
  openSettingsPage,
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

// ---- Wiring: the settings page Test button routes a failed verification
// through humanizeVerifyError (drives the real factory closure). ----

function namespaceValue(overrides = {}) {
  return {
    namespaces: [{
      ns: 'web-search-router',
      revision: 1,
      value: { searchMode: 'quality', fetchMode: 'clean', ...overrides },
    }],
  };
}

test('the settings page Test button shows the humanized 401 hint, not the raw error', async () => {
  const fetchImpl = async () => ({ json: async () => ({ ok: false, code: 'WEB_PROVIDER_ERROR', message: 'WEB_PROVIDER_ERROR: GitHub search failed: GitHub search failed (HTTP 401): Bad credentials' }) });
  const page = await openSettingsPage({
    fetch: fetchImpl,
    describe: () => ({ ok: true, value: namespaceValue() }),
    credentialsDescribe: () => ({ ok: true, value: {} }),
  });
  const card = findNode(page.getTree(), (entry) => entry.props.key === 'github');
  assert.ok(card, 'the github card must render');
  const testButton = findNode(card, (entry) => entry.type === 'button' && textOf(entry) === 'Test');
  assert.ok(testButton, 'the Test button must render');
  testButton.props.onClick();
  const tree = await page.settle();
  const status = findNode(findNode(tree, (entry) => entry.props.key === 'github'), (entry) => entry.type === 'p' && entry.props.role === 'status');
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
  let describeCalls = 0;
  const page = await openSettingsPage({
    fetch: fetchImpl,
    describe: () => {
      describeCalls += 1;
      return {
        ok: true,
        value: {
          namespaces: [{
            ns: 'web-search-router',
            revision: describeCalls,
            value: { searchMode: 'quality', fetchMode: 'clean' },
          }],
        },
      };
    },
    credentialsDescribe: () => ({ ok: true, value: { KEENABLE_API_KEY: { configured: true, masked: 'ke_***' } } }),
  });
  const cardOf = (tree) => findNode(tree, (entry) => entry.props.key === 'keenable');
  const testButton = findNode(cardOf(page.getTree()), (entry) => entry.type === 'button' && textOf(entry) === 'Test');
  assert.ok(testButton, 'the Test button must render');
  testButton.props.onClick();
  let tree = await page.settle();
  const badgeText = () => {
    const card = cardOf(tree);
    const badge = findNode(card, (entry) => entry.type === 'span' && textOf(entry).includes('Configured'));
    return badge === undefined ? null : textOf(badge);
  };
  assert.equal(badgeText(), 'Configured · verified', 'a successful Test must mark the card verified');
  // Refresh status (the page-bottom button) must not wipe the verdict.
  const refreshButton = findNode(tree, (entry) => entry.type === 'button' && textOf(entry) === 'Refresh status');
  assert.ok(refreshButton, 'the Refresh status button must render');
  refreshButton.props.onClick();
  tree = await page.settle();
  assert.ok(describeCalls >= 2, 'refresh must re-describe settings');
  assert.equal(badgeText(), 'Configured · verified', 'refresh must keep the verification verdict');
});