#!/usr/bin/env node
/** Doc code-block gate: every fenced code block in tracked markdown that
 * declares an executable language (js/mjs/sh/bash) must at least parse.
 * Mirrors DSH's doc-typecheck idea at syntax level: a drifted or rotten
 * example fails `pnpm check` instead of misleading the reader. */

import { spawnSync } from 'node:child_process';
import { readFile, mkdtemp, rm, writeFile, glob } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = [
  'README.md',
  'README.zh.md',
  'CODING_STANDARDS.md',
  'docs/**/*.md',
];

const FENCE_RE = /```(js|mjs|sh|bash)\n(.*?)```/gs;

function checkerFor(lang) {
  if (lang === 'js' || lang === 'mjs') {
    return { cmd: process.execPath, args: (file) => ['--check', file], suffix: '.mjs' };
  }
  return { cmd: 'bash', args: (file) => ['-n', file], suffix: '.sh' };
}

/** Distinguish "the checker never ran" (spawn error) from "the block failed to parse". */
export function failureMessage(result, cmd, label) {
  if (result.error) return `${label}: checker '${cmd}' unavailable (${result.error.code})`;
  return `${label}: ${(result.stderr || 'parse error').split('\n').slice(0, 3).join(' | ')}`;
}

async function collectMarkdown() {
  const found = new Set();
  for (const pattern of FILES) {
    for await (const file of glob(pattern)) found.add(file.replaceAll('\\', '/'));
  }
  return [...found].sort();
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const failures = [];
  const dir = await mkdtemp(join(tmpdir(), 'doc-code-'));
  try {
    for (const file of await collectMarkdown()) {
      const text = await readFile(file, 'utf8');
      let index = 0;
      for (const match of text.matchAll(FENCE_RE)) {
        index += 1;
        const lang = match[1];
        const body = match[2];
        if (!body.trim()) continue;
        const { cmd, args, suffix } = checkerFor(lang);
        const tmp = join(dir, `block-${index}${suffix}`);
        await writeFile(tmp, body, 'utf8');
        const result = spawnSync(cmd, args(tmp), { encoding: 'utf8' });
        if (result.error || result.status !== 0) {
          failures.push(failureMessage(result, cmd, `${file} (${lang} block #${index})`));
        }
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  if (failures.length > 0) {
    console.error(`doc code-block check failed: ${failures.length} block(s)`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('doc code-blocks ok');
  }
}
