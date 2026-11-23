/** Shared technical-text heuristics for intent routing, summarization, and enrichment. */

/** Query vocabulary that marks a search as technical. */
export const TECH_PATTERN =
  /(api|sdk|npm|node|python|javascript|typescript|代码|编程|开发|插件|文档|框架|部署|安装|报错|错误|bug|error|github|docs|documentation|config|配置|接口)/iu;

/** In-page markers that point at API signatures, examples, or code blocks. */
export const TECHNICAL_MARKERS =
  /(?:```|`[^`]+`|\b(?:function|class|const|let|var|import|export|interface|type|enum|return|async|await)\b|\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/|参数|返回值|示例|用法|example|usage|reference|api)/iu;

const SOURCE_HINT_PATTERN = /(?:\b(?:api|reference|docs?|tutorial|guide|sdk)\b)/iu;

/** True when text looks like technical documentation, a reference, or code. */
export function isTechnicalText(text) {
  const value = typeof text === 'string' ? text : '';
  return (
    SOURCE_HINT_PATTERN.test(value) ||
    TECH_PATTERN.test(value) ||
    TECHNICAL_MARKERS.test(value)
  );
}

// Node error codes such as ERR_MODULE_NOT_FOUND need their own branch: the old
// alternation wrapped bare names in \b…\b, but _ is a word character, so a
// name embedded after ERR_ never saw a word boundary and went unrecognised.
const ERROR_MARKERS = /(?:\b[A-Z][A-Za-z]*Error\b|\bERR_[A-Z0-9_]+\b|\b(?:EPERM|ENOENT|EACCES|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNRESET|EADDRINUSE)\b|Traceback|Cannot find module|ModuleNotFoundError|Error:\s|报错|错误|异常)/u;
const GITHUB_QUALIFIER = /\b(?:site|lang|after|before|in|language|stars|created|repo|label|is|type|user|org):\S*/giu;
// A slash-separated owner/repo candidate: both sides are name-like tokens. The
// shape alone is not enough — plain word pairs such as input/output, and/or,
// A/B, npm/pnpm or TCP/IP match it too, so they are filtered by the generic-word
// vocabulary below rather than by a numeric/hyphen heuristic.
const REPO_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/u;
// A bare package/repo name: one lowercase token with a separator (dsh-web-search).
const PACKAGE_NAME = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;
// A standard identifier (utf-8, sha-256) is a spec term, not a repo name.
const STANDARD_ID = /^[a-z]+[-_]\d+$/u;
// Generic English and protocol words: a pair made only of these (input/output,
// and/or, A/B, npm/pnpm, TCP/IP) or a lone token made only of these (how-to,
// read-me, e-mail) is never a GitHub owner/repo, without leaning on digits or
// hyphens as the discriminator.
const GENERIC_WORDS = new Set([
  'input', 'output', 'and', 'or', 'a', 'b', 'npm', 'pnpm', 'tcp', 'ip',
  'http', 'https', 'how', 'to', 'read', 'me', 'e', 'mail', 'vs',
]);

/** Split a candidate into its lowercased word parts. */
function wordParts(token) {
  return token.toLowerCase().split(/[._/-]+/u).filter((part) => part.length > 0);
}

/** True when every word part of a token is a generic English/protocol word. */
function allGeneric(token) {
  const parts = wordParts(token);
  return parts.length > 0 && parts.every((part) => GENERIC_WORDS.has(part));
}

/**
 * True when one token is a bare owner/repo slug. A dotted left side is a file
 * path (node.js/utf-8), not an owner, and a pair of two generic words
 * (input/output, A/B, TCP/IP) is prose, not a repository.
 */
function isRepoTarget(token) {
  if (!REPO_SLUG.test(token)) return false;
  const slash = token.indexOf('/');
  const left = token.slice(0, slash);
  const right = token.slice(slash + 1);
  if (left.includes('.') || right.length === 0) return false;
  return !(allGeneric(left) && allGeneric(right));
}

/**
 * True when a lone token is a plausible bare package/repo name (dsh-web-search)
 * rather than a technical standard word: a dotted token is a framework file or
 * domain (node.js, w3.org, python3.11), a word-number token is a spec code
 * (utf-8, sha-256), and an all-generic hyphenated token is ordinary prose
 * (how-to, read-me, e-mail).
 */
function isBarePackage(token) {
  if (!PACKAGE_NAME.test(token)) return false;
  if (token.includes('.')) return false;
  if (STANDARD_ID.test(token)) return false;
  return !allGeneric(token);
}

/**
 * Parse a bare owner/repo query (a lone slug such as facebook/react) into its
 * two halves, or undefined when the query is prose, an operator query, or a
 * generic word pair. Used to resolve an exact repository directly instead of
 * relying on GitHub's relevance ranking.
 * @param {string} query
 * @returns {{ owner: string, repo: string } | undefined}
 */
export function parseRepoSlug(query) {
  const text = String(query ?? '').trim();
  if (text.length === 0 || /[\s:]/u.test(text)) return undefined;
  if (!isRepoTarget(text)) return undefined;
  const slash = text.indexOf('/');
  return { owner: text.slice(0, slash), repo: text.slice(slash + 1) };
}

/** True when the text looks like a pasted error message or stack trace. */
export function looksLikeErrorText(text) {
  return ERROR_MARKERS.test(String(text ?? ''));
}

/**
 * True when a query should hit the GitHub provider first: an explicit github
 * site or reference, an owner/repo slug (or a bare repo name), or a pasted
 * error message.
 */
export function wantsGithub(query) {
  const text = String(query ?? '').trim();
  if (/\bgithub(?:\.com)?\b/iu.test(text)) return true;
  if (looksLikeErrorText(text)) return true;
  const tokens = text.replace(GITHUB_QUALIFIER, ' ').split(/\s+/u).filter((token) => token.length > 0);
  if (tokens.some((token) => isRepoTarget(token))) return true;
  return tokens.length === 1 && isBarePackage(tokens[0]);
}
