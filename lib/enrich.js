/** Evidence enrichment for quality-mode sources. */

import { isAbortLike } from './errors.js';
import { isOfficialDocHost } from './authority.js';
import { cleanMarkdown, htmlToText } from './clean.js';
import { summarizeContent, summarizeTechnicalContent } from './summarize.js';
import { isTechnicalText } from './technical.js';

function isTechnicalSource(source) {
  try {
    const host = new URL(source.url).hostname.toLowerCase();
    if (isOfficialDocHost(host)) return true;
  } catch {
    // Fall through to the text heuristic.
  }
  return isTechnicalText(`${source.title ?? ''} ${source.url}`);
}

async function enrichSource(source, { query, settings, fetcher, signal }) {
  try {
    const result = await fetcher.fetch({ url: source.url }, signal);
    let content = result?.body?.content;
    if (typeof content !== 'string') return source;
    if (result.body.kind === 'html' || /<html|<!doctype|<body|<div|<script/iu.test(content)) {
      content = htmlToText(content);
    }
    content = cleanMarkdown(content);
    if (content.length < 200) return source;
    const minChars = Math.max(Number(settings.enrichSummaryMinChars), 1);
    const maxChars = Math.max(Number(settings.enrichSummaryMaxChars), minChars);
    const summary = isTechnicalSource(source)
      ? summarizeTechnicalContent(content, query, minChars, maxChars)
      : summarizeContent(content, query, minChars, maxChars);
    if (summary.length < 200) return source;
    const originalSummary = typeof source.summary === 'string' ? source.summary : '';
    if (summary.length < minChars || summary.length <= originalSummary.length) return source;
    return { ...source, summary };
  } catch (error) {
    if (isAbortLike(error)) throw error;
    return source;
  }
}

/**
 * Fetch the top sources and replace their summaries with a bounded extract.
 * One failed page keeps the original source and never fails the search.
 */
export async function enrichSources({ sources, query, settings, fetcher, signal }) {
  if (settings.enrichEnabled === false || fetcher === undefined) return sources;
  const topN = Math.min(Math.max(Number(settings.enrichTopN), 0), sources.length);
  if (topN === 0) return sources;
  return Promise.all(
    sources.map((source, index) =>
      index < topN ? enrichSource(source, { query, settings, fetcher, signal }) : source,
    ),
  );
}
