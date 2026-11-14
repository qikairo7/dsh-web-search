import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanMarkdown } from '../lib/clean.js';

test('cleanMarkdown removes common navigation lines and collapses blank lines', () => {
  const input = [
    '[Skip to content](#start-of-content)',
    '# Real title',
    '[Sign in](/login)',
    'Navigation Menu',
    '',
    'Body text.',
    '',
    '',
    'More body.',
  ].join('\n');
  assert.equal(cleanMarkdown(input), '# Real title\n\nBody text.\n\nMore body.');
});
