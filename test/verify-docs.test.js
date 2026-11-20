import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mirrorLinkErrors, budgetHeadroomWarnings } from '../scripts/doc-guards.mjs';

// --- Guard 1: mirror link language pairing ---------------------------------

const README_PAIR = { en: 'README.en.md', zh: 'README.md' };
const TRADEMARKS_PAIR = { en: 'TRADEMARKS.md', zh: 'TRADEMARKS.zh.md' };
const SAFETY_PAIR = { en: 'SAFETY.md', zh: 'SAFETY.zh.md' };
const DETAIL_PAIR = { en: 'docs/DETAIL.en.md', zh: 'docs/DETAIL.md' };

function reader(files) {
  return (path) => files[path];
}

test('mirror guard: normal pairing (en→en, zh→zh) stays green', () => {
  const errors = mirrorLinkErrors([README_PAIR, TRADEMARKS_PAIR], reader({
    'README.en.md': '[中文](README.md) / English\n[Trademarks](TRADEMARKS.md)\n',
    'README.md': '中文 / [English](README.en.md)\n[商标](TRADEMARKS.zh.md)\n',
    'TRADEMARKS.md': 'English | [中文](TRADEMARKS.zh.md)\n',
    'TRADEMARKS.zh.md': '[English](TRADEMARKS.md) | 中文\n',
  }));
  assert.deepEqual(errors, []);
});

test('mirror guard: both sides pointing at one Chinese file is red (R-21 shape)', () => {
  const errors = mirrorLinkErrors([README_PAIR, TRADEMARKS_PAIR], reader({
    'README.en.md': '[中文](README.md) / English\n[Trademarks](TRADEMARKS.zh.md)\n',
    'README.md': '中文 / [English](README.en.md)\n[商标](TRADEMARKS.zh.md)\n',
    'TRADEMARKS.md': 'English | [中文](TRADEMARKS.zh.md)\n',
    'TRADEMARKS.zh.md': '[English](TRADEMARKS.md) | 中文\n',
  }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /both link Chinese doc TRADEMARKS\.zh\.md/);
});

test('mirror guard: English side linking a Chinese .zh.md on its own is red', () => {
  const errors = mirrorLinkErrors([README_PAIR, TRADEMARKS_PAIR], reader({
    'README.en.md': '[Trademarks](TRADEMARKS.zh.md)\n',
    'README.md': '[商标](TRADEMARKS.md)\n',
    'TRADEMARKS.md': 'English | [中文](TRADEMARKS.zh.md)\n',
    'TRADEMARKS.zh.md': '[English](TRADEMARKS.md) | 中文\n',
  }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /README\.en\.md: English side links Chinese doc TRADEMARKS\.zh\.md/);
});

test('mirror guard: the pair-internal language switch link is not a violation', () => {
  const errors = mirrorLinkErrors([SAFETY_PAIR], reader({
    'SAFETY.md': 'English | [中文](SAFETY.zh.md)\n[License](LICENSE)\n',
    'SAFETY.zh.md': '[English](SAFETY.md) | 中文\n[许可](LICENSE)\n',
  }));
  assert.deepEqual(errors, []);
});

test('mirror guard: Chinese-base mirror targets (README.md, DETAIL.md) are not policed', () => {
  const errors = mirrorLinkErrors([README_PAIR, DETAIL_PAIR], reader({
    'README.en.md': '[中文](README.md)\n[Plugin details](docs/DETAIL.md)\n',
    'README.md': '[English](README.en.md)\n[插件详情](docs/DETAIL.md)\n',
    'docs/DETAIL.en.md': '[中文](DETAIL.md)\n',
    'docs/DETAIL.md': '[English](DETAIL.en.md)\n',
  }));
  assert.deepEqual(errors, []);
});

// --- Guard 2: budget headroom WARN -----------------------------------------

test('budget headroom: 5 codepoints left warns, 50 left does not', () => {
  const budgets = { 'a.md': 100, 'b.md': 100, minHeadroom: 10 };
  const warnings = budgetHeadroomWarnings(budgets, (file) => ({ 'a.md': 95, 'b.md': 50 })[file]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /a\.md: 95\/100 chars, headroom 5 < 10/);
});

test('budget headroom: default floor is 10 when minHeadroom is absent', () => {
  const warnings = budgetHeadroomWarnings({ 'a.md': 100 }, () => 95);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /headroom 5 < 10/);
});

test('budget headroom: boundary is strict — headroom 10 is silent, 9 warns', () => {
  assert.deepEqual(budgetHeadroomWarnings({ minHeadroom: 10, 'a.md': 100 }, () => 90), []);
  assert.equal(budgetHeadroomWarnings({ minHeadroom: 10, 'a.md': 100 }, () => 91).length, 1);
});

test('budget headroom: a custom minHeadroom field is honoured', () => {
  const budgets = { minHeadroom: 3, 'a.md': 100 };
  assert.equal(budgetHeadroomWarnings(budgets, () => 98).length, 1);
  assert.deepEqual(budgetHeadroomWarnings(budgets, () => 95), []);
});

test('budget headroom: over-budget files do not raise a WARN (they fail elsewhere)', () => {
  assert.deepEqual(budgetHeadroomWarnings({ minHeadroom: 10, 'a.md': 100 }, () => 120), []);
});
