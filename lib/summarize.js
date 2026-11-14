/** Lightweight query-aware extractive summary for provider content. */

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

/**
 * Turn a long page body into a bounded summary. Sentences matching query terms
 * are preferred, then the chosen sentences are restored to document order.
 */
export function summarizeContent(text, query = '', minChars = 800, maxChars = 1500) {
  const clean = String(text ?? '')
    .replace(/\r\n/gu, '\n')
    .replace(/[ \t]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
  if (clean.length <= maxChars) return clean;

  const sentences = clean
    .split(/(?<=[。！？!?\n])\s*/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  if (sentences.length === 0) return clean.slice(0, maxChars);

  const terms = queryTerms(query);
  const scored = sentences.map((sentence, index) => ({
    sentence,
    index,
    score: sentenceScore(sentence, terms) - index * 0.001,
  }));
  const chosen = [];
  let length = 0;
  for (const item of [...scored].sort((left, right) => right.score - left.score)) {
    if (length >= minChars) break;
    chosen.push(item);
    length += item.sentence.length;
    if (length >= maxChars) break;
  }
  chosen.sort((left, right) => left.index - right.index);
  const result = chosen.map((item) => item.sentence).join(' ');
  return result.length > maxChars ? result.slice(0, maxChars) : result;
}
