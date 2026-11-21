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

/** Keeps verify-docs' historical slug shape, so anchors already written against the old gate keep resolving. */
const slugify = (headingText) =>
  headingText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

/** Guard 3: every fragment a document can legitimately expose — heading slugs with GitHub's
 * -1/-2 dedupe suffix for repeated headings, plus hand-written <a id> / <a name> targets.
 * Used by verify-docs to stop flagging real anchors as broken. */
export function anchorSlugs(text) {
  const anchors = new Set();
  // Occupy every emitted slug (generated suffixes included), like GitHub's slugger, so a
  // later heading whose natural slug collides with an earlier -1 becomes -1-1 instead of
  // silently reusing it and mis-reporting real anchors.
  const taken = new Map();
  const uniqueSlug = (base) => {
    let slug = base;
    while (taken.has(slug)) {
      taken.set(base, (taken.get(base) ?? 0) + 1);
      slug = `${base}-${taken.get(base)}`;
    }
    taken.set(slug, 0);
    return slug;
  };
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading !== null) {
      anchors.add(uniqueSlug(slugify(heading[1])));
    }
    for (const match of line.matchAll(/<a\s+[^>]*?\b(?:id|name)\s*=\s*["']([^"']+)["']/gi)) {
      anchors.add(match[1]);
    }
  }
  return anchors;
}
