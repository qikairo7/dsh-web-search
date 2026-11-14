/** Domain authority prior used after model reranking. */

const OFFICIAL_DOC_HOSTS = new Set([
  'api-docs.deepseek.com',
  'cloud.google.com',
  'developer.android.com',
  'developer.apple.com',
  'developer.mozilla.org',
  'docs.aws.amazon.com',
  'docs.microsoft.com',
  'go.dev',
  'kubernetes.io',
  'learn.microsoft.com',
  'nodejs.org',
  'python.org',
  'react.dev',
  'rust-lang.org',
]);

/** Add a small authority prior to a reranker score. */
export function authorityBoost(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 0;
  }
  if (OFFICIAL_DOC_HOSTS.has(host)) return 0.2;
  if (host === 'deepseek-harness.github.io') return 0.2;
  if (host.endsWith('.github.io')) return 0.1;
  if (host === 'github.com' || host === 'stackoverflow.com') return 0.1;
  if (host.endsWith('.gov') || host.endsWith('.edu')) return 0.15;
  if (host.endsWith('.wikipedia.org')) return 0.05;
  return 0;
}

/** Sort scored candidates by rerank score plus domain authority. */
export function sortByAuthority(scored) {
  return [...scored].sort((left, right) => {
    const leftScore = (left.score ?? 0) + authorityBoost(left.source.url);
    const rightScore = (right.score ?? 0) + authorityBoost(right.source.url);
    if (rightScore !== leftScore) return rightScore - leftScore;
    return (left.rank ?? left.index ?? 0) - (right.rank ?? right.index ?? 0);
  });
}
