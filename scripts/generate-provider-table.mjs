#!/usr/bin/env node
/** Generate the provider capability table in docs/subsystems/providers.md from
 * lib/catalog.js. `pnpm docs:gen` rewrites the marked region; `pnpm docs:check`
 * runs checkRegionDrift, so a hand edit or a catalog change without regeneration
 * fails and names the drifting line. */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROVIDER_CATALOG } from '../lib/catalog.js';
import { DEFAULT_SETTINGS } from '../lib/settings.js';

export const START = '<!-- gen:provider-table start -->';
export const END = '<!-- gen:provider-table end -->';

const CAPABILITY_LABEL = { search: '搜索', fetch: '抓取', domainSearch: '域内搜索' };
const TIER_LABEL = { free: '免费', keyless: '免 Key', paid: '付费' };

/** Render the provider table from catalog entries plus their default auth. */
export function renderProviderTable(catalog = PROVIDER_CATALOG, defaults = DEFAULT_SETTINGS) {
  const lines = ['| Provider | 能力 | Tier | 认证方式 |', '|---|---|---|---|'];
  for (const entry of catalog) {
    const capabilities = entry.capabilities.map((cap) => CAPABILITY_LABEL[cap] ?? cap).join('、');
    const tier = TIER_LABEL[entry.tier] ?? entry.tier;
    const apiKeyEnv = defaults[entry.settingsKey]?.apiKeyEnv;
    const auth = apiKeyEnv ? `API Key（\`${apiKeyEnv}\`）` : '免 Key';
    lines.push(`| \`${entry.id}\` | ${capabilities} | ${tier} | ${auth} |`);
  }
  return lines.join('\n');
}

function sliceRegion(text) {
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start < 0 || end < 0 || end < start) return null;
  return { start, end, body: text.slice(start + START.length, end) };
}

/** Replace the marked region with the given table; throws if markers are missing. */
export function replaceRegion(text, table) {
  const region = sliceRegion(text);
  if (!region) throw new Error(`provider table markers not found (${START} / ${END})`);
  return text.slice(0, region.start + START.length) + '\n' + table + '\n' + text.slice(region.end);
}

/** Compare the marked region against the freshly rendered table.
 * Returns { ok: true } or { ok: false, message } naming the first drifting file line. */
export function checkRegionDrift(text, expectedTable) {
  const region = sliceRegion(text);
  if (!region) return { ok: false, message: `provider table markers not found (${START} / ${END})` };
  const actual = region.body.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
  if (actual === expectedTable) return { ok: true };
  const actualLines = actual.split(/\r?\n/);
  const expectedLines = expectedTable.split(/\r?\n/);
  let index = 0;
  while (
    index < actualLines.length &&
    index < expectedLines.length &&
    actualLines[index] === expectedLines[index]
  ) index += 1;
  const markerLine = text.slice(0, region.start).split(/\r?\n/).length;
  const driftLine = markerLine + 1 + index;
  const got = actualLines[index] ?? '<missing line>';
  const want = expectedLines[index] ?? '<extra line>';
  return {
    ok: false,
    message: `docs/subsystems/providers.md:${driftLine}: provider table drifted from lib/catalog.js\n  got:  ${got}\n  want: ${want}\n  run pnpm docs:gen to regenerate`,
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const providersFile = resolve(here, '..', 'docs/subsystems/providers.md');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = await readFile(providersFile, 'utf8');
  await writeFile(providersFile, replaceRegion(text, renderProviderTable()), 'utf8');
  console.log('docs:gen regenerated the provider table in docs/subsystems/providers.md');
}
