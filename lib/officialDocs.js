/** Official-document domain hints and version filtering. */

const RULES = [
  {
    pattern: /deepseek\s*harness|\bdsh\b/iu,
    domains: ['deepseek-harness.github.io', 'api-docs.deepseek.com'],
  },
  { pattern: /\bnode(?:\.js)?\b/iu, domains: ['nodejs.org'] },
  { pattern: /\b(?:mdn|web api|javascript)\b/iu, domains: ['developer.mozilla.org'] },
  { pattern: /\breact\b/iu, domains: ['react.dev'] },
  { pattern: /\bpython\b/iu, domains: ['docs.python.org'] },
  { pattern: /\bgolang\b|\bgo\s+(?:programming|language|modules?|toolchain)\b/iu, domains: ['go.dev'] },
  { pattern: /\brust\b/iu, domains: ['doc.rust-lang.org', 'rust-lang.org'] },
  { pattern: /\bdocker\b/iu, domains: ['docs.docker.com'] },
  { pattern: /\b(?:kubernetes|k8s)\b/iu, domains: ['kubernetes.io'] },
  { pattern: /\b(?:aws|amazon web services)\b/iu, domains: ['docs.aws.amazon.com'] },
  { pattern: /\b(?:azure|microsoft)\b/iu, domains: ['learn.microsoft.com'] },
  { pattern: /\bgithub\b/iu, domains: ['docs.github.com'] },
  { pattern: /\btypescript\b/iu, domains: ['typescriptlang.org'] },
  { pattern: /\bjava\b/iu, domains: ['docs.oracle.com'] },
  { pattern: /\b(?:dotnet|csharp)\b|\bc#/iu, domains: ['learn.microsoft.com'] },
  { pattern: /\bnvidia\b/iu, domains: ['docs.nvidia.com'] },
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

/** True for archived Node.js release docs that should not outrank current docs. */
export function isDeprecatedDocUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'nodejs.org') return false;
    return (
      /^\/download\/release\//u.test(parsed.pathname) ||
      /^\/(?:en\/)?blog\/release\/v\d+/iu.test(parsed.pathname) ||
      /^\/docs\/v\d+/iu.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

/** Remove archived docs from an official-docs search result. */
export function filterOfficialDocs(sources) {
  return sources.filter((source) => !isDeprecatedDocUrl(source.url));
}
