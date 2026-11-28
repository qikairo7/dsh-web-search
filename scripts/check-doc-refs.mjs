#!/usr/bin/env node
/** Doc reference gate: repo-relative file paths and command targets written in
 * inline code across tracked markdown must still exist. Catches the silent rot
 * where AGENTS.md and friends cite a script that was deleted or moved.
 *
 * Scope (paired with verify-docs.mjs, which owns markdown links, anchors and
 * budgets — this script never re-checks those):
 * - relative paths that contain a directory segment (e.g. `scripts/foo.mjs`);
 *   bare filenames like `index.js` are ambiguous shorthand and are skipped;
 * - `node <path>` and `pnpm <script>` targets inside inline code.
 * Excluded on purpose: fenced code blocks, URLs, package names (`@scope/x`),
 * globs/placeholders, `file.js:123` line suffixes (only the file is checked),
 * historical lifecycle notes and upstream paths cited in third-party notices.
 */

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Historical, no-rewrite zones (docs/AGENTS.md): lifecycle notes, ADRs and
// shipped changelog sections record past states and are never rewritten,
// so an old path there is load-bearing history, not a live reference to fix.
const SKIP_FILE = /^(?:(?:\.agents\/notes\/(?:implemented|proposed|rejected|archived)|docs\/adr)\/|CHANGELOG\.md$|docs\/changelog-archive\.md$)/;
// `lib/engines/*` are upstream repo files named in THIRD_PARTY_NOTICES, not ours.
const SKIP_REF_PREFIX = 'lib/engines/';
// Glob / placeholder marker: such a token is a shape, not a literal reference.
const PLACEHOLDER = /[<>*?{}[\]|]/;

// pnpm actions that are built into pnpm itself, not script names in package.json.
const PNPM_BUILTINS = new Set([
  'add', 'audit', 'bin', 'config', 'create', 'dedupe', 'deploy', 'dlx', 'doctor',
  'env', 'exec', 'fetch', 'i', 'import', 'init', 'install', 'licenses', 'link',
  'list', 'ls', 'outdated', 'pack', 'patch', 'patch-commit', 'prune', 'publish',
  'rebuild', 'remove', 'rm', 'root', 'run', 'server', 'setup', 'store', 'uninstall',
  'unlink', 'up', 'update', 'upgrade', 'why',
]);

/** Drop a trailing `:123` or `:123-130` line reference; only the file part is checked. */
function stripLineRef(token) {
  return token.replace(/:\d+(?:-\d+)?$/, '');
}

/** Normalize one inline-code span to a repo-relative file path, or null if it is
 * not a checkable reference. `repoRoots` is the set of real top-level names. */
export function pathRef(span, repoRoots) {
  const token = stripLineRef(span.trim());
  if (!token || /\s/.test(token)) return null;
  if (/^(?:https?:|mailto:|#)/i.test(token)) return null; // URL / anchor
  if (/^(?:@|~|\/)/.test(token)) return null; // package name / home / absolute
  if (/^[A-Za-z]:[\\/]/.test(token)) return null; // Windows absolute path
  if (PLACEHOLDER.test(token)) return null;
  if (token.endsWith('/')) return null; // directory shorthand
  if (!token.includes('/')) return null; // bare filename shorthand
  if (!repoRoots.has(token.split('/')[0])) return null; // reference to another repo
  if (token.startsWith(SKIP_REF_PREFIX)) return null;
  return token;
}

/** Extract `node <path>` and `pnpm <script>` targets from one inline-code span. */
export function commandRefs(span) {
  const refs = [];
  for (const match of span.matchAll(/\bnode\s+(?:--?\S+\s+)*([^\s&|;]+)/g)) {
    const target = stripLineRef(match[1]);
    if (PLACEHOLDER.test(target)) continue;
    if (/\.(?:mjs|js|cjs)$/.test(target)) refs.push({ kind: 'node', token: target });
  }
  for (const match of span.matchAll(/\bpnpm\s+([^\s&|;]+)/g)) {
    const name = match[1];
    if (name.startsWith('-')) continue;
    refs.push({ kind: 'pnpm', token: name.replace(/@[^@]*$/, '') });
  }
  return refs;
}

/** Scan one markdown document; push human-readable failures (file:line already
 * prefixed) into `failures`. Pure aside from the injected existence check so it
 * can be unit-tested without touching the filesystem. */
export function scanMarkdown(text, file, { repoRoots, scripts, exists = existsSync, rootDir = root }) {
  const failures = [];
  const lines = text.split(/\r?\n/);
  let inFence = false;
  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    for (const match of line.matchAll(/`([^`\n]+)`/g)) {
      const span = match[1];
      const at = `${file}:${index + 1}`;
      const ref = pathRef(span, repoRoots);
      if (ref && !exists(path.join(rootDir, ref))) {
        failures.push(`${at}: 失效引用 \`${span.trim()}\`（文件不存在）；建议：修正路径或恢复被引用的文件`);
      }
      for (const command of commandRefs(span)) {
        if (command.kind === 'node') {
          if (!exists(path.join(rootDir, command.token))) {
            failures.push(`${at}: 命令引用的脚本不存在 \`${span.trim()}\`；建议：恢复或重命名脚本，或更新文档`);
          }
        } else if (!scripts.has(command.token) && !PNPM_BUILTINS.has(command.token)) {
          failures.push(`${at}: pnpm 脚本不存在 \`${command.token}\`（见 \`${span.trim()}\`）；建议：核对 package.json 的 scripts 或更新文档`);
        }
      }
    }
  });
  return failures;
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  // Top-level names come from tracked files, not the live filesystem: an untracked
  // local dir (.research, etc.) must not turn a valid reference red on a dev machine
  // while CI's clean checkout stays green.
  const tracked = execSync('git ls-files -z', { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const repoRoots = new Set(tracked.map((file) => file.replaceAll('\\', '/').split('/')[0]));
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const scripts = new Set(Object.keys(pkg.scripts ?? {}));
  const files = tracked.map((file) => file.replaceAll('\\', '/')).filter((file) => file.endsWith('.md'));

  const failures = [];
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/');
    if (SKIP_FILE.test(normalized)) continue;
    const text = await readFile(path.join(root, normalized), 'utf8');
    failures.push(...scanMarkdown(text, normalized, { repoRoots, scripts }));
  }

  if (failures.length > 0) {
    console.error(`doc reference check failed (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`doc references ok: ${files.length} markdown files`);
  }
}
