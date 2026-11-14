/** Official-document domain hints for technical queries. */

const RULES = [
  {
    pattern: /deepseek\s*harness|\bdsh\b/iu,
    domains: ['deepseek-harness.github.io', 'api-docs.deepseek.com'],
  },
  { pattern: /\bnode(?:\.js)?\b/iu, domains: ['nodejs.org'] },
  { pattern: /\b(?:mdn|web api|javascript)\b/iu, domains: ['developer.mozilla.org'] },
  { pattern: /\breact\b/iu, domains: ['react.dev'] },
  { pattern: /\bpython\b/iu, domains: ['docs.python.org'] },
  { pattern: /\bgo(?:lang)?\b/iu, domains: ['go.dev'] },
  { pattern: /\brust\b/iu, domains: ['doc.rust-lang.org', 'rust-lang.org'] },
];

/** Return official domains worth a supplemental search for this query. */
export function officialDomainsForQuery(query) {
  const domains = new Set();
  for (const rule of RULES) {
    if (!rule.pattern.test(query)) continue;
    for (const domain of rule.domains) domains.add(domain);
  }
  return [...domains].slice(0, 4);
}
