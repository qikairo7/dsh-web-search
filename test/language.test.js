import test from 'node:test';
import assert from 'node:assert/strict';

import { detectLanguage } from '../lib/language.js';

test('routes only Chinese and English', () => {
  assert.equal(detectLanguage('DeepSeek Harness 插件开发'), 'zh');
  assert.equal(detectLanguage('Node.js fetch timeout'), 'en');
  assert.equal(detectLanguage('Node.js フェッチ タイムアウト'), 'en');
  assert.equal(detectLanguage('tiempo de espera fetch Node.js'), 'en');
});
