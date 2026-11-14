/** Minimal Markdown boilerplate cleanup for API fetch providers. */

const BOILERPLATE =
  /^(?:\[(?:skip to content|sign in|sign up|navigation menu|reload|dismiss alert)[^\]]*\]|skip to content|sign in|sign up|navigation menu|you signed in with another tab|reload|dismiss alert)(?!\w)/iu;
const BOILERPLATE_HEADING = /^#{1,6}\s+(?:navigation menu|footer|site navigation|breadcrumbs?)\s*$/iu;

/** Remove common navigation and sign-in lines from extracted Markdown. */
export function cleanMarkdown(text) {
  if (typeof text !== 'string' || text.length === 0) return '';
  const lines = text.split(/\r?\n/u);
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && (BOILERPLATE.test(trimmed) || BOILERPLATE_HEADING.test(trimmed))) {
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
}
