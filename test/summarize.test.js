import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeContent, summarizeTechnicalContent } from '../lib/summarize.js';

test('summarizeContent keeps a bounded query-aware extract', () => {
  const sentences = Array.from({ length: 120 }, (_, index) =>
    index % 10 === 0
      ? `Relevant Node.js fetch timeout detail number ${index}.`
      : `Unrelated filler sentence number ${index} with other words.`,
  );
  const result = summarizeContent(sentences.join(' '), 'Node.js fetch timeout', 800, 1500);
  assert.ok(result.length >= 800);
  assert.ok(result.length <= 1500);
  assert.match(result, /Node\.js fetch timeout/);
});

test('summarizeTechnicalContent prefers code and API blocks', () => {
  const text = [
    'A long introduction that does not contain the API signature.',
    '```js\nconst controller = new AbortController();\nconst signal = AbortSignal.timeout(5000);\n```',
    '## Parameters',
    '`timeout` is the timeout in milliseconds.',
    'Unrelated background paragraph. '.repeat(30),
  ].join('\n\n');
  const result = summarizeTechnicalContent(text, 'AbortSignal timeout', 100, 500);
  assert.ok(result.length <= 500);
  assert.match(result, /AbortSignal\.timeout|AbortController|Parameters/);
});
