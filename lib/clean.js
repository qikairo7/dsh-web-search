/** Minimal Markdown boilerplate cleanup for API fetch providers. */

const BOILERPLATE =
  /^(?:\[(?:skip to content|sign in|sign up|navigation menu|reload|dismiss alert)[^\]]*\]|skip to content|sign in|sign up|navigation menu|you signed in with another tab|reload|dismiss alert)(?!\w)/iu;
const BOILERPLATE_HEADING =
  /^#{1,6}\s+(?:navigation menu|footer|site navigation|breadcrumbs?|repository navigation|repository files navigation)\s*$/iu;
const GITHUB_HEADING =
  /^#{1,6}\s+(?:releases|packages|contributors|languages|activity|metadata)\s*$/iu;
const GITHUB_HEADING_TEXT = /^(?:releases|packages|contributors|languages|activity|metadata)$/iu;
const BOILERPLATE_LABEL =
  /^(?:appearance settings|\{\{ message \}\}|repository navigation|repository files navigation|navigation menu|footer|site navigation|breadcrumbs?)$/iu;
const GITHUB_NAV_LINE =
  /^(?:[-*+]\s+)?\[(?:notifications|fork|star|code|discussions|issues|pull requests|actions|projects|wiki|security|insights|settings|login|log in|sign in|sign up)\b[^\]]*\]/iu;
const GITHUB_NAV_LABEL = /^(?:code|discussions|login|log in|sign in|sign up)$/iu;
const AVATAR_LINE =
  /^!\[[^\]]*\]\([^)]*(?:avatars\.githubusercontent\.com|static\.zhihu\.com|zhimg\.com|heifetz)[^)]*\)$/iu;

/** True when a URL or bare hostname belongs to github.com. */
export function isGitHubHost(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  const candidate = value.trim();
  let host;
  try {
    host = new URL(candidate.includes('://') ? candidate : `https://${candidate}`).hostname;
  } catch {
    return false;
  }
  host = host.toLowerCase().replace(/^www\./u, '');
  return host === 'github.com' || host.endsWith('.github.com');
}

/** Decode the HTML entity subset that provider responses use. */
export function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/giu, ' ')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&amp;/giu, '&');
}

/** Convert a raw HTML body to readable text before summarization. */
export function htmlToText(input) {
  if (typeof input !== 'string' || input.length === 0) return '';
  const text = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/giu, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\b[^>]*>/giu, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg\b[^>]*>/giu, ' ')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|pre|code)>/giu, '\n')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ');
  return decodeHtmlEntities(text)
    .replace(/[ \t]+/gu, ' ')
    .replace(/[ \t]*\n[ \t]*/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/**
 * Remove common navigation, sign-in and avatar lines from extracted Markdown.
 * GitHub-only headings and navigation apply only when `url` points at github.com;
 * callers that omit `url` keep the site-independent cleanup.
 */
export function cleanMarkdown(text, url) {
  if (typeof text !== 'string' || text.length === 0) return '';
  const github = isGitHubHost(url);
  const lines = text.split(/\r?\n/u);
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 0 &&
      (BOILERPLATE.test(trimmed) ||
        BOILERPLATE_HEADING.test(trimmed) ||
        (github && GITHUB_HEADING.test(trimmed)) ||
        (github && GITHUB_HEADING_TEXT.test(trimmed)) ||
        BOILERPLATE_LABEL.test(trimmed) ||
        (github && GITHUB_NAV_LINE.test(trimmed)) ||
        (github && GITHUB_NAV_LABEL.test(trimmed)) ||
        AVATAR_LINE.test(trimmed))
    ) {
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
}
