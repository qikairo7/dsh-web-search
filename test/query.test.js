import test from 'node:test';
import assert from 'node:assert/strict';

import { parseQuerySyntax } from '../lib/query.js';

test('parses site, lang, after and before operators', () => {
  const parsed = parseQuerySyntax('DeepSeek site:github.com lang:zh after:2025-01-01 before:2026');
  assert.equal(parsed.site, 'github.com');
  assert.equal(parsed.lang, 'zh');
  assert.equal(parsed.after, '2025-01-01');
  assert.equal(parsed.before, '2026');
});
