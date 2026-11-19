#!/usr/bin/env node
/** Order-doc sync: the default provider orders pasted in README.md,
 * README.en.md, docs/configuration.md and cordis.patch.yml must match
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

/** True when a and b differ by exactly one substitution, insertion, or deletion. */
function editDistanceOne(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i] && ++diff > 1) return false;
    }
    return true;
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (j < short.length) {
    if (long[i] === short[j]) {
      i++;
      j++;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    i++;
  }
  return true;
}

/** True when parts reproduce one authoritative chain verbatim. */
function matchesAuthority(parts) {
  return Object.values(CHAINS).some(
    (chain) => chain.length === parts.length && chain.every((id, i) => id === parts[i]),
  );
}

/** Return violations for one scanned chain against the authoritative chains.
 * Only sequences exactly as long as an authoritative chain are judged: shorter
 * legal fan-outs pass. An unknown id one edit away from a known id is a
 * reported typo; unknown ids far from every known id stay silent. */
export function checkChain(parts) {
  const authoritativeLength = Object.values(CHAINS).some((chain) => chain.length === parts.length);
  if (!authoritativeLength) return null;
  if (parts.every((id) => KNOWN_IDS.has(id))) {
    if (matchesAuthority(parts)) return null;
    const closest = Object.keys(CHAINS).join(', ');
    return `provider order "${parts.join(' → ')}" matches none of ${closest} — update the doc paste or lib/roles.js`;
  }
  const typos = [];
  for (const id of parts) {
    if (KNOWN_IDS.has(id)) continue;
    const known = [...KNOWN_IDS].find((k) => editDistanceOne(k, id));
    if (known) typos.push(`"${id}" looks like a typo of "${known}"`);
  }
  if (typos.length === 0) return null;
  const closest = Object.keys(CHAINS).join(', ');
  return `provider order "${parts.join(' → ')}" matches none of ${closest} — ${typos.join('; ')}`;
}

function* scan(text, regex, normalize) {
  for (const match of text.matchAll(regex)) {
    yield normalize(match[1]);
  }
}

export function scanText(text, path, failures) {
  let hits = 0;
  const scanAll = (regex, normalize) => {
    for (const parts of scan(text, regex, normalize)) {
      if (matchesAuthority(parts)) hits++;
      const violation = checkChain(parts);
      if (violation) failures.push(`${path}: ${violation}`);
    }
  };
  scanAll(ARROW_CHAIN_RE, normalizeArrow);
  if (path.endsWith('configuration.md') || path.endsWith('cordis.patch.yml')) {
    scanAll(COMMA_CHAIN_RE, normalizeComma);
  }
  return hits;
}

async function scanFile(path, failures) {
  const text = await readFile(path, 'utf8');
  return scanText(text, path, failures);
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const failures = [];
  let hits = 0;
  for (const file of ['README.md', 'README.en.md', 'docs/configuration.md', 'cordis.patch.yml']) {
    hits += await scanFile(file, failures);
  }
  if (failures.length > 0) {
    console.error(`order-doc sync failed: ${failures.length} drift(s)`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else if (hits === 0) {
    console.error('order-doc sync failed: 0 chain pastes matched — regex or doc format drift');
    process.exitCode = 1;
  } else {
    console.log(`order-doc sync ok: 4 files, ${hits} chain pastes`);
  }
}
