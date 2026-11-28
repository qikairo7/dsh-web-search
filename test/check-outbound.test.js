import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../scripts/check-outbound.mjs', import.meta.url));
const HANDLE = 'qikairo-bot';

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

function withDir(body) {
  const dir = mkdtempSync(path.join(tmpdir(), 'outbound-'));
  try {
    return body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function draft(dir, name, text) {
  const file = path.join(dir, name);
  writeFileSync(file, text);
  return file;
}

test('outbound check exits 1 on a red draft and 0 on a green one', () => withDir((dir) => {
  const red = draft(dir, 'red.md', '这张单收到了，"好的" 这种开头不行，子代理也说过。');
  const redRun = run([red, '--at', HANDLE]);
  assert.equal(redRun.status, 1, `red draft must fail: ${redRun.stdout}`);
  assert.match(redRun.stdout, /不过，/);

  const green = draft(dir, 'green.md', `@${HANDLE} 收到，查过了。根因在 lib/providers/http.js，下一步开单排在本轮。`);
  const greenRun = run([green, '--at', HANDLE]);
  assert.equal(greenRun.status, 0, `green draft must pass: ${greenRun.stdout}`);
  assert.match(greenRun.stdout, /^过$/m);
}));

test('a newline right after the handle opens the comment like a space does', () => withDir((dir) => {
  const lf = draft(dir, 'lf.md', `@${HANDLE}\n换行后的正文。\n`);
  const lfRun = run([lf, '--at', HANDLE]);
  assert.equal(lfRun.status, 0, `LF after the handle must pass: ${lfRun.stdout}`);

  const crlf = draft(dir, 'crlf.md', `@${HANDLE}\r\n换行后的正文。\r\n`);
  const crlfRun = run([crlf, '--at', HANDLE]);
  assert.equal(crlfRun.status, 0, `CRLF after the handle must pass: ${crlfRun.stdout}`);
}));

test('an ASCII quote is red even when the same text also uses Chinese quotes', () => withDir((dir) => {
  const mixed = draft(dir, 'mixed.md', `@${HANDLE} 这段用「重点」，下一句用 "bad" 试探。`);
  const mixedRun = run([mixed, '--at', HANDLE]);
  assert.equal(mixedRun.status, 1, `mixed quotes must fail: ${mixedRun.stdout}`);
  assert.match(mixedRun.stdout, /引号/);
}));

test('the account flag may come before the file name', () => withDir((dir) => {
  const file = draft(dir, 'order.md', `@${HANDLE} 参数顺序样例，账号在前文件在后。`);
  const result = run(['--at', HANDLE, file]);
  assert.equal(result.status, 0, `reversed arguments must pass: ${result.stderr}`);
  assert.match(result.stdout, /^过$/m);
}));

test('a missing account after --at is a parameter error, not a pass', () => withDir((dir) => {
  const file = draft(dir, 'missing.md', `@${HANDLE} 缺值样例，--at 后面不带账号。`);
  const result = run([file, '--at']);
  assert.notEqual(result.status, 0, `missing account must fail: ${result.stdout}`);
  assert.doesNotMatch(result.stdout, /^过$/m);
  assert.match(result.stdout, /--at/);
}));

test('a line-leading Markdown list hyphen is punctuation, not a dash', () => withDir((dir) => {
  const list = draft(dir, 'list.md', `@${HANDLE} 列表样例：\n- 列表项一，行首是 Markdown 连字符。\n- 列表项二。\n`);
  const listRun = run([list, '--at', HANDLE]);
  assert.equal(listRun.status, 0, `list hyphens must pass: ${listRun.stdout}`);
}));

test('--at accepts the handle with or without its @', () => withDir((dir) => {
  const right = draft(dir, 'right.md', `@${HANDLE} 前缀样例，开头账号对了。`);
  const rightRun = run([right, '--at', `@${HANDLE}`]);
  assert.equal(rightRun.status, 0, `prefixed handle must pass: ${rightRun.stdout}`);

  const wrong = draft(dir, 'wrong.md', `@someoneelse 前缀样例，开头账号错了。`);
  const wrongRun = run([wrong, '--at', `@${HANDLE}`]);
  assert.equal(wrongRun.status, 1, `wrong handle must stay red: ${wrongRun.stdout}`);
  assert.match(wrongRun.stdout, new RegExp(`应为 @${HANDLE}`));
  assert.doesNotMatch(wrongRun.stdout, /@@/);
}));