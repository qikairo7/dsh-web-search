/** GitHub REST Search provider: repository/issue search plus issue and README retrieval (ADR-0012). */

import { joinURL, isHTTPURL } from '../http.js';
import { webError } from '../errors.js';
import { recordProviderUsage } from '../quotaStore.js';
import { looksLikeErrorText, parseRepoSlug } from '../technical.js';
import { githubFetchTarget } from '../host.js';
import { clampCount, isProviderAvailable, providerOperation, textResult } from './shared.js';

export const GITHUB_PROVIDER_ID = 'github';

const API_HEADERS = { 'x-github-api-version': '2022-11-28' };

/** Choose the search endpoint and translate the shared operators. */
function buildGithubQuery(query) {
  const raw = String(query ?? '');
  const endpoint = looksLikeErrorText(raw) || /\bis:issue\b/iu.test(raw) ? 'issues' : 'repositories';
  const q = raw
    // Keep a site:github.com/<owner>/<repo> path as GitHub's repo: filter so the
    // repository survives; a bare site:github.com only drops the domain.
    .replace(/\bsite:github\.com(\/[^\s]*)?/giu, (_match, path) =>
      path ? ` repo:${path.replace(/^\/+|\/+$/gu, '')} ` : ' ',
    )
    .replace(/\bafter:(\d{4}(?:-\d{2}-\d{2})?)/giu, 'created:>=$1')
    .replace(/\bbefore:(\d{4}(?:-\d{2}-\d{2})?)/giu, 'created:<=$1')
    // lang: is a provider-neutral result-language hint GitHub cannot honor (its
    // language: filter selects a programming language), so drop it instead of
    // leaking the operator into the text query.
    .replace(/\blang:\S*/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return { endpoint, q: q.length > 0 ? q : 'github' };
}

/** Map one repository payload item into a seam source, or undefined when unusable. */
function repoSource(item, maxSnippetChars) {
  if (item === null || typeof item !== 'object') return undefined;
  const url = typeof item.html_url === 'string' ? item.html_url.trim() : '';
  if (!isHTTPURL(url)) return undefined;
  const title = typeof item.full_name === 'string' ? item.full_name.trim() : '';
  const parts = [];
  if (typeof item.description === 'string' && item.description.trim().length > 0) parts.push(item.description.trim());
  const stats = [];
  if (Number.isFinite(item.stargazers_count)) stats.push(`★ ${item.stargazers_count}`);
  if (typeof item.language === 'string' && item.language.length > 0) stats.push(item.language);
  if (Array.isArray(item.topics) && item.topics.length > 0) stats.push(item.topics.join(', '));
  if (stats.length > 0) parts.push(stats.join(' · '));
  const snippet = parts.join('\n').slice(0, maxSnippetChars);
  const publishedAt = typeof item.pushed_at === 'string' ? item.pushed_at : '';
  return {
    url,
    ...(title.length > 0 ? { title } : {}),
    ...(snippet.length > 0 ? { snippet } : {}),
    ...(publishedAt.length > 0 ? { publishedAt } : {}),
  };
}

/** Map a /search/repositories payload into seam sources. */
export function mapGithubRepoSearch(data, maxSnippetChars = 4_000) {
  if (data === null || typeof data !== 'object' || !Array.isArray(data.items)) {
    throw webError('response.items is not an array', 'WEB_INVALID_RESPONSE');
  }
  const sources = [];
  for (const item of data.items) {
    const source = repoSource(item, maxSnippetChars);
    if (source !== undefined) sources.push(source);
  }
  return { sources, truncated: false };
}

/** Map a single /repos/{owner}/{repo} payload into a one-source result. */
export function mapGithubRepo(data, maxSnippetChars = 4_000) {
  const source = repoSource(data, maxSnippetChars);
  if (source === undefined) throw webError('response is not a GitHub repository', 'WEB_INVALID_RESPONSE');
  return { sources: [source], truncated: false };
}

/** Map a /search/issues payload into seam sources, dropping pull requests. */
export function mapGithubIssueSearch(data, maxSnippetChars = 4_000) {
  if (data === null || typeof data !== 'object' || !Array.isArray(data.items)) {
    throw webError('response.items is not an array', 'WEB_INVALID_RESPONSE');
  }
  const sources = [];
  for (const item of data.items) {
    if (item === null || typeof item !== 'object') continue;
    if (item.pull_request !== undefined) continue;
    const url = typeof item.html_url === 'string' ? item.html_url.trim() : '';
    if (!isHTTPURL(url)) continue;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const body = typeof item.body === 'string' ? item.body.trim() : '';
    const state = typeof item.state === 'string' ? item.state : 'unknown';
    const comments = Number.isFinite(item.comments) ? item.comments : 0;
    const meta = `[${state} · ${comments} 条评论]`;
    const snippet = `${body}\n\n${meta}`.slice(0, maxSnippetChars);
    const publishedAt = typeof item.created_at === 'string' ? item.created_at : '';
    sources.push({
      url,
      ...(title.length > 0 ? { title } : {}),
      snippet,
      ...(publishedAt.length > 0 ? { publishedAt } : {}),
    });
  }
  return { sources, truncated: false };
}

/** Record the search rate-limit reading so the settings quota row can show it. */
function recordGithubRateLimit(response) {
  const remaining = Number(response?.headers?.get?.('x-ratelimit-remaining'));
  if (!Number.isFinite(remaining)) return;
  recordProviderUsage('github', { remaining });
}

/** GitHub search and structured fetch provider; anonymous works, a PAT raises the quota. */
export class GithubProvider {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
    // Cooldown window from a 403/429 Retry-After (ADR-0012): while it lasts the
    // provider reports unavailable so the chain skips it instead of hammering.
    this.cooldownUntil = 0;
  }

  get id() {
    return GITHUB_PROVIDER_ID;
  }

  get title() {
    return 'GitHub';
  }

  get description() {
    return {
      en: 'GitHub REST search for repositories and issues, plus structured issue/README fetch; anonymous works, a PAT raises the quota.',
      zh: 'GitHub 官方 API：仓库与 issue 搜索，issue/README 结构化抓取；匿名可用，PAT 提额。',
    };
  }

  available() {
    if (Date.now() < this.cooldownUntil) return false;
    return isProviderAvailable(this.settings().github);
  }

  async ready() {
    return true;
  }

  async apiKey(config) {
    return typeof this.resolveKey === 'function' ? this.resolveKey(config.apiKeyEnv) : undefined;
  }

  /** Map a 403/429 to a recoverable rate limit and start its Retry-After cooldown. */
  rateLimitError(error) {
    const status = error?.status ?? error?.cause?.status;
    if (status === 403 || status === 429) {
      const retryAfterMs = error?.retryAfterMs ?? error?.cause?.retryAfterMs;
      if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
        this.cooldownUntil = Date.now() + retryAfterMs;
      }
      return webError('GitHub rate limited', 'WEB_RATE_LIMITED', { cause: error });
    }
    return error;
  }

  async search(request, signal) {
    const settings = this.settings();
    const config = settings.github;
    const token = await this.apiKey(config);
    const headers = {
      accept: 'application/vnd.github+json',
      ...API_HEADERS,
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    };
    // A lone owner/repo slug names one repository, so resolve it directly. GitHub's
    // relevance search ranks popular namesakes above the exact repo (facebook/react
    // surfaced react-facebook-login forks), so the exact repository was missing.
    const exact = parseRepoSlug(request.query);
    if (exact !== undefined) {
      const directUrl = new URL(joinURL(config.baseURL, `/repos/${exact.owner}/${exact.repo}`));
      try {
        return await providerOperation({
          settings,
          provider: 'GitHub',
          operation: 'search',
          url: directUrl.toString(),
          // Follow GitHub's 301 when a repository was renamed (facebook/react now
          // redirects to react/react) so the exact repository still resolves.
          request: { method: 'GET', headers, signal, redirect: 'follow' },
          observe: (response) => recordGithubRateLimit(response),
          map: (data) => mapGithubRepo(data, settings.maxSnippetChars),
        });
      } catch (error) {
        const status = error?.status ?? error?.cause?.status;
        // A missing or renamed-away repo (404) falls back to text search; auth,
        // rate limits, and transient failures still stop here.
        if (status !== 404 && status !== 422) throw this.rateLimitError(error);
      }
    }
    const { endpoint, q } = buildGithubQuery(request.query);
    const path = endpoint === 'issues' ? '/search/issues' : '/search/repositories';
    const url = new URL(joinURL(config.baseURL, path));
    url.searchParams.set('q', q);
    url.searchParams.set('per_page', String(clampCount(request.maxResults, 10, 100)));
    try {
      return await providerOperation({
        settings,
        provider: 'GitHub',
        operation: 'search',
        url: url.toString(),
        request: { method: 'GET', headers, signal },
        observe: (response) => recordGithubRateLimit(response),
        map: (data) =>
          endpoint === 'issues'
            ? mapGithubIssueSearch(data, settings.maxSnippetChars)
            : mapGithubRepoSearch(data, settings.maxSnippetChars),
      });
    } catch (error) {
      throw this.rateLimitError(error);
    }
  }

  async fetch(request, signal) {
    const settings = this.settings();
    const config = settings.github;
    const target = githubFetchTarget(request.url);
    if (target === undefined) {
      throw webError('GitHub fetch supports issue and repository pages only', 'WEB_INVALID_URL');
    }
    const token = await this.apiKey(config);
    const auth = token === undefined ? {} : { authorization: `Bearer ${token}` };
    try {
      if (target.kind === 'readme') {
        const url = joinURL(config.baseURL, `/repos/${target.owner}/${target.repo}/readme`);
        return await providerOperation({
          settings,
          provider: 'GitHub',
          operation: 'fetch',
          isFetch: true,
          text: true,
          url,
          request: { method: 'GET', headers: { accept: 'application/vnd.github.raw', ...API_HEADERS, ...auth }, signal },
          observe: (response) => recordGithubRateLimit(response),
          map: (body) => {
            const text = typeof body === 'string' ? body : '';
            if (text.trim().length === 0) throw webError('GitHub README is empty', 'WEB_INVALID_RESPONSE');
            return textResult(request.url, `# ${target.owner}/${target.repo}\n\n${text}`, settings.maxFetchChars);
          },
        });
      }
      const url = joinURL(config.baseURL, `/repos/${target.owner}/${target.repo}/issues/${target.number}`);
      return await providerOperation({
        settings,
        provider: 'GitHub',
        operation: 'fetch',
        isFetch: true,
        url,
        request: { method: 'GET', headers: { accept: 'application/vnd.github+json', ...API_HEADERS, ...auth }, signal },
        observe: (response) => recordGithubRateLimit(response),
        map: (data) => {
          const title = typeof data?.title === 'string' ? data.title : '';
          const state = typeof data?.state === 'string' ? data.state : 'unknown';
          const user = typeof data?.user?.login === 'string' ? data.user.login : 'unknown';
          const comments = Number.isFinite(data?.comments) ? data.comments : 0;
          const body = typeof data?.body === 'string' ? data.body : '';
          return textResult(
            request.url,
            `# ${title}\n\n> ${state} · ${user} · ${comments} 条评论\n\n${body}`,
            settings.maxFetchChars,
          );
        },
      });
    } catch (error) {
      throw this.rateLimitError(error);
    }
  }
}
