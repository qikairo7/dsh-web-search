import test from 'node:test';
import assert from 'node:assert/strict';

import { detectLanguage } from '../lib/language.js';

test('detects Chinese, Japanese, Korean and European languages', () => {
  assert.equal(detectLanguage('DeepSeek Harness 插件开发'), 'zh');
  assert.equal(detectLanguage('Node.js フェッチ タイムアウト'), 'ja');
  assert.equal(detectLanguage('Node.js 패치 타임아웃'), 'ko');
  assert.equal(detectLanguage('tiempo de espera fetch Node.js'), 'es');
  assert.equal(detectLanguage('temps de réponse fetch Node.js'), 'fr');
  assert.equal(detectLanguage('Zeitüberschreitung fetch Node.js'), 'de');
  assert.equal(detectLanguage('Node.js fetch timeout'), 'en');
});
