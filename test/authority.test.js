import test from 'node:test';
import assert from 'node:assert/strict';

import { authorityBoost, sortByAuthority } from '../lib/authority.js';

test('authorityBoost ranks official docs and code hosts above generic pages', () => {
  assert.equal(authorityBoost('https://developer.mozilla.org/en-US/docs/Web'), 0.2);
  assert.equal(authorityBoost('https://deepseek-harness.github.io/docs'), 0.2);
  assert.equal(authorityBoost('https://docs.docker.com/engine/'), 0.2);
  assert.equal(authorityBoost('https://developer.chrome.com/docs/'), 0.2);
  assert.equal(authorityBoost('https://github.com/deepseek-ai/deepseek-harness'), 0.1);
  assert.equal(authorityBoost('https://stackoverflow.com/questions/1'), 0.1);
  assert.equal(authorityBoost('https://example.com/article'), 0);
});

test('sortByAuthority adds the domain prior to the rerank score', () => {
  const sorted = sortByAuthority([
    { source: { url: 'https://example.com/blog' }, score: 0.9, index: 0 },
    { source: { url: 'https://developer.mozilla.org/docs' }, score: 0.75, index: 1 },
    { source: { url: 'https://github.com/repo' }, score: 0.8, index: 2 },
  ]);
  assert.deepEqual(sorted.map((entry) => entry.source.url), [
    'https://developer.mozilla.org/docs',
    'https://example.com/blog',
    'https://github.com/repo',
  ]);
});
