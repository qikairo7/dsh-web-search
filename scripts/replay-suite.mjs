#!/usr/bin/env node
/**
 * 回放器：把历史修复的回归考卷逐条跑两遍，证明每条守卫「干净树过、注入旧 bug 红」。
 *
 * 单条命令：node scripts/replay-suite.mjs
 * 可选：--only=<id>（只跑一条，调试用）；--quiet（只打结论）。
 * 结果写 .research/replay/<日期>.json 与同目录 .md，并把一行趋势追加到 .research/replay/trend.md。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCENARIOS } from './replay/scenarios.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const onlyArg = args.find((arg) => arg.startsWith('--only='));
const only = onlyArg === undefined ? undefined : onlyArg.slice('--only='.length);
const dateArg = args.find((arg) => arg.startsWith('--date='));
const quiet = args.includes('--quiet');

/** Parse a TAP report's summary counters. */
function tapCounts(output) {
  const num = (label) => {
    const match = output.match(new RegExp('^# ' + label + ' (\\d+)$', 'm'));
    return match === null ? 0 : Number(match[1]);
  };
  return { tests: num('tests'), pass: num('pass'), fail: num('fail') };
}

/** Escape a literal test name into a regex (node --test-name-pattern is a RegExp). */
function escapePattern(name) {
  return name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Run one guard test by file + name pattern; returns pass/fail counts. */
function runGuard(file, pattern) {
  const result = spawnSync(
    process.execPath,
    ['--test', '--test-isolation=none', '--test-reporter=tap', '--test-name-pattern=' + escapePattern(pattern), file],
    { cwd: root, encoding: 'utf8', timeout: 120000 },
  );
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  return { counts: tapCounts(output), status: result.status, output };
}

/** Apply one literal mutation under a try/finally-safe restore; throws if the target is not unique. */
function withMutation(mutation, work) {
  const file = path.join(root, mutation.file);
  const original = readFileSync(file);
  const text = original.toString('utf8');
  const occurrences = text.split(mutation.from).length - 1;
  if (occurrences !== 1) {
    throw new Error('注入点不唯一（' + occurrences + ' 处）：' + mutation.file);
  }
  writeFileSync(file, text.replace(mutation.from, mutation.to));
  try {
    return work();
  } finally {
    writeFileSync(file, original);
    if (!readFileSync(file).equals(original)) throw new Error('回滚失败：' + mutation.file);
  }
}

const selected = only === undefined ? SCENARIOS : SCENARIOS.filter((s) => s.id === only);
if (selected.length === 0) {
  console.error('没有匹配的场景：' + String(only));
  process.exit(2);
}

const rows = [];
for (const scenario of selected) {
  const fixed = runGuard(scenario.guardFile, scenario.guardPattern);
  const fixedPass = fixed.counts.fail === 0 && fixed.counts.pass >= 1;
  let mutated = { counts: { tests: 0, pass: 0, fail: 0 } };
  let error;
  try {
    mutated = withMutation(scenario.mutation, () => runGuard(scenario.guardFile, scenario.guardPattern));
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const mutatedCaught = mutated.counts.fail >= 1;
  const caught = fixedPass && mutatedCaught && error === undefined;
  rows.push({
    id: scenario.id,
    title: scenario.title,
    ref: scenario.ref,
    commit: scenario.commit,
    fixed: fixedPass ? 'PASS' : 'FAIL',
    mutant: mutatedCaught ? 'FAIL' : 'PASS',
    caught,
    ...(error === undefined ? {} : { error }),
  });
  if (!quiet) {
    console.log(
      (caught ? '抓住' : '漏掉') + '  ' + scenario.id +
        '  修复码=' + (fixedPass ? 'PASS' : 'FAIL') +
        '  旧码=' + (mutatedCaught ? 'FAIL' : 'PASS') +
        (error === undefined ? '' : '  错误=' + error),
    );
  }
}

const total = rows.length;
const recall = rows.filter((row) => row.caught).length;
const cleanBaseline = rows.filter((row) => row.fixed === 'PASS').length;
const date = dateArg === undefined ? new Date().toISOString().slice(0, 10) : dateArg.slice('--date='.length);
const outDir = path.join(root, '.research', 'replay');
mkdirSync(outDir, { recursive: true });

const report = {
  date,
  total,
  recall,
  cleanBaseline,
  allCaught: recall === total && cleanBaseline === total,
  scenarios: rows,
};
writeFileSync(path.join(outDir, date + '.json'), JSON.stringify(report, null, 2) + '\n');

const lines = [
  '# 回放考卷基线报告 ' + date,
  '',
  '- 题库：' + total + ' 条；召回（旧码被抓）：' + recall + '/' + total + '；干净树基线通过：' + cleanBaseline + '/' + total,
  '',
  '| 场景 | 历史依据 | commit | 修复码 | 旧码 | 判定 |',
  '|---|---|---|---|---|---|',
  ...rows.map((row) =>
    '| ' + row.id + ' | ' + row.ref + ' | ' + row.commit + ' | ' + row.fixed + ' | ' + row.mutant + ' | ' + (row.caught ? '抓住' : '漏掉') + ' |',
  ),
  '',
];
writeFileSync(path.join(outDir, date + '.md'), lines.join('\n'));

const trendFile = path.join(outDir, 'trend.md');
const trendLine = '- ' + date + ' 题库 ' + total + ' 条，召回 ' + recall + '/' + total + '，基线干净树 ' + cleanBaseline + '/' + total;
const existing = existsSync(trendFile) ? readFileSync(trendFile, 'utf8') : '# 回放考卷周趋势\n\n';
const withoutToday = existing
  .split('\n')
  .filter((line) => !line.startsWith('- ' + date + ' '))
  .join('\n')
  .replace(/\n+$/, '');
writeFileSync(trendFile, withoutToday + '\n' + trendLine + '\n');

console.log('');
console.log('题库 ' + total + ' 条，召回 ' + recall + '/' + total + '，干净树基线通过 ' + cleanBaseline + '/' + total);
console.log('报告：.research/replay/' + date + '.json 与 .md；趋势：.research/replay/trend.md');
process.exitCode = report.allCaught ? 0 : 1;
