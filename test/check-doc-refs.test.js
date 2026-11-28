import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pathRef, commandRefs, scanMarkdown } from '../scripts/check-doc-refs.mjs';

const CLI = fileURLToPath(new URL('../scripts/check-doc-refs.mjs', import.meta.url));

// Git exports GIT_DIR & friends to hooks; a hook running `pnpm check` would then
// make the child git calls below write into the outer repo's index. Strip them so
// the throwaway repos stay self-contained.
const GIT_ENV = { ...process.env };
for (const key of [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
]) delete GIT_ENV[key];

const ROOTS = new Set(['scripts', 'lib', 'docs', 'test', 'locale', '.agents', '.github']);
const normal = (p) => p.replaceAll('\\', '/');

test('pathRef accepts a repo-relative path with a real top-level directory', () => {
  assert.equal(pathRef('scripts/foo.mjs', ROOTS), 'scripts/foo.mjs');
  assert.equal(pathRef('docs/AGENTS.md', ROOTS), 'docs/AGENTS.md');
});

test('pathRef drops a line suffix and keeps only the file part', () => {
  assert.equal(pathRef('scripts/foo.mjs:123', ROOTS), 'scripts/foo.mjs');
  assert.equal(pathRef('lib/a.js:12-30', ROOTS), 'lib/a.js');
});

test('pathRef ignores bare filenames, URLs, package names, globs and foreign paths', () => {
  assert.equal(pathRef('index.js', ROOTS), null);
  assert.equal(pathRef('https://example.com/x', ROOTS), null);
  assert.equal(pathRef('@scope/pkg', ROOTS), null);
  assert.equal(pathRef('lib/tools/*.js', ROOTS), null);
  assert.equal(pathRef('core/paths.ts', ROOTS), null); // top-level not ours
  assert.equal(pathRef('docs/', ROOTS), null); // directory shorthand
  assert.equal(pathRef('lib/engines/bing.js', ROOTS), null); // upstream notices
});

test('commandRefs finds node script paths and pnpm script names', () => {
  assert.deepEqual(commandRefs('node scripts/a.mjs'), [{ kind: 'node', token: 'scripts/a.mjs' }]);
  assert.deepEqual(commandRefs('node --check lib/index.js'), [{ kind: 'node', token: 'lib/index.js' }]);
  assert.deepEqual(commandRefs('node --test --test-isolation=none test/x.test.js'), [
    { kind: 'node', token: 'test/x.test.js' },
  ]);
  assert.deepEqual(commandRefs('pnpm check'), [{ kind: 'pnpm', token: 'check' }]);
  assert.deepEqual(commandRefs('pnpm install --frozen-lockfile'), [{ kind: 'pnpm', token: 'install' }]);
});

test('commandRefs ignores node without a script path and placeholders', () => {
  assert.deepEqual(commandRefs('node --test'), []);
  assert.deepEqual(commandRefs('node -e "x"'), []);
  assert.deepEqual(commandRefs('node test/<name>.test.js'), []);
});

test('scanMarkdown reports a path that does not exist, with location and suggested action', () => {
  const exists = (p) => normal(p) === 'scripts/ok.mjs';
  const failures = scanMarkdown('see `scripts/gone.mjs` here', 'docs/x.md', {
    repoRoots: ROOTS,
    scripts: new Set(['check']),
    exists,
    rootDir: '',
  });
  assert.equal(failures.length, 1);
  assert.ok(failures[0].startsWith('docs/x.md:1:'), failures[0]);
  assert.ok(failures[0].includes('scripts/gone.mjs'), failures[0]);
  assert.ok(failures[0].includes('建议'), failures[0]);
});

test('scanMarkdown stays silent for existing files (line suffix ignored) and fenced code', () => {
  const exists = (p) => normal(p) === 'scripts/ok.mjs';
  const text = [
    'live: `scripts/ok.mjs:42`',
    '```sh',
    'node scripts/gone.mjs',
    'scripts/gone.mjs',
    '```',
  ].join('\n');
  const failures = scanMarkdown(text, 'docs/x.md', {
    repoRoots: ROOTS,
    scripts: new Set(['check']),
    exists,
    rootDir: '',
  });
  assert.deepEqual(failures, []);
});

test('scanMarkdown reports missing command targets and unknown pnpm scripts', () => {
  const exists = (p) => normal(p) === 'scripts/ok.mjs';
  const text = ['`node scripts/gone.mjs`', '`pnpm nope`', '`pnpm check`'].join('\n');
  const failures = scanMarkdown(text, 'docs/x.md', {
    repoRoots: ROOTS,
    scripts: new Set(['check']),
    exists,
    rootDir: '',
  });
  assert.equal(failures.length, 2);
  assert.ok(failures[0].includes('命令引用的脚本不存在'), failures[0]);
  assert.ok(failures[1].includes('pnpm 脚本不存在') && failures[1].includes('nope'), failures[1]);
});

/** Build a throwaway git repo mirroring the CLI's layout, then run the real
 * script against it. Locks the isMain entry and the SKIP_FILE set end to end. */
function runCliInTmpRepo(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'docrefs-'));
  mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  copyFileSync(CLI, path.join(dir, 'scripts', 'check-doc-refs.mjs'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { check: 'x' } }));
  for (const [name, text] of Object.entries(files)) {
    const target = path.join(dir, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  execFileSync('git', ['init', '-q'], { cwd: dir, env: GIT_ENV });
  execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '-A'], { cwd: dir, env: GIT_ENV });
  const run = () =>
    spawnSync(process.execPath, [path.join(dir, 'scripts', 'check-doc-refs.mjs')], { cwd: dir, env: GIT_ENV, encoding: 'utf8' });
  return { dir, run, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('CLI entry exits 0 on a clean tree and 1 when tracked markdown cites a missing script', () => {
  const repo = runCliInTmpRepo({
    'docs/ok.md': '见 `scripts/real.mjs`\n',
    'scripts/real.mjs': '// real target\n',
  });
  try {
    const good = repo.run();
    assert.equal(good.status, 0, `expected exit 0, got ${good.status}: ${good.stderr}`);

    writeFileSync(path.join(repo.dir, 'docs', 'bad.md'), '见 `scripts/missing.mjs`\n');
    execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '-A'], { cwd: repo.dir, env: GIT_ENV });
    const bad = repo.run();
    assert.equal(bad.status, 1, `expected exit 1, got ${bad.status}: ${bad.stderr}`);
    assert.match(bad.stderr, /scripts\/missing\.mjs/);
  } finally {
    repo.cleanup();
  }
});

test('CLI skips historical no-rewrite files but still checks ordinary markdown', () => {
  const broken = '见 `lib/gone.js`\n';
  const repo = runCliInTmpRepo({
    'lib/real.js': '// real\n',
    'docs/adr/0010-x.md': broken,
    'CHANGELOG.md': broken,
    'docs/changelog-archive.md': broken,
  });
  try {
    const historical = repo.run();
    assert.equal(historical.status, 0, `historical files must be skipped: ${historical.stderr}`);

    writeFileSync(path.join(repo.dir, 'docs', 'live.md'), broken);
    execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '-A'], { cwd: repo.dir, env: GIT_ENV });
    const live = repo.run();
    assert.equal(live.status, 1, `ordinary markdown must still be checked: ${live.stderr}`);
    assert.match(live.stderr, /lib\/gone\.js/);
  } finally {
    repo.cleanup();
  }
});
