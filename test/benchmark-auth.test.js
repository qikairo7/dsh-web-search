import test from 'node:test';
import assert from 'node:assert/strict';

import { deepseekAuthHeaders } from '../scripts/benchmark-auth.mjs';

test('DeepSeek API keys use Bearer auth', () => {
  assert.deepEqual(deepseekAuthHeaders('sk-example'), { authorization: 'Bearer sk-example' });
});

test('DSH account tokens use x-dsh-auth-token', () => {
  assert.deepEqual(deepseekAuthHeaders('dsh-example'), { 'x-dsh-auth-token': 'dsh-example' });
});
