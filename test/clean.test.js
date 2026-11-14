import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanMarkdown, htmlToText } from '../lib/clean.js';

test('htmlToText removes scripts and tags', () => {
  const html = '<html><head><style>body{}</style><script>bad()</script></head><body><h1>Title</h1><p>Body &amp; text.</p></body></html>';
  assert.equal(htmlToText(html), 'Title\nBody & text.');
});

test('cleanMarkdown removes common navigation lines and collapses blank lines', () => {
  const input = [
    '[Skip to content](#start-of-content)',
    '# Real title',
    '[Sign in](/login)',
    'Navigation Menu',
    '## Navigation Menu',
    '[Sign up](/signup?ref_cta=Sign+up)',
    'Appearance settings',
    'Repository navigation',
    '## Repository navigation',
    '* [Notifications](/login?return_to=%2Fdeepseek-ai)',
    '* [Fork 1](/fork)',
    '![avatar](https://avatars.githubusercontent.com/u/1?v=4)',
    '',
    'Body text.',
    '',
    '',
    'More body.',
  ].join('\n');
  assert.equal(cleanMarkdown(input), '# Real title\n\nBody text.\n\nMore body.');
});
