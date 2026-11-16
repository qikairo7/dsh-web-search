#!/usr/bin/env node
/** Architecture lint: enforce the dependency direction
 * lib/index.js → lib/providers/* → lib/* shared modules.
 * Shared modules must not import providers/ or index.js; providers must not
 * import index.js. Rules from AGENTS.md, mechanically enforced (2026-11-17). */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IMPORT_RE = /(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]/g;

export function layerOf(file) {
  const rel = file.replaceAll('\\', '/');
  if (rel === 'lib/index.js') return 'index';
  if (rel.startsWith('lib/providers/') || rel.startsWith('lib/tools/')) return 'provider';
  if (rel.startsWith('lib/')) return 'shared';
  return null;
}

function resolveTarget(fromFile, specifier) {
  let target = relative('.', resolve('.', dirname(fromFile), specifier)).replaceAll('\\', '/');
  if (!target.endsWith('.js') && !target.endsWith('.mjs')) {
    target = `${target}.js`;
  }
  return target;
}

export function findViolations(file, specifiers) {
  const layer = layerOf(file);
  if (!layer) return [];
  const violations = [];
  for (const specifier of specifiers) {
    if (!specifier.startsWith('.')) continue;
    const target = resolveTarget(file, specifier);
    const targetLayer = layerOf(target);
    if (layer === 'shared' && (targetLayer === 'provider' || targetLayer === 'index')) {
      violations.push(`${file} imports ${target} (shared must not depend on providers or index)`);
    }
    if (layer === 'provider' && targetLayer === 'index') {
      violations.push(`${file} imports ${target} (providers must not depend on index)`);
    }
  }
  return violations;
}

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

async function extractSpecifiers(file) {
  const source = await readFile(file, 'utf8');
  const specifiers = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    specifiers.push(match[1] ?? match[2]);
  }
  return specifiers;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const files = await collect('lib');
  const violations = [];
  for (const file of files.sort()) {
    const rel = relative('.', file).replaceAll('\\', '/');
    violations.push(...findViolations(rel, await extractSpecifiers(file)));
  }
  if (violations.length > 0) {
    console.error(`architecture check failed: ${violations.length} violation(s)`);
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log(`architecture ok: ${files.length} files`);
  }
}
