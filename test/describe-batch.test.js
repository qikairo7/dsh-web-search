import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

test('credentials describe batches stay under host MAX_DESCRIBE_REFS (64)', () => {
  const src = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  const m = src.match(/for \(let i = 0; i < refs\.length; i \+= (\d+)\)/);
  assert.ok(m, 'client.js must batch credentials.describe calls (#241)');
  const step = Number(m[1]);
  assert.ok(step <= 64, 'step must stay under host MAX_DESCRIBE_REFS=64');
  const w = src.match(/refs\.slice\(i, i \+ (\d+)\)/);
  assert.ok(w, 'batch window must exist');
  assert.ok(Number(w[1]) <= 64, 'batch window must stay under host MAX_DESCRIBE_REFS=64');
});
