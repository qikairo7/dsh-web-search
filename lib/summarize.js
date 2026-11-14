/** Lightweight query-aware extractive summary for provider content. */

import { TECHNICAL_MARKERS } from './technical.js';

function queryTerms(query) {
  const value = typeof query === 'string' ? query.toLowerCase() : '';
  const terms = value.match(/[a-z0-9]{2,}|[\u4e00-\u9fff]{2}/gu) ?? [];
  return [...new Set(terms)].slice(0, 24);
}

function sentenceScore(sentence, terms) {
  if (terms.length === 0) return 0;
  const lower = sentence.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 1;
  }
  return score;
}

/** Collapse CRLF, repeated spaces and blank-line runs into a stable text. */
function normalize(text) {
  return String(text ?? '')
    .replace(/\r\n/gu, '\n')
    .replace(/[ \t]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/**
 * Take scored items in descending score order until at least `minChars` of
 * text is collected or `maxChars` is reached. Returns the chosen items and
 * their total text length so callers can keep filling if they need to.
 */
function pickUntilMinChars(items, minChars, maxChars) {
  const chosen = [];
  let length = 0;
  for (const item of [...items].sort((left, right) => right.score - left.score)) {
    if (length >= minChars) break;
    chosen.push(item);
    length += item.text.length;
    if (length >= maxChars) break;
  }
  return { chosen, length };
}

/**
 * Turn a long page body into a bounded summary. Sentences matching query terms
 * are preferred, then the chosen sentences are restored to document order.
 */
export function summarizeContent(text, query = '', minChars = 800, maxChars = 1500) {
  const clean = normalize(text);
  if (clean.length <= maxChars) return clean;

  const sentences = clean
    .split(/(?<=[。！？!?\n])\s*/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  if (sentences.length === 0) return clean.slice(0, maxChars);

  const terms = queryTerms(query);
  const scored = sentences.map((sentence, index) => ({
    text: sentence,
    index,
    score: sentenceScore(sentence, terms) - index * 0.001,
  }));
  const { chosen } = pickUntilMinChars(scored, minChars, maxChars);
  chosen.sort((left, right) => left.index - right.index);
  const result = chosen.map((item) => item.text).join(' ');
  return result.length > maxChars ? result.slice(0, maxChars) : result;
}

/**
 * Prefer API signatures, parameters, examples and code blocks when summarizing
 * technical documentation. Falls back to the normal extractive summary.
 */
export function summarizeTechnicalContent(text, query = '', minChars = 800, maxChars = 1500) {
  const clean = normalize(text);
  if (clean.length <= maxChars) return clean;

  const blocks = clean
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  if (blocks.length === 0) return summarizeContent(clean, query, minChars, maxChars);

  const terms = queryTerms(query);
  const scored = blocks.map((block, index) => {
    let score = sentenceScore(block, terms);
    if (TECHNICAL_MARKERS.test(block)) score += 2;
    if (/^#{1,6}\s/u.test(block)) score += 1;
    return { text: block, index, score: score - index * 0.001 };
  });
  const { chosen, length: pickedLength } = pickUntilMinChars(scored, minChars, maxChars);
  let length = pickedLength;
  const chosenIndexes = new Set(chosen.map((item) => item.index));
  for (const item of scored) {
    if (length >= minChars) break;
    if (chosenIndexes.has(item.index)) continue;
    chosen.push(item);
    length += item.text.length;
  }
  chosen.sort((left, right) => left.index - right.index);
  const result = chosen.map((item) => item.text).join('\n\n');
  return result.length > maxChars ? result.slice(0, maxChars) : result;
}
