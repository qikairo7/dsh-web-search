#!/usr/bin/env node
/** Syntax-check every runtime, script and test module before running tests. */

import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['lib', 'scripts', 'test'];

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(full)));
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) files.push(full);
  }
  return files;
}

const files = ['client.js'];
for (const root of roots) files.push(...(await collect(root)));

const failures = [];
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    failures.push({ file: relative(process.cwd(), file), output: `exit code ${String(result.status)}` });
  }
}

if (failures.length > 0) {
  console.error(`syntax check failed: ${failures.length} file(s)`);
  for (const failure of failures) console.error(`- ${failure.file}: ${failure.output}`);
  process.exitCode = 1;
} else {
  console.log(`syntax ok: ${files.length} files`);
}
