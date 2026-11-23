/** Single home for routing-fact derivation: intent, query syntax, and language hint. */

import { classifyIntent } from './intent.js';
import { parseQuerySyntax } from './query.js';
import { detectLanguage } from './text.js';

/** The authoritative language chain shared by `routingFacts` and the resolveRouting fallback. */
function deriveLanguage(syntax, query, settings) {
  if (syntax.lang !== undefined) return syntax.lang.split(',')[0];
  return settings.languageRouting !== false ? detectLanguage(query) : undefined;
}

/**
 * Resolve the routing facts once per search so adapters only translate them.
 *
 * `language` is the final provider language hint: the `lang:` operator's
 * first value wins, otherwise the detected language when language routing
 * is enabled, otherwise undefined.
 */
export function routingFacts(query, settings, intent) {
  const syntax = parseQuerySyntax(query);
  const language = deriveLanguage(syntax, query, settings);
  return { intent, language, syntax };
}

/**
 * Effective routing facts for one request: each field reads `request.routing`
 * first and falls back to the same derivation chain as `routingFacts`. The
 * language fallback uses the effective syntax, so the `lang:` operator keeps
 * its priority over detection.
 */
export function resolveRouting(request, settings) {
  const syntax = request.routing?.syntax ?? parseQuerySyntax(request.query);
  const intent = request.routing?.intent ?? classifyIntent(request.query);
  const language = request.routing?.language ?? deriveLanguage(syntax, request.query, settings);
  return { intent, syntax, language };
}
