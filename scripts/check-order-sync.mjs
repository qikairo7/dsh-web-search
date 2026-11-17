#!/usr/bin/env node
/** Order-doc sync: the default provider orders pasted in README.md,
 * README.zh.md, docs/configuration.md and cordis.patch.yml must match
 * DEFAULT_SEARCH_ORDERS from lib/roles.js verbatim (arrows or comma form).
 * The docs-driven counterpart of DSH's type-equiv gate: source is the single
 * authority; a drifted paste fails the check. */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SEARCH_ORDERS } from '../lib/roles.js';

const CHAINS = {
  chineseSearchOrder: DEFAULT_SEARCH_ORDERS.chineseSearchOrder,
  defaultSearchOrder: DEFAULT_SEARCH_ORDERS.defaultSearchOrder,
  fetchOrder: DEFAULT_SEARCH_ORDERS.fetchOrder,
  cleanFetchOrder: DEFAULT_SEARCH_ORDERS.cleanFetchOrder,
};

const KNOWN_IDS = new Set(Object.values(CHAINS).flat());

const ARROW_CHAIN_RE = /`([a-z-]+(?:\s*→\s*[a-z-]+){2,})`/g;
const COMMA_CHAIN_RE = /`?([a-z-]+(?:,[a-z-]+){2,})`?/g;

function normalizeArrow(match) {
  return match.split(/\s*→\s*/);
}

function normalizeComma(match) {
  return match.split(',');
}

/** Return violations for one scanned chain against the authoritative chains. */
export function checkChain(parts) {
  if (parts.length < 3 || !parts.every((id) => KNOWN_IDS.has(id))) return null;
  const hit = Object.entries(CHAINS).find(([, chain]) =>
    chain.length === parts.length && chain.every((id, i) => id === parts[i]));
  if (hit) return null;
  const closest = Object.keys(CHAINS).join(', ');
  return `provider order "${parts.join(' → ')}" matches none of ${closest} — update the doc paste or lib/roles.js`;
}

function* scan(text, regex, normalize) {
  for (const match of text.matchAll(regex)) {
    yield normalize(match[1]);
  }
}

async function scanFile(path, failures) {
  const text = await readFile(path, 'utf8');
  for (const parts of scan(text, ARROW_CHAIN_RE, normalizeArrow)) {
    const violation = checkChain(parts);
    if (violation) failures.push(`${path}: ${violation}`);
  }
  if (path.endsWith('configuration.md') || path.endsWith('cordis.patch.yml')) {
    for (const parts of scan(text, COMMA_CHAIN_RE, normalizeComma)) {
      const violation = checkChain(parts);
      if (violation) failures.push(`${path}: ${violation}`);
    }
  }
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const failures = [];
  for (const file of ['README.md', 'README.zh.md', 'docs/configuration.md', 'cordis.patch.yml']) {
    await scanFile(file, failures);
  }
  if (failures.length > 0) {
    console.error(`order-doc sync failed: ${failures.length} drift(s)`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`order-doc sync ok: 4 files, ${Object.keys(CHAINS).length} chains`);
  }
}
