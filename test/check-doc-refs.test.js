import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pathRef, commandRefs, scanMarkdown } from '../scripts/check-doc-refs.mjs';

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
