import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../scripts/check-outbound.mjs', import.meta.url));

function run(file) {
  return spawnSync(process.execPath, [CLI, file, '--at', 'qikairo-bot'], { encoding: 'utf8' });
}

test('outbound check exits 1 on a red draft and 0 on a green one', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'outbound-'));
  try {
    const red = path.join(dir, 'red.md');
    writeFileSync(red, '这张单收到了，"好的" 这种开头不行，子代理也说过。');
    const redRun = run(red);
    assert.equal(redRun.status, 1, `red draft must fail: ${redRun.stdout}`);
    assert.match(redRun.stdout, /不过，/);

    const green = path.join(dir, 'green.md');
    writeFileSync(green, '@qikairo-bot 收到，查过了。根因在 lib/providers/http.js，下一步开单排在本轮。');
    const greenRun = run(green);
    assert.equal(greenRun.status, 0, `green draft must pass: ${greenRun.stdout}`);
    assert.match(greenRun.stdout, /^过$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});