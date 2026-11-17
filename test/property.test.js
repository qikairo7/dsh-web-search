import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyFailure, FAILURE_CLASSES } from '../lib/errors.js';
import { detectLanguage } from '../lib/text.js';

/** Property tests (Claude Code verification methodology, zero-dependency
 * form): generate pseudo-random inputs with a fixed seed and assert
 * invariants the agent that wrote the code is biased against testing. */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20261117);

/** Build a random garbage error shape. */
function randomError() {
  const kind = Math.floor(random() * 5);
  const status = [200, 301, 400, 401, 402, 403, 404, 408, 429, 500, 503, 999][Math.floor(random() * 12)];
  if (kind === 0) return null;
  if (kind === 1) return { status };
  if (kind === 2) return { code: 'WEB_RATE_LIMITED' };
  if (kind === 3) return { cause: { status } };
  return { code: `WEB_RANDOM_${Math.floor(random() * 1000)}`, status };
}

test('property: classifyFailure always lands in the six classes and is deterministic', () => {
  for (let i = 0; i < 2000; i += 1) {
    const error = randomError();
    const cls = classifyFailure(error);
    assert.ok(FAILURE_CLASSES.includes(cls), `input ${JSON.stringify(error)} classified to ${cls}`);
    assert.equal(classifyFailure(error), cls, `classification is not deterministic for ${JSON.stringify(error)}`);
  }
  // Documented contract of lib/errors.js: exact WEB_* code first, then the
  // status read from error.status, cause.status, or cause.httpStatus;
  // 402/429 quota, 401/403 auth, 408/5xx transient, everything else unknown.
  assert.equal(classifyFailure({ status: 429 }), 'quota');
  assert.equal(classifyFailure({ cause: { status: 403 } }), 'auth');
  assert.equal(classifyFailure({ cause: { httpStatus: 500 } }), 'transient');
  assert.equal(classifyFailure({ status: 408 }), 'transient');
  assert.equal(classifyFailure({ status: 999 }), 'transient');
  assert.equal(classifyFailure({ status: 400 }), 'unknown');
  assert.equal(classifyFailure(null), 'unknown');
  assert.equal(classifyFailure({ code: 'WEB_PROVIDER_CREDENTIAL_MISSING', status: 500 }), 'auth');
  assert.equal(classifyFailure({ code: 'WEB_BLOCKED_URL', status: 401 }), 'bot-wall');
  assert.equal(classifyFailure({ code: 'WEB_RANDOM_999', status: 429 }), 'quota');
});

test('property: known codes map to their class regardless of noise', () => {
  for (let i = 0; i < 1000; i += 1) {
    const noise = { status: [401, 500, 429][Math.floor(random() * 3)] };
    assert.equal(classifyFailure({ code: 'WEB_RATE_LIMITED', ...noise }), 'quota');
    assert.equal(classifyFailure({ code: 'WEB_BLOCKED_URL', ...noise }), 'bot-wall');
  }
});

test('property: detectLanguage never throws and answers zh or en', () => {
  const samples = [];
  for (let i = 0; i < 500; i += 1) {
    const han = random() > 0.5;
    const len = 1 + Math.floor(random() * 30);
    let s = '';
    for (let j = 0; j < len; j += 1) s += han ? '搜索测试中文' : 'ascii query text 123';
    samples.push(s.slice(0, len));
  }
  for (const s of samples) {
    const lang = detectLanguage(s);
    assert.ok(lang === 'zh' || lang === 'en', `detectLanguage(${JSON.stringify(s)}) => ${lang}`);
  }
  assert.equal(detectLanguage(''), 'en');
});

test('property: detectLanguage routes by Han presence at any position', () => {
  const ascii = 'ascii query text 123 ';
  for (let i = 0; i < 500; i += 1) {
    const len = 1 + Math.floor(random() * 30);
    let s = '';
    for (let j = 0; j < len; j += 1) s += ascii[Math.floor(random() * ascii.length)];
    const cut = Math.floor(random() * (s.length + 1));
    const withHan = `${s.slice(0, cut)}字${s.slice(cut)}`;
    assert.equal(detectLanguage(s), 'en', JSON.stringify(s));
    assert.equal(detectLanguage(withHan), 'zh', JSON.stringify(withHan));
  }
});
