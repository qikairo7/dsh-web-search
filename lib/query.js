/** Parse provider-neutral search operators from a query. */

const SITE_PATTERN = /(?:^|\s)site:([^\s]+)/iu;
const SITE_CHARSET = /^[a-z0-9.-]+$/iu;
const LANG_PATTERN = /(?:^|\s)lang:([^\s]+)/iu;
const AFTER_PATTERN = /(?:^|\s)after:(\d{4}(?:-\d{2}-\d{2})?)/iu;
const BEFORE_PATTERN = /(?:^|\s)before:(\d{4}(?:-\d{2}-\d{2})?)/iu;

/** Extract `site:`, `lang:`, `after:`, and `before:` from a query. */
export function parseQuerySyntax(query) {
  const text = typeof query === 'string' ? query : '';
  const site = text.match(SITE_PATTERN)?.[1];
  return {
    site: site !== undefined && SITE_CHARSET.test(site) ? site : undefined,
    lang: text.match(LANG_PATTERN)?.[1],
    after: text.match(AFTER_PATTERN)?.[1],
    before: text.match(BEFORE_PATTERN)?.[1],
  };
}
