/** Parse provider-neutral search operators from a query. */

const SITE_PATTERN = /(?:^|\s)site:([^\s]+)/iu;
const LANG_PATTERN = /(?:^|\s)lang:([^\s]+)/iu;
const AFTER_PATTERN = /(?:^|\s)after:(\d{4}(?:-\d{2}-\d{2})?)/iu;
const BEFORE_PATTERN = /(?:^|\s)before:(\d{4}(?:-\d{2}-\d{2})?)/iu;

/** Extract `site:`, `lang:`, `after:`, and `before:` from a query. */
export function parseQuerySyntax(query) {
  const text = typeof query === 'string' ? query : '';
  return {
    site: text.match(SITE_PATTERN)?.[1],
    lang: text.match(LANG_PATTERN)?.[1],
    after: text.match(AFTER_PATTERN)?.[1],
    before: text.match(BEFORE_PATTERN)?.[1],
  };
}

/** Convert a YYYY or YYYY-MM-DD boundary to an ISO date for Tavily. */
export function toDateBoundary(value, endOfPeriod = false) {
  if (typeof value !== 'string') return undefined;
  if (/^\d{4}$/u.test(value)) {
    return endOfPeriod ? `${value}-12-31` : `${value}-01-01`;
  }
  return value;
}

/** Convert a YYYY or YYYY-MM-DD boundary to a Unix timestamp for Zhihu. */
export function toEpochBoundary(value, endOfPeriod = false) {
  const date = toDateBoundary(value, endOfPeriod);
  if (date === undefined) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return Math.floor(parsed.getTime() / 1000) + (endOfPeriod ? 86_399 : 0);
}

/** Convert a YYYY or YYYY-MM-DD boundary to MM/DD/YYYY for Firecrawl `tbs`. */
export function toMonthDayYear(value, endOfPeriod = false) {
  const date = toDateBoundary(value, endOfPeriod);
  if (date === undefined) return undefined;
  const [year, month, day] = date.split('-');
  return `${month}/${day}/${year}`;
}
