import test from 'node:test';
import assert from 'node:assert/strict';

import { FAILURE_CLASSES, classifyFailure, isRecoverable } from '../lib/errors.js';

test('invalid input and cancellation are terminal errors', () => {
  assert.equal(isRecoverable({ name: 'WebError', code: 'WEB_INVALID_URL' }), false);
  assert.equal(isRecoverable({ name: 'WebError', code: 'WEB_ABORTED' }), false);
  assert.equal(isRecoverable({ name: 'AbortError' }), false);
});

test('rate limits, missing credentials, timeouts and provider failures are recoverable', () => {
  assert.equal(isRecoverable({ name: 'WebError', code: 'WEB_RATE_LIMITED' }), true);
  assert.equal(isRecoverable({ name: 'WebError', code: 'WEB_PROVIDER_CREDENTIAL_MISSING' }), true);
  assert.equal(isRecoverable({ name: 'WebError', code: 'WEB_FETCH_TIMEOUT' }), true);
  assert.equal(isRecoverable({ name: 'WebError', code: 'WEB_PROVIDER_ERROR' }), true);
  assert.equal(isRecoverable(new Error('network down')), true);
});

test('FAILURE_CLASSES lists the six classes in their default order', () => {
  assert.deepEqual([...FAILURE_CLASSES], [
    'quota',
    'auth',
    'bot-wall',
    'transient',
    'invalid-response',
    'unknown',
  ]);
});

test('classifyFailure maps exact WEB_* codes onto their class', () => {
  assert.equal(classifyFailure({ code: 'WEB_RATE_LIMITED' }), 'quota');
  assert.equal(classifyFailure({ code: 'WEB_PROVIDER_CREDENTIAL_MISSING' }), 'auth');
  assert.equal(classifyFailure({ code: 'WEB_BLOCKED_URL' }), 'bot-wall');
  assert.equal(classifyFailure({ code: 'WEB_FETCH_TIMEOUT' }), 'transient');
  assert.equal(classifyFailure({ code: 'WEB_INVALID_RESPONSE' }), 'invalid-response');
  assert.equal(classifyFailure({ code: 'WEB_UNSUPPORTED_CONTENT_TYPE' }), 'invalid-response');
});

test('classifyFailure maps HTTP statuses, including on the cause', () => {
  assert.equal(classifyFailure({ status: 401 }), 'auth');
  assert.equal(classifyFailure({ status: 402 }), 'quota');
  assert.equal(classifyFailure({ status: 403 }), 'auth');
  assert.equal(classifyFailure({ status: 429 }), 'quota');
  assert.equal(classifyFailure({ status: 408 }), 'transient');
  assert.equal(classifyFailure({ status: 503 }), 'transient');
  assert.equal(classifyFailure({ cause: { status: 402 } }), 'quota');
  assert.equal(classifyFailure({ code: 'WEB_PROVIDER_ERROR', cause: { httpStatus: 403 } }), 'auth');
  assert.equal(classifyFailure({ code: 'WEB_PROVIDER_ERROR', cause: { httpStatus: 503 } }), 'transient');
});

test('classifyFailure reads the status only after an unmatched code', () => {
  assert.equal(classifyFailure({ code: 'WEB_PROVIDER_ERROR', status: 503 }), 'transient');
  assert.equal(classifyFailure({ code: 'WEB_PROVIDER_ERROR' }), 'unknown');
  assert.equal(classifyFailure({ code: 'WEB_REDIRECT_BLOCKED' }), 'unknown');
  assert.equal(classifyFailure(new Error('network down')), 'unknown');
});
