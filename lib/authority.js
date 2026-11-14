/** Domain authority prior used after model reranking. */

import { normalizeHostname } from './host.js';
import { newsBoostValue } from './news.js';
import { isDeprecatedDocUrl } from './officialDocs.js';

const OFFICIAL_DOC_HOSTS = new Set([
  'api-docs.deepseek.com',
  'cloud.google.com',
  'developer.android.com',
  'developer.apple.com',
  'developer.chrome.com',
  'developer.hashicorp.com',
  'developer.mozilla.org',
  'developer.nvidia.com',
  'doc.rust-lang.org',
  'docs.ansible.com',
  'docs.aws.amazon.com',
  'docs.docker.com',
  'docs.github.com',
  'docs.microsoft.com',
  'docs.nvidia.com',
  'docs.oracle.com',
  'docs.redhat.com',
  'go.dev',
  'kubernetes.io',
  'learn.microsoft.com',
  'nodejs.org',
  'python.org',
  'react.dev',
  'rust-lang.org',
  'typescriptlang.org',
]);

export function isOfficialDocHost(host) {
  if (typeof host !== 'string') return false;
  const normalized = normalizeHostname(host);
  if (OFFICIAL_DOC_HOSTS.has(normalized)) return true;
  if (normalized.startsWith('docs.') || normalized.startsWith('developer.')) return true;
  if (normalized.endsWith('.github.io')) return true;
  return false;
}

/** Add a small authority prior to a reranker score. */
export function authorityBoost(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 0;
  }
  if (isOfficialDocHost(host)) return 0.2;
  if (host === 'github.com' || host === 'stackoverflow.com') return 0.1;
  if (host.endsWith('.gov') || host.endsWith('.edu')) return 0.15;
  if (host.endsWith('.wikipedia.org')) return 0.05;
  return 0;
}

/** Sort scored candidates by rerank score plus domain authority. */
export function sortByAuthority(scored, options = {}) {
  const boost = (source) => {
    let value = authorityBoost(source.url);
    if (isDeprecatedDocUrl(source.url)) value -= 0.3;
    if (options.news === true) value += newsBoostValue(source.url, options.language);
    if (typeof options.providerBoost === 'function') value += options.providerBoost(source) ?? 0;
    return value;
  };
  return [...scored].sort((left, right) => {
    const leftScore = (left.score ?? 0) + boost(left.source);
    const rightScore = (right.score ?? 0) + boost(right.source);
    if (rightScore !== leftScore) return rightScore - leftScore;
    return (left.rank ?? left.index ?? 0) - (right.rank ?? right.index ?? 0);
  });
}
