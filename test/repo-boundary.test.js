import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const run = promisify(execFile);

const git = async (...args) => {
  const { cwd = process.cwd() } = typeof args.at(-1) === 'object' ? args.pop() : {};
  return (await run('git', args, { maxBuffer: 64 * 1024 * 1024, cwd })).stdout;
};
const gitAllowingNoMatch = async (...args) => {
  const { cwd = process.cwd() } = typeof args.at(-1) === 'object' ? args.pop() : {};
  try {
    return (await run('git', args, { maxBuffer: 64 * 1024 * 1024, cwd })).stdout;
  } catch (error) {
    if (error.code === 1) return error.stdout;
    throw error;
  }
};
const tracked = async () => (await git('ls-files', '-z')).split('\0').filter(Boolean);

const LOCAL_ONLY_RULES = [
  { test: /^\.env(\..+)?$/, why: '密钥文件只留在本地' },
  { test: /(^|\/)\.?(credentials|secrets?)\.(ya?ml|json|txt)$/i, why: '凭据库不进仓库' },
  { test: /(^|\/)\.secret$/, why: '凭据库不进仓库' },
  { test: /\.(pem|key|p12|pfx)$/i, why: '私钥不进仓库' },
  { test: /\.jsonl$/i, why: '会话记录不进仓库' },
  { test: /\.tgz$/i, why: '打包产物不进仓库' },
  { test: /(^|\/)(LESSONS|REVIEW-LESSONS(-inbox|-archive)?)\.md$/i, why: '错题集只留在本地' },
  { test: /(^|\/)decisions\.tsv$/i, why: '决策日志只留在本地' },
  { test: /^\.agents\//, why: '.agents 只留在本地' },
  { test: /^(\.codegraph|\.pnpm-store|node_modules|coverage|tmp|\.workflow-lite|\.research|\.local|\.worktrees)\//, why: '工具产物和工作记录不进仓库' },
  { test: /(^|\/)\.DS_Store$|(^|\/)Thumbs\.db$/, why: '系统文件不进仓库' },
];

const SHIP_TOP_LEVEL = new Set([
  'package.json', 'client.js', 'cordis.patch.yml', 'icon.svg', 'LICENSE',
  'README.md', 'README.en.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md',
  'SAFETY.md', 'SAFETY.zh.md', 'SECURITY.md', 'SECURITY.zh.md', 'TRADEMARKS.md', 'TRADEMARKS.zh.md',
]);
const SHIP_DIRS = new Set(['lib', 'locale', 'LICENSES', 'docs']);
const SHIP_DOCS = new Set(['docs/DETAIL.md', 'docs/DETAIL.en.md', 'docs/preview.svg']);

const MUST_SHIP = [
  'LICENSE',
  'LICENSES/geist-mono-OFL.txt',
  'LICENSES/inter-OFL.txt',
  'THIRD_PARTY_NOTICES.md',
  'docs/DETAIL.md',
  'docs/DETAIL.en.md',
];

async function packList() {
  const { stdout } = await run('pnpm', ['pack', '--dry-run'], { maxBuffer: 64 * 1024 * 1024, shell: true, windowsHide: true });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.replace(/^npm notice\s+/, '').trim())
    .map((line) => line.replace(/^[\d.]+\s*[kMGT]?B\s+/, ''))
    .filter((line) => /^[A-Za-z.][^\s]*$/.test(line) && !/^[0-9.]+(B|kB|KB|MB)$/.test(line))
    .filter((line) => !/^(package size|unpacked size|shasum|integrity|filename|total files|name:|version:|Tarball Contents)/i.test(line))
    .filter((line) => !line.endsWith(':') && !line.endsWith('.tgz') && !line.includes('@'));
}

test('no tracked file sits on a path that must stay local', async () => {
  const files = await tracked();
  const offenders = files.flatMap((file) => LOCAL_ONLY_RULES
    .filter((rule) => rule.test.test(file) && !(rule.allow && rule.allow.test(file)))
    .map((rule) => `${file}  (${rule.why})`));
  assert.deepEqual(offenders, []);
});

test('a stray file on a local-only path is ignored, so git add cannot leak it', async () => {
  const localOnly = ['.env', '.credentials.yaml', '.secrets.yaml', 'credentials.yml', 'credentials.json', 'credentials.txt', 'secrets.yml', 'secrets.json', 'secrets.txt', 'deploy.pem', 'session.jsonl', 'pack.tgz', '.agents/notes/x.md', 'node_modules/x.js', '.codegraph/x', '.pnpm-store/x'];
  const ignored = new Set((await git('check-ignore', '--no-index', ...localOnly)).split(/\r?\n/).filter(Boolean));
  const leaking = localOnly.filter((file) => !ignored.has(file));
  assert.deepEqual(leaking, [], 'these paths must match a .gitignore rule');
});

test('kept files stay committable even when no ignore rule matches any of them', async () => {
  const keep = ['docs/decisions.md', 'test/doc-target.txt', 'docs/design/tokens.json'];
  const scratch = mkdtempSync(join(tmpdir(), 'repo-boundary-'));
  try {
    await git('init', { cwd: scratch });
    await writeFile(join(scratch, '.gitignore'), '');
    for (const file of keep) {
      mkdirSync(dirname(join(scratch, file)), { recursive: true });
      await writeFile(join(scratch, file), '');
    }
    const lines = (await gitAllowingNoMatch('-c', 'core.excludesFile=', 'check-ignore', '--no-index', '-v', '--non-matching', ...keep, { cwd: scratch })).split(/\r?\n/).filter(Boolean);
    assert.ok(lines.every((line) => line.startsWith('::')), 'check-ignore must reach the no-rule-matches state for every kept file');
    const ignored = lines.filter((line) => {
      const rule = line.slice(0, line.lastIndexOf('\t'));
      return rule !== '::' && !rule.includes(':!');
    }).map((line) => line.slice(line.lastIndexOf('\t') + 1));
    assert.deepEqual(ignored, [], 'these files must stay committable');
    const rejected = keep.filter((file) => LOCAL_ONLY_RULES.some((rule) => rule.test.test(file) && !(rule.allow && rule.allow.test(file))));
    assert.deepEqual(rejected, []);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('the package ships only files a user installing the plugin needs', async () => {
  const files = await packList();
  assert.ok(files.length > 20, `pack list looks truncated at ${files.length} entries`);
  const outside = files.filter((file) => {
    const top = file.split('/')[0];
    return SHIP_TOP_LEVEL.has(top) || SHIP_DIRS.has(top) ? false : file;
  });
  assert.deepEqual(outside, []);
  const stray = files.filter((file) => file.startsWith('docs/') && !SHIP_DOCS.has(file));
  assert.deepEqual(stray, [], 'docs/ in the package is limited to the shipped list');
  const testsInside = files.filter((file) => /^lib\/.*\.test\.js$/.test(file));
  assert.deepEqual(testsInside, []);
});

test('the package carries every licence and legal file it redistributes under', async () => {
  const files = await packList();
  const missing = MUST_SHIP.filter((file) => !files.includes(file));
  assert.deepEqual(missing, []);
});

test('the doc set equals the agreed target list', async () => {
  const target = (await readFile(new URL('./doc-target.txt', import.meta.url), 'utf8')).split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
  const actual = (await tracked()).filter((file) => file.endsWith('.md')).sort();
  assert.deepEqual(actual, target.sort());
});
