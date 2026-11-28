/** Parse provider-neutral search operators from a query. */

const SITE_PATTERN = /(?:^|\s)site:([^\s]+)/iu;
const SITE_CHARSET = /^[a-z0-9.-]+$/iu;
const LANG_PATTERN = /(?:^|\s)lang:([^\s]+)/iu;
const AFTER_PATTERN = /(?:^|\s)after:(\d{4}(?:-\d{2}-\d{2})?)(?![\d-])/iu;
const BEFORE_PATTERN = /(?:^|\s)before:(\d{4}(?:-\d{2}-\d{2})?)(?![\d-])/iu;

/** True when a `YYYY` or `YYYY-MM-DD` literal names a real calendar day. */
function isCalendarDate(value) {
  if (/^\d{4}$/u.test(value)) return true;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/** Read one date operator, dropping a value that is not a real calendar day. */
function readDateOperator(text, pattern) {
  const value = text.match(pattern)?.[1];
  return value !== undefined && isCalendarDate(value) ? value : undefined;
}

/** Extract `site:`, `lang:`, `after:`, and `before:` from a query. */
export function parseQuerySyntax(query) {
  const text = typeof query === 'string' ? query : '';
  const site = text.match(SITE_PATTERN)?.[1];
  return {
    site: site !== undefined && SITE_CHARSET.test(site) ? site : undefined,
    lang: text.match(LANG_PATTERN)?.[1],
    after: readDateOperator(text, AFTER_PATTERN),
    before: readDateOperator(text, BEFORE_PATTERN),
  };
}
