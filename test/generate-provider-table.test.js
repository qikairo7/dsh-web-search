import test from 'node:test';
import assert from 'node:assert/strict';

import { PROVIDER_CATALOG } from '../lib/catalog.js';
import {
  START,
  END,
  renderProviderTable,
  checkRegionDrift,
  replaceRegion,
} from '../scripts/generate-provider-table.mjs';

const wrap = (table) => `# t\n\n${START}\n${table}\n${END}\n`;

test('renderProviderTable has a header plus one row per catalog entry', () => {
  const lines = renderProviderTable().split('\n');
  assert.equal(lines.length, PROVIDER_CATALOG.length + 2);
  assert.match(lines[0], /Provider.*能力.*Tier.*认证方式/);
});

test('renderProviderTable maps capability, tier and auth from catalog + defaults', () => {
  const table = renderProviderTable();
  assert.match(table, /\| `bing` \| 搜索 \| 免 Key \| 免 Key \|/);
  assert.match(table, /\| `tavily` \| 搜索、抓取、域内搜索 \| 付费 \| API Key（`TAVILY_API_KEY`） \|/);
  assert.match(table, /\| `http` \| 抓取 \| 免费 \| 免 Key \|/);
});

test('checkRegionDrift is green when the region matches the generated table', () => {
  const table = renderProviderTable();
  assert.deepEqual(checkRegionDrift(wrap(table), table), { ok: true });
});

test('checkRegionDrift is red, naming the line, when the markdown table was hand-edited', () => {
  const table = renderProviderTable();
  const tampered = table.replace(
    '| `bing` | 搜索 | 免 Key | 免 Key |',
    '| `bing` | 搜索 | 免费 | 免 Key |',
  );
  const result = checkRegionDrift(wrap(tampered), table);
  assert.equal(result.ok, false);
  assert.match(result.message, /providers\.md:\d+/);
  assert.match(result.message, /got:.*免费/);
  assert.match(result.message, /want:.*免 Key/);
});

test('checkRegionDrift is red when lib/catalog.js changes a field without regenerating', () => {
  const committed = renderProviderTable();
  const mutated = PROVIDER_CATALOG.map((entry) =>
    entry.id === 'anysearch' ? { ...entry, tier: 'paid' } : entry,
  );
  const regenerated = renderProviderTable(mutated);
  const result = checkRegionDrift(wrap(committed), regenerated);
  assert.equal(result.ok, false);
  assert.match(result.message, /providers\.md:\d+.*drifted/);
});

test('checkRegionDrift is red when the markers are missing', () => {
  const result = checkRegionDrift('# no markers here\n', renderProviderTable());
  assert.equal(result.ok, false);
  assert.match(result.message, /markers not found/);
});

test('replaceRegion swaps only the marked region body', () => {
  const next = replaceRegion(wrap('OLD'), 'NEW');
  assert.match(next, new RegExp(`${START}\\nNEW\\n${END}`));
  assert.ok(next.startsWith('# t\n'));
});
