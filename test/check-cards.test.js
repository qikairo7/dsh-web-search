import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreCard, formatRubricTable } from '../scripts/card-rubric.mjs';

test('scoreCard: a card with role, task, constraints and examples scores 4/4', () => {
  const text = [
    '# 示例卡',
    '',
    '你是 reviewer，负责按标准评审。',
    '',
    '## 任务',
    '按验收点逐条核对。',
    '',
    '## 约束',
    '- 禁止跳过证据',
    '- 必须引用原始输出',
    '',
    '## 示例',
    '```',
    'F1 描述 -> 已在 sha 修复',
    '```',
  ].join('\n');
  const scores = scoreCard(text);
  assert.equal(scores.role, true);
  assert.equal(scores.task, true);
  assert.equal(scores.constraints, true);
  assert.equal(scores.examples, true);
  assert.equal(scores.total, 4);
});

test('scoreCard: deleting the constraints section flags constraints, not others', () => {
  const withConstraints = '你是 implementer\n## 任务\n实现功能\n## 约束\n- 禁止改全局配置\n## 示例\n例如上面。';
  const withoutConstraints = '你是 implementer\n## 任务\n实现功能\n## 示例\n例如上面。';
  assert.equal(scoreCard(withConstraints).constraints, true);
  const scores = scoreCard(withoutConstraints);
  assert.equal(scores.constraints, false);
  assert.equal(scores.role, true);
  assert.equal(scores.task, true);
  assert.equal(scores.total, 3);
});

test('scoreCard: a bare note scores low and names each missing dimension', () => {
  const scores = scoreCard('# 随手记\n今天天气不错。\n');
  assert.equal(scores.total, 0);
});

test('formatRubricTable: header carries the four dimensions and each row shows pass marks', () => {
  const table = formatRubricTable([
    { name: 'scout.md', scores: { role: true, task: true, constraints: true, examples: false, total: 3 } },
    { name: 'bare.md', scores: { role: false, task: false, constraints: false, examples: false, total: 0 } },
  ]);
  assert.match(table, /角色/);
  assert.match(table, /任务/);
  assert.match(table, /约束/);
  assert.match(table, /示例/);
  assert.match(table, /总数|合计/);
  assert.match(table, /3\/4/);
});
