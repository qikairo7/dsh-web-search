import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PAID_DEEPSEEK_MARKERS = ['api.deepseek.com', '/v1/tools/search', '/v1/tools/fetch', 'x-dsh-auth-token'];

async function jsFiles(dir, extensions = ['.js']) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await jsFiles(path, extensions)));
    else if (extensions.some((extension) => entry.name.endsWith(extension))) files.push(path);
  }
  return files;
}

test('lib does not call the paid DeepSeek search/fetch APIs', async () => {
  for (const file of await jsFiles('lib')) {
    const text = await readFile(file, 'utf8');
    for (const pattern of PAID_DEEPSEEK_MARKERS) {
      assert.equal(text.includes(pattern), false, `${file} contains ${pattern}`);
    }
  }
});

test('scripts only allow the benchmark runner to reference the paid DeepSeek APIs', async () => {
  const allowed = 'scripts/public-benchmark.mjs';
  let seenAllowed = false;
  for (const file of await jsFiles('scripts', ['.js', '.mjs'])) {
    const normalized = file.replaceAll('\\', '/');
    if (normalized === allowed) {
      seenAllowed = true;
      continue;
    }
    const text = await readFile(file, 'utf8');
    for (const pattern of PAID_DEEPSEEK_MARKERS) {
      assert.equal(text.includes(pattern), false, `${normalized} contains ${pattern}`);
    }
  }
  assert.equal(seenAllowed, true, `${allowed} was not found`);
});

test('package does not depend on an MCP server', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  assert.equal(Object.keys(deps).some((name) => name.startsWith('@modelcontextprotocol/')), false);
});
