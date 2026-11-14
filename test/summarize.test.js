import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeContent } from '../lib/summarize.js';

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
