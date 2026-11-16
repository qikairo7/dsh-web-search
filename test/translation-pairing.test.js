import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { splitSections, sectionHash, driftFor } from '../scripts/translation-pairing.mjs';

const EN = '# T\n\n## A\none\n\n## B\ntwo words\n';
const ZH = '# 标\n\n## 甲\n一\n\n## 乙\n二\n';

test('splitSections pairs by ordinal, preamble included', () => {
  const en = splitSections(EN);
  const zh = splitSections(ZH);
  assert.equal(en.length, 3);
  assert.equal(zh.length, 3);
  assert.equal(en[0].heading, '(preamble)');
  assert.equal(en[1].heading, 'A');
  assert.equal(zh[1].heading, '甲');
});

test('one-sided change reports drift with fix hint', () => {
  const record = { heading: 'A', en: sectionHash({ heading: 'A', body: ['old en'] }), zh: 'zh-hash' };
  const nowEn = sectionHash({ heading: 'A', body: ['new en'] });
  const drift = driftFor('A', record, nowEn, 'zh-hash');
  assert.ok(drift.includes('English side changed'));
  assert.ok(drift.includes('--record'));
});

test('both-sides change and no-change stay silent', () => {
  const record = { heading: 'A', en: 'e1', zh: 'z1' };
  assert.equal(driftFor('A', record, 'e2', 'z2'), null);
  assert.equal(driftFor('A', record, 'e1', 'z1'), null);
});

const GATE = fileURLToPath(new URL('../scripts/translation-pairing.mjs', import.meta.url));
const EN_DOC = '# T\n\n## A\none\n\n## B\ntwo words\n';
const ZH_DOC = '# 标\n\n## 甲\n一\n\n## 乙\n二\n';
const EN_DETAIL = '# D\n\n## DA\nalpha\n';
const ZH_DETAIL = '# 丁\n\n## 丁A\n阿尔法\n';

function makeGateDir() {
  const dir = mkdtempSync(join(tmpdir(), 'translation-pairing-'));
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'README.md'), EN_DOC);
  writeFileSync(join(dir, 'README.zh.md'), ZH_DOC);
  writeFileSync(join(dir, 'docs/DETAIL.md'), EN_DETAIL);
  writeFileSync(join(dir, 'docs/DETAIL.zh.md'), ZH_DETAIL);
  return dir;
}

function runGate(dir, ...args) {
  return spawnSync(process.execPath, [GATE, ...args], { cwd: dir, encoding: 'utf8' });
}

test('record writes a baseline only when every pair is structurally symmetric', (t) => {
  const dir = makeGateDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'README.md'), '# T\n\n## A\none\n\n## B\ntwo\n\n## C\nthree\n');
  const r = runGate(dir, '--record');
  assert.equal(r.status, 1, `expected failure, got stdout: ${r.stdout}`);
  assert.match(r.stderr, /structural symmetry/);
  assert.equal(existsSync(join(dir, 'docs/translation-pairs.json')), false);
});

test('record reports the number of baselines actually written', (t) => {
  const dir = makeGateDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = runGate(dir, '--record');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /recorded: 2 file\(s\)/);
});

test('check fails when a pair lost its baseline key', (t) => {
  const dir = makeGateDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  runGate(dir, '--record');
  const recordPath = join(dir, 'docs/translation-pairs.json');
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  delete record['docs/DETAIL.md'];
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  const r = runGate(dir);
  assert.equal(r.status, 1, `expected failure, got stdout: ${r.stdout}`);
  assert.match(r.stderr, /docs\/DETAIL\.md missing from/);
});

test('check fails when both sides insert a section without re-recording', (t) => {
  const dir = makeGateDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  runGate(dir, '--record');
  writeFileSync(join(dir, 'README.md'), '# T\n\n## A0\nzero\n\n## A\none\n\n## B\ntwo words\n');
  writeFileSync(join(dir, 'README.zh.md'), '# 标\n\n## 甲0\n零\n\n## 甲\n一\n\n## 乙\n二\n');
  const r = runGate(dir);
  assert.equal(r.status, 1, `expected failure, got stdout: ${r.stdout}`);
  assert.match(r.stderr, /structure changed since record/);
});

test('check fails on a one-sided heading rename', (t) => {
  const dir = makeGateDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  runGate(dir, '--record');
  writeFileSync(join(dir, 'README.md'), '# T\n\n## A2\none\n\n## B\ntwo words\n');
  const r = runGate(dir);
  assert.equal(r.status, 1, `expected failure, got stdout: ${r.stdout}`);
  assert.match(r.stderr, /heading changed since record/);
});

test('R-013 title half: retitled heading changes the hash', () => {
  const before = sectionHash({ heading: 'A', body: ['one'] });
  const after = sectionHash({ heading: 'Renamed', body: ['one'] });
  assert.notEqual(before, after, 'retitling must alter the hash so single-side title drift is caught');
});
