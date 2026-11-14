import test from 'node:test';
import assert from 'node:assert/strict';

import { isRecoverable } from '../lib/errors.js';

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
