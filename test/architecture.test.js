import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function jsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await jsFiles(path)));
    else if (entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}

test('lib does not call the paid DeepSeek search/fetch APIs', async () => {
  const forbidden = ['api.deepseek.com', '/v1/tools/search', '/v1/tools/fetch', 'x-dsh-auth-token'];
  for (const file of await jsFiles('lib')) {
    const text = await readFile(file, 'utf8');
    for (const pattern of forbidden) {
      assert.equal(text.includes(pattern), false, `${file} contains ${pattern}`);
    }
  }
});

test('package does not depend on an MCP server', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  assert.equal(Object.keys(deps).some((name) => name.startsWith('@modelcontextprotocol/')), false);
});
