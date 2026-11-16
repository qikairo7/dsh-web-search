import test from 'node:test';
import assert from 'node:assert/strict';

import { validatePrBody } from '../scripts/check-pr-gate.mjs';

const validBody = `## Summary

Add a real PR gate.

## Evidence

- **Before:** no gate existed.
  **After:** the gate rejects missing sections.

## Merge Danger

**Door:** two-way

**Blast Radius:** pull request workflow
`;

test('PR gate accepts a complete body', () => {
  assert.deepEqual(validatePrBody(validBody), { ok: true, errors: [] });
});

test('PR gate rejects missing sections', () => {
  const result = validatePrBody('## Summary\n\nOnly a summary.\n');
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /missing required section: ## Evidence/);
  assert.match(result.errors.join('\n'), /missing required section: ## Merge Danger/);
});

test('PR gate rejects empty evidence and missing door', () => {
  const result = validatePrBody(`## Summary

A sufficiently long summary.

## Evidence

- **Before:** 
  **After:** 

## Merge Danger

**Blast Radius:** pull request workflow
`);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /non-empty Before/);
  assert.match(result.errors.join('\n'), /non-empty After/);
  assert.match(result.errors.join('\n'), /Door:/);
});

test('PR gate rejects out-of-order sections', () => {
  const result = validatePrBody(`## Merge Danger

**Door:** two-way

**Blast Radius:** pull request workflow

## Summary

A sufficiently long summary.

## Evidence

- **Before:** old
  **After:** new
`);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /sections must appear in order/);
});

test('PR gate requires an exact Door value', () => {
  const invalidValues = ['not-one-way', 'one-way or two-way'];
  for (const value of invalidValues) {
    const result = validatePrBody(`## Summary

A sufficiently long summary.

## Evidence

- **Before:** old
  **After:** new

## Merge Danger

**Door:** ${value}

**Blast Radius:** pull request workflow
`);
    assert.equal(result.ok, false, value);
    assert.match(result.errors.join('\n'), /Door: one-way or Door: two-way/);
  }
});

test('PR gate rejects placeholders in Summary and Blast Radius', () => {
  const result = validatePrBody(`## Summary

TODO TODO TODO.

## Evidence

- **Before:** old
  **After:** new

## Merge Danger

**Door:** two-way

**Blast Radius:** TBD
`);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Summary still contains a placeholder/);
  assert.match(result.errors.join('\n'), /Blast Radius still contains a placeholder/);
});
