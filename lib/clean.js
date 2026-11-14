/** Minimal Markdown boilerplate cleanup for API fetch providers. */

const BOILERPLATE =
  /^(?:\[(?:skip to content|sign in|sign up|navigation menu|reload|dismiss alert)[^\]]*\]|skip to content|sign in|sign up|navigation menu|you signed in with another tab|reload|dismiss alert)(?!\w)/iu;
const BOILERPLATE_HEADING =
  /^#{1,6}\s+(?:navigation menu|footer|site navigation|breadcrumbs?|repository navigation|repository files navigation|releases|packages|contributors|languages|activity|metadata)\s*$/iu;
const BOILERPLATE_LABEL =
  /^(?:appearance settings|\{\{ message \}\}|repository navigation|repository files navigation|navigation menu|footer|site navigation|breadcrumbs?)$/iu;
const GITHUB_NAV_LINE =
  /^\* \[(?:notifications|fork|star|code|issues|pull requests|actions|projects|wiki|security|insights|settings)\b[^\]]*\]/iu;
const AVATAR_LINE =
  /^!\[[^\]]*\]\([^)]*(?:avatars\.githubusercontent\.com|static\.zhihu\.com|zhimg\.com|heifetz)[^)]*\)$/iu;

/** Convert a raw HTML body to readable text before summarization. */
export function htmlToText(input) {
  if (typeof input !== 'string' || input.length === 0) return '';
  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/giu, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/giu, ' ')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|pre|code)>/giu, '\n')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/[ \t]+/gu, ' ')
    .replace(/[ \t]*\n[ \t]*/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/** Remove common navigation, sign-in and avatar lines from extracted Markdown. */
export function cleanMarkdown(text) {
  if (typeof text !== 'string' || text.length === 0) return '';
  const lines = text.split(/\r?\n/u);
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 0 &&
      (BOILERPLATE.test(trimmed) ||
        BOILERPLATE_HEADING.test(trimmed) ||
        BOILERPLATE_LABEL.test(trimmed) ||
        GITHUB_NAV_LINE.test(trimmed) ||
        AVATAR_LINE.test(trimmed))
    ) {
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
}
