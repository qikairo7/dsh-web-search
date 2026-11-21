#!/usr/bin/env node
/** CLI: score task cards and skills against the four-dimension rubric.
 * Observe-only — prints a score table and warns when a card has no constraints
 * section, but never sets a non-zero exit code, so it can run without blocking a submit.
 *
 * Usage:
 *   node scripts/check-cards.mjs --cards <dir> --skills <dir>
 *   node scripts/check-cards.mjs <file-or-dir> ...
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { scoreCard, formatRubricTable } from './card-rubric.mjs';

const USAGE = [
  'check-cards: 卡面四维 rubric 质检（角色 / 任务 / 约束 / 示例），只提醒不拦提交。',
  '用法:',
  '  node scripts/check-cards.mjs --cards <dir> --skills <dir>',
  '  node scripts/check-cards.mjs <file-or-dir> ...',
].join('\n');

async function collectMarkdown(dir, recursive) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) files.push(...(await collectMarkdown(full, recursive)));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

async function collectSkills(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    // Follow symlinked skill dirs too: existsSync resolves the link to its SKILL.md.
    const skill = path.join(dir, entry.name, 'SKILL.md');
    if (existsSync(skill)) files.push(skill);
  }
  return files;
}

async function main(argv) {
  const cardDirs = [];
  const skillDirs = [];
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cards') cardDirs.push(argv[(index += 1)]);
    else if (arg === '--skills') skillDirs.push(argv[(index += 1)]);
    else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      return;
    } else positional.push(arg);
  }

  const targets = [];
  for (const dir of cardDirs) {
    for (const file of await collectMarkdown(dir, false)) {
      targets.push({ name: path.basename(file), file });
    }
  }
  for (const dir of skillDirs) {
    for (const file of await collectSkills(dir)) {
      targets.push({ name: path.basename(path.dirname(file)) + '/SKILL.md', file });
    }
  }
  for (const given of positional) {
    const full = path.resolve(given);
    const info = await stat(full);
    if (info.isDirectory()) {
      for (const file of await collectMarkdown(full, true)) {
        targets.push({ name: path.relative(process.cwd(), file), file });
      }
    } else targets.push({ name: path.basename(full), file: full });
  }

  if (targets.length === 0) {
    console.error(USAGE);
    return;
  }

  const rows = [];
  for (const target of targets) {
    rows.push({ name: target.name, scores: scoreCard(await readFile(target.file, 'utf8')) });
  }
  console.log(formatRubricTable(rows));

  const missingConstraints = rows.filter((row) => !row.scores.constraints);
  if (missingConstraints.length > 0) {
    console.log('');
    for (const row of missingConstraints) {
      console.warn('WARN ' + row.name + ': 缺约束节（提醒，不拦提交）');
    }
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error('check-cards failed: ' + error.message);
});
