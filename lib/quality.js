/** Quality-mode search pipeline: merge, dedupe, rerank, authority, enrich. */

import { webError } from './errors.js';
import { sortByAuthority } from './authority.js';
import { isAiQuery, qualityPair } from './intent.js';
import { filterOfficialDocs, officialDomainsForQuery } from './officialDocs.js';
import { filterNewsLanguage } from './news.js';
import { parseQuerySyntax } from './query.js';
import { detectLanguage } from './language.js';
import { providerSettings } from './settings.js';
import { PROVIDER_CATALOG } from './catalog.js';
import { enrichSources } from './enrich.js';

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|spm$|scm$|from$|source$|ref$)/iu.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function mergeRoundRobin(results) {
  const lists = results.map((result) => result.sources ?? []);
  const maxRank = lists.reduce((max, list) => Math.max(max, list.length), 0);
  const seen = new Set();
  const merged = [];
  for (let rank = 0; rank < maxRank; rank += 1) {
    for (const list of lists) {
      const source = list[rank];
      if (source === undefined) continue;
      const key = normalizeUrl(source.url);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(source);
    }
  }
  return merged;
}

function firstContent(results) {
  for (const result of results) {
    if (typeof result.content === 'string' && result.content.length > 0) return result.content;
  }
  return undefined;
}

function hostMatchesDomain(url, domain) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const target = domain.toLowerCase().replace(/^www\./u, '');
    return host === target || host.endsWith(`.${target}`);
  } catch {
    return false;
  }
}

function hasOfficialSource(successes, domains) {
  return successes.some(({ result }) =>
    result.sources.some((source) => domains.some((domain) => hostMatchesDomain(source.url, domain))),
  );
}

async function searchOfficialDocs({ request, signal, settings, providers, domains }) {
  const entry = PROVIDER_CATALOG.find((candidate) => candidate.officialDocs === true);
  if (entry === undefined) return { sources: [], truncated: false };
  const provider = providers[entry.id];
  const config = providerSettings(settings, entry.id);
  if (
    provider === undefined ||
    typeof provider.searchWithDomains !== 'function' ||
    config?.enabled === false
  ) {
    return { sources: [], truncated: false };
  }
  try {
    if (!provider.available() || !(await provider.ready())) {
      return { sources: [], truncated: false };
    }
    const result = await provider.searchWithDomains(request, domains, signal);
    return { ...result, sources: filterOfficialDocs(result.sources) };
  } catch {
    return { sources: [], truncated: false };
  }
}

/**
 * Run the quality pipeline. Returns undefined when no provider could answer,
 * so the caller can fall back to the fast order.
 */
export async function qualitySearch({
  request,
  signal,
  settings,
  intent,
  providers,
  runner,
  reranker,
  embeddings,
  fetcher,
}) {
  const pair = qualityPair(request.query, intent);
  const selected = pair.filter(
    (name) =>
      providers[name] !== undefined &&
      typeof providers[name].search === 'function' &&
      providerSettings(settings, name)?.enabled !== false,
  );
  if (selected.length === 0) return undefined;

  const tasks = selected.map((name) => ({
    name,
    promise: runner.attempt(name, 'search', request, signal),
  }));

  const settled = await Promise.allSettled(tasks.map((task) => task.promise));
  if (signal?.aborted === true) {
    throw webError('Web search aborted', 'WEB_ABORTED', { cause: signal.reason });
  }
  const successes = settled
    .map((entry, index) =>
      entry.status === 'fulfilled' ? { name: tasks[index].name, result: entry.value } : undefined,
    )
    .filter((entry) => entry !== undefined);

  const officialDomains =
    settings.officialDocsEnabled === false || parseQuerySyntax(request.query).site !== undefined
      ? []
      : officialDomainsForQuery(request.query);
  if (officialDomains.length > 0 && !hasOfficialSource(successes, officialDomains)) {
    const official = await searchOfficialDocs({
      request,
      signal,
      settings,
      providers,
      domains: officialDomains,
    });
    if (official.sources.length > 0) {
      successes.push({ name: 'official-docs', result: official });
    }
  }
  if (successes.length === 0) return undefined;

  const target =
    Number.isSafeInteger(request.maxResults) && request.maxResults > 0 ? request.maxResults : 10;
  const providerByUrl = new Map();
  for (const { name, result } of successes) {
    for (const source of result.sources) {
      if (!providerByUrl.has(source.url)) providerByUrl.set(source.url, name);
    }
  }

  let candidates = mergeRoundRobin(successes.map((entry) => entry.result));
  if (candidates.length === 0) return undefined;
  if (intent === 'news') {
    const filtered = filterNewsLanguage(candidates, detectLanguage(request.query));
    if (filtered.length > 0) candidates = filtered;
  }
  if (embeddings !== undefined) {
    const deduped = await embeddings.dedupe(
      candidates,
      settings.semanticDedupThreshold ?? 0.95,
      signal,
    );
    if (deduped !== undefined) candidates = deduped;
  }

  const aiNews = intent === 'news' && isAiQuery(request.query);
  const sortOptions = {
    news: intent === 'news',
    language: detectLanguage(request.query),
    ...(aiNews
      ? {
          providerBoost: (source) => {
            const entry = PROVIDER_CATALOG.find((candidate) => candidate.newsBoost !== undefined);
            return entry !== undefined && providerByUrl.get(source.url) === entry.id
              ? entry.newsBoost
              : 0;
          },
        }
      : {}),
  };

  let ranked;
  if (reranker !== undefined && typeof reranker.rerankScored === 'function') {
    const scored = await reranker.rerankScored(request.query, candidates, signal);
    if (scored !== undefined) {
      ranked = sortByAuthority(scored, sortOptions).map((entry) => entry.source);
    }
  }
  if (ranked === undefined && reranker !== undefined) {
    const ordered = await reranker.rerank(request.query, candidates, target, signal);
    ranked = sortByAuthority(
      ordered.map((source, index) => ({ source, score: 0, index })),
      sortOptions,
    ).map((entry) => entry.source);
  }
  if (ranked === undefined) {
    ranked = sortByAuthority(
      candidates.map((source, index) => ({ source, score: 0, index })),
      sortOptions,
    ).map((entry) => entry.source);
  }

  const content = firstContent(successes.map((entry) => entry.result));
  const finalSources = await enrichSources({
    sources: ranked.slice(0, target),
    query: request.query,
    settings,
    fetcher,
    signal,
  });
  return {
    ...(content === undefined ? {} : { content }),
    sources: finalSources,
    truncated: candidates.length > target,
  };
}
