import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const run = promisify(execFile);

const git = async (...args) => (await run('git', args, { maxBuffer: 64 * 1024 * 1024 })).stdout;
const tracked = async () => (await git('ls-files', '-z')).split('\0').filter(Boolean);

const FORBIDDEN_TRACKED = [
  { test: /^\.env(\..+)?$/, allow: /^\.env\.example$/, why: '密钥文件只留在本地' },
  { test: /(^|\/)(credentials|secrets?)\.(ya?ml|json|txt)$/i, why: '凭据库不进仓库' },
  { test: /\.(pem|key|p12|pfx)$/i, why: '私钥不进仓库' },
  { test: /\.jsonl$/i, why: '会话记录不进仓库' },
  { test: /\.tgz$/i, why: '打包产物不进仓库' },
  { test: /(^|\/)(LESSONS|decisions)\.(md|tsv)$/i, why: '错题集和决策日志只留在本地' },
  { test: /^\.agents\/(?!skills\/)/, why: '.agents 下只有 skills 进仓库' },
  { test: /^(\.codegraph|\.pnpm-store|node_modules|coverage|tmp|\.workflow-lite|\.research|\.local|\.worktrees)\//, why: '工具产物和工作记录不进仓库' },
  { test: /(^|\/)\.DS_Store$|(^|\/)Thumbs\.db$/, why: '系统文件不进仓库' },
];

const SHIP_TOP_LEVEL = new Set([
  'package.json', 'client.js', 'cordis.patch.yml', 'icon.svg', 'LICENSE',
  'README.md', 'README.en.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md',
  'SAFETY.md', 'SAFETY.zh.md', 'SECURITY.md', 'SECURITY.zh.md', 'TRADEMARKS.md', 'TRADEMARKS.zh.md',
]);
const SHIP_DIRS = new Set(['lib', 'locale', 'LICENSES', 'docs']);
const SHIP_DOCS = new Set(['docs/DETAIL.md', 'docs/DETAIL.en.md', 'docs/preview.svg', 'docs/changelog-archive.md']);

const MUST_SHIP = [
  'LICENSE',
  'LICENSES/Apache-2.0.txt',
  'LICENSES/geist-mono-OFL.txt',
  'LICENSES/inter-OFL.txt',
  'THIRD_PARTY_NOTICES.md',
  'docs/DETAIL.md',
  'docs/DETAIL.en.md',
];

async function packList() {
  const { stdout } = await run('pnpm', ['pack', '--dry-run'], { maxBuffer: 64 * 1024 * 1024, shell: true, env: { ...process.env, NODE_OPTIONS: '--no-deprecation' }, windowsHide: true });
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
  const offenders = files.flatMap((file) => FORBIDDEN_TRACKED
    .filter((rule) => rule.test.test(file) && !(rule.allow && rule.allow.test(file)))
    .map((rule) => `${file}  (${rule.why})`));
  assert.deepEqual(offenders, []);
});

test('a stray file on a local-only path is ignored, so git add cannot leak it', async () => {
  const localOnly = ['.env', 'deploy.pem', 'session.jsonl', 'pack.tgz', 'LESSONS.md', 'decisions.tsv', '.agents/notes/x.md', 'node_modules/x.js', '.codegraph/x', '.pnpm-store/x'];
  const ignored = new Set((await git('check-ignore', '--no-index', ...localOnly)).split(/\r?\n/).filter(Boolean));
  const leaking = localOnly.filter((file) => !ignored.has(file));
  assert.deepEqual(leaking, [], 'these paths must match a .gitignore rule');
  const kept = await git('check-ignore', '--no-index', '.env.example', '.agents/skills/verify/SKILL.md').catch(() => '');
  assert.equal(kept, '', '.env.example and .agents/skills must stay committable');
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

test('.env.example names variables but never carries a value', async () => {
  const text = await readFile('.env.example', 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line));
  assert.ok(lines.length >= 1, '.env.example should list at least one variable');
  const filled = lines.filter((line) => line.slice(line.indexOf('=') + 1).trim() !== '');
  assert.deepEqual(filled, []);
});

test('the doc set equals the agreed target list', { skip: process.env.BOUNDARY_DOCS === '1' ? false : 'opens once the doc removal in phase 2 lands' }, async () => {
  const target = (await readFile(new URL('./doc-target.txt', import.meta.url), 'utf8')).split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
  const actual = (await tracked()).filter((file) => file.endsWith('.md')).sort();
  assert.deepEqual(actual, target.sort());
});
