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

const ERROR_MARKERS = /(?:\b[A-Z][A-Za-z]*Error\b|\b(?:EPERM|ENOENT|EACCES|ECONNREFUSED|ETIMEDOUT|MODULE_NOT_FOUND|ENOTFOUND)\b|Traceback|Cannot find module|ModuleNotFoundError|Error:\s|报错|错误|异常)/u;
const GITHUB_QUALIFIER = /\b(?:site|lang|after|before|in|language|stars|created|repo|label|is|type|user|org):\S*/giu;
const REPO_SLUG = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;

/** True when the text looks like a pasted error message or stack trace. */
export function looksLikeErrorText(text) {
  return ERROR_MARKERS.test(String(text ?? ''));
}

/**
 * True when a query should hit the GitHub provider first: an explicit github
 * site or reference, an owner/repo slug, or a pasted error message.
 */
export function wantsGithub(query) {
  const text = String(query ?? '');
  if (/\bgithub(?:\.com)?\b/iu.test(text)) return true;
  const stripped = text.replace(GITHUB_QUALIFIER, ' ');
  if (stripped.split(/\s+/u).some((token) => REPO_SLUG.test(token))) return true;
  return looksLikeErrorText(text);
}
