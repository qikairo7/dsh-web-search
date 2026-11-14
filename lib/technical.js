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
