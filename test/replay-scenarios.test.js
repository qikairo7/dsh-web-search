import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { SCENARIOS } from '../scripts/replay/scenarios.mjs';

// 回放考卷的场景库自检：数量、可追溯字段、注入点唯一。回放器（scripts/replay-suite.mjs）
// 负责真正跑红跑绿，这里只守住「题库结构不腐」——删场景、丢 commit、改坏注入点都当场变红。

test('场景库保持在 15-25 条且 id 唯一', () => {
  assert.ok(SCENARIOS.length >= 15 && SCENARIOS.length <= 25, '场景数 ' + SCENARIOS.length + ' 不在 15-25');
  const ids = SCENARIOS.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length, '场景 id 重复');
});

test('每条场景都能追溯到一条历史修复（ref + commit + 守卫用例）', () => {
  for (const scenario of SCENARIOS) {
    assert.match(scenario.title, /\S/u, scenario.id + ' 缺 title');
    assert.match(scenario.ref, /\S/u, scenario.id + ' 缺历史依据 ref');
    assert.match(scenario.commit, /^[0-9a-f]{7,40}$/u, scenario.id + ' 的 commit 不是 SHA');
    assert.match(scenario.guardFile, /^test\/.+\.test\.js$/u, scenario.id + ' 的守卫用例不在 test/');
    assert.ok(existsSync(scenario.guardFile), scenario.id + ' 的守卫文件不存在：' + scenario.guardFile);
    assert.match(scenario.guardPattern, /\S/u, scenario.id + ' 缺 guardPattern');
  }
});

test('每条场景的注入点在源码里唯一且确实改动', () => {
  for (const scenario of SCENARIOS) {
    const { file, from, to } = scenario.mutation;
    assert.ok(existsSync(file), scenario.id + ' 的注入文件不存在：' + file);
    assert.notEqual(from, to, scenario.id + ' 的 from/to 相同');
    const text = readFileSync(file, 'utf8');
    const occurrences = text.split(from).length - 1;
    assert.equal(occurrences, 1, scenario.id + ' 的注入点在 ' + file + ' 出现 ' + occurrences + ' 次（须为 1）');
  }
});
