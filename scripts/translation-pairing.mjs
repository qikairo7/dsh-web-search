#!/usr/bin/env node
/** Translation-pairing gate (lightweight .i18n.yaml counterpart): README.md
 * and README.zh.md are paired section-by-section (Nth `##` section to Nth).
 * A recorded hash per section detects one-sided drift — the English section
 * changed while its Chinese pair (or vice versa) did not — and fails the
 * check until both sides move together; `--record` re-baselines after an
 * intentional synchronized edit. Pairing basis is section ordinal, because
 * structural symmetry (heading count) is already enforced by verify-docs.
 * Outside record mode the recorded count and headings are re-verified, so a
 * structural edit that skipped `--record` fails loudly instead of mis-pairing. */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAIRS = [
  { en: 'README.md', zh: 'README.zh.md' },
  { en: 'docs/DETAIL.md', zh: 'docs/DETAIL.zh.md' },
];
const RECORD = 'docs/translation-pairs.json';

export function splitSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = { heading: '(preamble)', body: [] };
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      sections.push(current);
      current = { heading: line.replace(/^##\s+/, ''), body: [] };
    } else {
      current.body.push(line);
    }
  }
  sections.push(current);
  return sections;
}

export function sectionHash(section) {
  const normalized = `${section.heading}\n${section.body.join('\n')}`.replace(/\s+/gu, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/** Report one-sided drift between recorded and current section hashes. */
export function driftFor(heading, record, nowEn, nowZh) {
  const enChanged = record.en !== nowEn;
  const zhChanged = record.zh !== nowZh;
  if (enChanged === zhChanged) return null;
  const changed = enChanged ? 'English' : 'Chinese';
  const stale = enChanged ? 'Chinese' : 'English';
  return `section "${heading}": ${changed} side changed but ${stale} pair did not — translate the pair, then run \`node scripts/translation-pairing.mjs --record\` to re-baseline`;
}

async function loadRecord() {
  try {
    return JSON.parse(await readFile(RECORD, 'utf8'));
  } catch {
    return {};
  }
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const recordMode = process.argv.includes('--record');
  const record = await loadRecord();
  const failures = [];
  const next = {};
  for (const pair of PAIRS) {
    const enSections = splitSections(await readFile(pair.en, 'utf8'));
    const zhSections = splitSections(await readFile(pair.zh, 'utf8'));
    if (enSections.length !== zhSections.length) {
      failures.push(`${pair.en} has ${enSections.length} sections vs ${zhSections.length} in ${pair.zh} (structural symmetry required first)`);
      continue;
    }
    next[pair.en] = {};
    const savedPair = record[pair.en];
    let structureOk = true;
    if (!recordMode) {
      if (!savedPair) {
        failures.push(`${pair.en} missing from ${RECORD}: run \`node scripts/translation-pairing.mjs --record\` once and commit it`);
        structureOk = false;
      } else if (Object.keys(savedPair).length !== enSections.length) {
        failures.push(`${pair.en} structure changed since record (${Object.keys(savedPair).length} recorded vs ${enSections.length} sections): re-run \`node scripts/translation-pairing.mjs --record\``);
        structureOk = false;
      }
    }
    for (let i = 0; i < enSections.length; i += 1) {
      const nowEn = sectionHash(enSections[i]);
      const nowZh = sectionHash(zhSections[i]);
      next[pair.en][String(i)] = { heading: enSections[i].heading, en: nowEn, zh: nowZh };
      const saved = savedPair?.[String(i)];
      if (!recordMode && structureOk && saved) {
        if (saved.heading.replace(/\r/g, '') !== enSections[i].heading.replace(/\r/g, '')) {
          failures.push(`${pair.en}#${i + 1} heading changed since record: re-run \`node scripts/translation-pairing.mjs --record\``);
          continue;
        }
        const drift = driftFor(saved.heading, saved, nowEn, nowZh);
        if (drift) failures.push(`${pair.en}#${i + 1} ${drift}`);
      }
    }
  }
  if (recordMode && failures.length > 0) {
    console.error(`translation pairs NOT recorded: ${failures.length} failure(s)`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else if (recordMode) {
    await writeFile(RECORD, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    console.log(`translation pairs recorded: ${Object.keys(next).length} file(s)`);
  } else if (Object.keys(record).length === 0) {
    console.error(`translation-pairs record missing: run \`node scripts/translation-pairing.mjs --record\` once and commit ${RECORD}`);
    process.exitCode = 1;
  } else if (failures.length > 0) {
    console.error(`translation pairing failed: ${failures.length} drift(s)`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`translation pairing ok: ${PAIRS.length} file pair(s)`);
  }
}
