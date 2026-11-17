import test from 'node:test';
import assert from 'node:assert/strict';

import { validatePrBody } from '../scripts/check-pr-gate.mjs';

const BADGE = '[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)';

const validBody = `## Summary

Add a real PR gate.

## Evidence

- **Before:** no gate existed.
  **After:** the gate rejects missing sections.

## Merge Danger

**Door:** two-way

**Blast Radius:** pull request workflow
**Revert:** git revert the squash commit

${BADGE}
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
**Revert:** git revert the squash commit
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
**Revert:** git revert the squash commit

## Summary

A sufficiently long summary.

## Evidence

- **Before:** old
  **After:** new
`);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /sections must appear in order/);
});

test('PR gate requires a Revert line in Merge Danger', () => {
  const body = validBody.replace('**Revert:** git revert the squash commit\n', '');
  const result = validatePrBody(body);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('Revert')));
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
**Revert:** git revert the squash commit
`);
    assert.equal(result.ok, false, value);
    assert.match(result.errors.join('\n'), /Door: one-way or Door: two-way/);
  }
});

test('PR gate rejects a body without the powered by dsh badge', () => {
  const result = validatePrBody(validBody.replace(`${BADGE}\n`, ''));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /powered by dsh badge/);
});

test('PR gate rejects a modified badge and a badge not in its own paragraph', () => {
  const wrongColor = validBody.replace(
    'powered_by-dsh-4D6BFE',
    'powered_by-dsh-000000',
  );
  assert.equal(validatePrBody(wrongColor).ok, false);

  const glued = validBody.replace(`**Revert:** git revert the squash commit\n\n${BADGE}`, `**Revert:** git revert the squash commit\n${BADGE}`);
  assert.equal(validatePrBody(glued).ok, false);
});

test('PR gate skips all body checks for automated PRs', () => {
  const result = validatePrBody('Bump actions/checkout from 4 to 7.', { author: 'dependabot[bot]' });
  assert.deepEqual(result, { ok: true, errors: [] });
  const bare = validatePrBody('Bump actions/checkout from 4 to 7.', { author: 'dependabot' });
  assert.equal(bare.ok, false);
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
