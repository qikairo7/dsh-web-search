import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanMarkdown, htmlToText } from '../lib/clean.js';

test('htmlToText removes scripts and tags', () => {
  const html = '<html><head><style>body{}</style><script>bad()</script></head><body><h1>Title</h1><p>Body &amp; text.</p></body></html>';
  assert.equal(htmlToText(html), 'Title\nBody & text.');
});

test('htmlToText decodes entities once and handles spaced script end tags', () => {
  const html = '<script>bad()</script ><p>&amp;lt; &amp;amp;</p>';
  assert.equal(htmlToText(html), '&lt; &amp;');
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
  assert.equal(
    cleanMarkdown(input, 'https://github.com/deepseek-ai/dsh-web-search'),
    '# Real title\n\nBody text.\n\nMore body.',
  );
});

test('cleanMarkdown keeps GitHub-only headings on other sites', () => {
  const input = '## Releases\nrelease notes\n## Languages\nEnglish\n## Activity\nrecent commits';
  assert.equal(cleanMarkdown(input), '## Releases\nrelease notes\n## Languages\nEnglish\n## Activity\nrecent commits');
  assert.equal(cleanMarkdown(input, 'https://example.com/article'), input);
});

test('cleanMarkdown removes GitHub-only headings for github.com URLs and hosts', () => {
  const input = '## Releases\nrelease notes\n## Languages\nEnglish\n## Activity\nrecent commits';
  assert.equal(cleanMarkdown(input, 'https://github.com/deepseek-ai/dsh-web-search'), 'release notes\nEnglish\nrecent commits');
  assert.equal(cleanMarkdown(input, 'github.com'), 'release notes\nEnglish\nrecent commits');
});

test('cleanMarkdown removes GitHub navigation links on github.com', () => {
  const input = [
    '- [Code](/deepseek-ai/dsh-web-search)',
    '- [Discussions](/deepseek-ai/dsh-web-search/discussions)',
    '[Login](https://github.com/login)',
    '[Log in](https://github.com/login?return_to=%2Fdeepseek-ai)',
    'Discussions',
    '# Real title',
    'Body text.',
  ].join('\n');
  assert.equal(
    cleanMarkdown(input, 'https://github.com/deepseek-ai/dsh-web-search'),
    '# Real title\nBody text.',
  );
});
