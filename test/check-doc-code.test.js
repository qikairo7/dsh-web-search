import { test } from 'node:test';
import assert from 'node:assert/strict';

import { failureMessage } from '../scripts/check-doc-code.mjs';

test('failureMessage reports an unavailable checker instead of a parse error', () => {
  const message = failureMessage({ error: { code: 'ENOENT' }, status: null }, 'bash', 'AGENTS.md (sh block #1)');
  assert.ok(message.includes("checker 'bash' unavailable (ENOENT)"), message);
  assert.ok(!message.includes('parse error'), message);
});

test('failureMessage keeps the last non-empty parser lines; toolchain banners drop off', () => {
  const message = failureMessage({ status: 1, stderr: 'wsl banner\nline2\nline3\nline4' }, process.execPath, 'README.md (js block #2)');
  assert.ok(message.includes('line2 | line3 | line4'), message);
  assert.ok(!message.includes('wsl banner'), message);
});

test('failureMessage falls back to parse error when stderr is empty', () => {
  const message = failureMessage({ status: 1, stderr: '' }, 'bash', 'x.md (sh block #1)');
  assert.ok(message.includes('parse error'), message);
});
