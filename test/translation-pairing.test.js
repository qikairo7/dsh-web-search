import { test } from 'node:test';
import assert from 'node:assert/strict';

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
