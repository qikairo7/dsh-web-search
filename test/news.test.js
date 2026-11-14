import test from 'node:test';
import assert from 'node:assert/strict';

import { isNewsDomain } from '../lib/news.js';

test('recognizes Chinese and English news domains', () => {
  assert.equal(isNewsDomain('https://www.sohu.com/a/1100338793_121732504'), true);
  assert.equal(isNewsDomain('https://www.163.com/dy/article/LBC1C14J0534A4SC.html'), true);
  assert.equal(isNewsDomain('https://www.reuters.com/technology/'), true);
  assert.equal(isNewsDomain('https://example.com/news'), false);
});
