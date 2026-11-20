/** Pure guards for `verify-docs.mjs`: mirror-link language pairing and budget headroom.
 * Kept separate so the gate's main body stays a plain script and these can be unit-tested. */

import path from 'node:path';

// English/Chinese mirror pairs. Only zh members ending in `.zh.md` are policed: README.md and
// docs/DETAIL.md keep a Chinese base name and are linked from both sides on purpose.
export const MIRROR_PAIRS = [
  { en: 'README.en.md', zh: 'README.md' },
  { en: 'SAFETY.md', zh: 'SAFETY.zh.md' },
  { en: 'SECURITY.md', zh: 'SECURITY.zh.md' },
  { en: 'TRADEMARKS.md', zh: 'TRADEMARKS.zh.md' },
  { en: 'CODE_OF_CONDUCT.md', zh: 'CODE_OF_CONDUCT.zh.md' },
  { en: 'docs/DETAIL.en.md', zh: 'docs/DETAIL.md' },
];

/** Relative markdown link targets from one file, resolved against its own directory. */
export function relativeLinkTargets(filePath, text) {
  const dir = path.posix.dirname(filePath);
  const targets = [];
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const raw = match[1];
    if (/^(https?:|mailto:|#)/.test(raw)) continue;
    const rawPath = raw.split('#')[0];
    if (rawPath.length === 0) continue;
    const clean = decodeURIComponent(rawPath);
    targets.push(path.posix.normalize(dir === '.' ? clean : path.posix.join(dir, clean)));
  }
  return targets;
}

/** Guard 1: the English side of a mirror pair must not link a Chinese `.zh.md` doc.
 * Only the en→zh direction is enforced on purpose: existing Chinese pages legitimately
 * cross-link English docs (e.g. SECURITY.zh.md → SAFETY.md), so a symmetric rule would
 * false-positive. The incident this guards (R-21) was the English side mis-pointed at a
 * Chinese file; "both sides link the same Chinese doc" is the same class. */
export function mirrorLinkErrors(pairs, readText) {
  const errors = [];
  const zhMembers = new Set(pairs.map((pair) => pair.zh).filter((zh) => zh.endsWith('.zh.md')));
  for (const pair of pairs) {
    const enText = readText(pair.en);
    const zhText = readText(pair.zh);
    if (enText === undefined || zhText === undefined) continue;
    const enTargets = new Set(relativeLinkTargets(pair.en, enText));
    const zhTargets = new Set(relativeLinkTargets(pair.zh, zhText));
    for (const target of enTargets) {
      if (target === pair.zh) continue; // language-switch link to its own pair
      if (!zhMembers.has(target)) continue;
      if (zhTargets.has(target)) {
        errors.push(`${pair.en} / ${pair.zh}: both link Chinese doc ${target}`);
      } else {
        errors.push(`${pair.en}: English side links Chinese doc ${target}`);
      }
    }
  }
  return errors;
}

/** Guard 2: WARN (never fail) for a budgeted file whose headroom is under the minimum.
 * `budgets.minHeadroom` is an optional field; without it the floor is 10 codepoints. */
export function budgetHeadroomWarnings(budgets, readLength) {
  const minHeadroom = typeof budgets.minHeadroom === 'number' ? budgets.minHeadroom : 10;
  const warnings = [];
  for (const [file, limit] of Object.entries(budgets)) {
    if (file === 'minHeadroom') continue;
    const count = readLength(file);
    if (count === undefined) continue;
    const headroom = limit - count;
    if (headroom >= 0 && headroom < minHeadroom) {
      warnings.push(`${file}: ${count}/${limit} chars, headroom ${headroom} < ${minHeadroom}`);
    }
  }
  return warnings;
}
