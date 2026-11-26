import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GithubProvider,
  GITHUB_PROVIDER_ID,
  mapGithubRepoSearch,
  mapGithubIssueSearch,
  mapGithubRepo,
} from '../lib/providers/github.js';
import { wantsGithub, looksLikeErrorText, parseRepoSlug } from '../lib/technical.js';
import { githubFetchTarget } from '../lib/host.js';
import { AutoFetchProvider } from '../lib/providers/router.js';
import { fastOrder, classifyIntent } from '../lib/intent.js';
import { webError } from '../lib/errors.js';
import { createMultiKeyProvider } from '../lib/keyring.js';
import { providerEntry } from '../lib/catalog.js';
import { resolveSettings } from '../lib/settings.js';
import { readProviderUsage } from '../lib/quotaStore.js';
import { withFetch } from './helpers/withFetch.js';

function ghSettings(over = {}) {
  return {
    requestTimeoutMs: 5_000,
    maxSnippetChars: 4_000,
    maxFetchChars: 200_000,
    fetchMode: 'fast',
    fetchOrder: ['http'],
    github: { enabled: true, apiKeyEnv: 'GITHUB_TOKEN', baseURL: 'https://api.github.com', ...over },
  };
}

function jsonResponse(payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

test('mapGithubRepoSearch maps repo fields into seam sources', () => {
  const data = {
    total_count: 1,
    items: [
      {
        full_name: 'qikairo7/dsh-web-search',
        html_url: 'https://github.com/qikairo7/dsh-web-search',
        description: 'free web search plugin',
        stargazers_count: 1234,
        language: 'JavaScript',
        topics: ['dsh', 'search'],
        pushed_at: '2026-01-02T03:04:05Z',
      },
      { full_name: 'bad', html_url: 'not-a-url' },
    ],
  };
  const result = mapGithubRepoSearch(data, 4_000);
  assert.equal(result.sources.length, 1);
  const [source] = result.sources;
  assert.equal(source.url, 'https://github.com/qikairo7/dsh-web-search');
  assert.equal(source.title, 'qikairo7/dsh-web-search');
  assert.match(source.snippet, /free web search plugin/u);
  assert.match(source.snippet, /1234/u);
  assert.match(source.snippet, /JavaScript/u);
  assert.match(source.snippet, /dsh, search/u);
  assert.equal(source.publishedAt, '2026-01-02T03:04:05Z');
});

test('mapGithubIssueSearch keeps issues, drops pull requests, and keeps state/comments', () => {
  const data = {
    items: [
      {
        html_url: 'https://github.com/o/r/issues/7',
        title: 'spawn EPERM on Windows',
        body: 'Running the plugin throws spawn EPERM.',
        state: 'open',
        comments: 4,
        created_at: '2026-02-03T00:00:00Z',
      },
      {
        html_url: 'https://github.com/o/r/pull/9',
        title: 'a pull request',
        body: 'pr body',
        state: 'open',
        comments: 0,
        created_at: '2026-02-04T00:00:00Z',
        pull_request: { url: 'https://api.github.com/repos/o/r/pulls/9' },
      },
    ],
  };
  const result = mapGithubIssueSearch(data, 4_000);
  assert.equal(result.sources.length, 1);
  const [source] = result.sources;
  assert.equal(source.url, 'https://github.com/o/r/issues/7');
  assert.equal(source.title, 'spawn EPERM on Windows');
  assert.match(source.snippet, /spawn EPERM/u);
  assert.match(source.snippet, /open/u);
  assert.match(source.snippet, /4/u);
  assert.equal(source.publishedAt, '2026-02-03T00:00:00Z');
});

test('GithubProvider.search hits the issue endpoint for error text and stays anonymous without a key', async () => {
  assert.equal(GITHUB_PROVIDER_ID, 'github');
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: new URL(String(url)), headers: init.headers };
      return jsonResponse({ items: [] });
    },
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined });
      const result = await provider.search({ query: 'TypeError: spawn EPERM', maxResults: 5 });
      assert.equal(seen.url.origin + seen.url.pathname, 'https://api.github.com/search/issues');
      assert.equal(seen.url.searchParams.get('q'), 'TypeError: spawn EPERM');
      assert.equal(seen.url.searchParams.get('per_page'), '5');
      assert.equal('authorization' in seen.headers, false);
      assert.deepEqual(result.sources, []);
    },
  );
});

test('GithubProvider.search resolves a bare owner/repo slug through /repos and sends the PAT when present', async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: new URL(String(url)), headers: init.headers, redirect: init.redirect };
      return jsonResponse({ full_name: 'qikairo7/dsh-web-search', html_url: 'https://github.com/qikairo7/dsh-web-search', stargazers_count: 7 });
    },
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => 'ghp_test' });
      const result = await provider.search({ query: 'qikairo7/dsh-web-search', maxResults: 10 });
      assert.equal(seen.url.pathname, '/repos/qikairo7/dsh-web-search');
      assert.equal(seen.redirect, 'follow', 'a renamed repo 301 must be followed so the exact repository resolves');
      assert.equal(seen.headers.authorization, 'Bearer ghp_test');
      assert.equal(result.sources.length, 1);
      assert.equal(result.sources[0].url, 'https://github.com/qikairo7/dsh-web-search');
    },
  );
});

test('GithubProvider.search falls back to text search when a bare slug is not a repository', async () => {
  const paths = [];
  await withFetch(
    async (url) => {
      const u = new URL(String(url));
      paths.push(u.pathname);
      if (u.pathname.startsWith('/repos/')) {
        return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers: { 'content-type': 'application/json' } });
      }
      return jsonResponse({ items: [{ full_name: 'x/y', html_url: 'https://github.com/x/y' }] });
    },
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined });
      const result = await provider.search({ query: 'ghostowner/ghostrepo', maxResults: 5 });
      assert.equal(paths[0], '/repos/ghostowner/ghostrepo');
      assert.equal(paths[1], '/search/repositories');
      assert.equal(result.sources.length, 1);
    },
  );
});

test('mapGithubRepo maps a single /repos payload into one source and rejects a non-repo body', () => {
  const result = mapGithubRepo({ full_name: 'facebook/react', html_url: 'https://github.com/react/react', stargazers_count: 200000, language: 'JavaScript' }, 4_000);
  assert.equal(result.sources.length, 1);
  assert.match(result.sources[0].snippet, /JavaScript/u);
  assert.throws(() => mapGithubRepo({ message: 'Not Found' }), /not a GitHub repository/u);
});

test('GithubProvider.search records the search rate-limit reading', async () => {
  await withFetch(
    () => jsonResponse({ items: [] }, { 'x-ratelimit-remaining': '57', 'x-ratelimit-limit': '60', 'x-ratelimit-resource': 'search' }),
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined });
      await provider.search({ query: 'TypeError: spawn EPERM' });
      assert.equal(readProviderUsage('github').remaining, 57);
    },
  );
});

test('GithubProvider.search maps a 403 to a recoverable rate-limited error', async () => {
  await withFetch(
    { status: 403, headers: { 'content-type': 'application/json', 'retry-after': '60' }, body: { message: 'secondary rate limit' } },
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined });
      await assert.rejects(provider.search({ query: 'qikairo7/dsh-web-search' }), (error) => {
        assert.equal(error.name, 'WebError');
        assert.equal(error.code, 'WEB_RATE_LIMITED');
        return true;
      });
      // Retry-After: 60 must put the provider into roughly a 60s cooldown, so the
      // chain skips it instead of calling again (ADR-0012).
      assert.equal(provider.available(), false);
      const remaining = provider.cooldownUntil - Date.now();
      assert.ok(remaining > 55_000 && remaining <= 60_000, `cooldown ${remaining}ms`);
    },
  );
});

test('GithubProvider.search caps a day-long Retry-After at the breaker cooldown and recovers after it', async () => {
  await withFetch(
    { status: 403, headers: { 'content-type': 'application/json', 'retry-after': '86400' }, body: { message: 'secondary rate limit' } },
    async () => {
      const breakerCooldownMs = 50;
      const provider = new GithubProvider({
        settings: () => ({ ...ghSettings(), breakerCooldownMs }),
        resolveKey: async () => undefined,
      });
      await assert.rejects(provider.search({ query: 'qikairo7/dsh-web-search' }), (error) => {
        assert.equal(error.code, 'WEB_RATE_LIMITED');
        return true;
      });
      // A day-long Retry-After must not outlive the breaker cooldown the rest of
      // the router honors (ADR-0012), or GitHub goes silently missing for the day.
      const remaining = provider.cooldownUntil - Date.now();
      assert.ok(remaining <= breakerCooldownMs, `cooldown ${remaining}ms must be capped at ${breakerCooldownMs}ms`);
      assert.equal(provider.available(), false);
      await new Promise((resolve) => setTimeout(resolve, breakerCooldownMs + 50));
      assert.equal(provider.available(), true, 'the provider must come back once the capped cooldown expires');
    },
  );
});

test('createMultiKeyProvider delegates available() to the keyed instance so a PAT rate-limit cooldown propagates', async () => {
  let shadow;
  await withFetch(
    { status: 403, headers: { 'content-type': 'application/json', 'retry-after': '120' }, body: { message: 'secondary rate limit' } },
    async () => {
      const wrapped = createMultiKeyProvider({
        provider: new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined }),
        factory: (key) => {
          shadow = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => key });
          return shadow;
        },
        resolveKeys: async () => ['ghp_example'],
      });
      await assert.rejects(wrapped.search({ query: 'qikairo7/dsh-web-search' }), (error) => {
        assert.equal(error.name, 'WebError');
        assert.equal(error.code, 'WEB_RATE_LIMITED');
        return true;
      });
      // The cooldown lands on the per-key instance the call actually used, not
      // the wrapped primary. available() must read through to that instance, or
      // the router keeps calling a provider that is still inside Retry-After.
      assert.equal(wrapped.available(), false);
      const remaining = shadow.cooldownUntil - Date.now();
      assert.ok(remaining > 115_000 && remaining <= 120_000, `cooldown ${remaining}ms`);
    },
  );
});

test('GithubProvider.fetch turns an issue page into structured markdown', async () => {
  let seen;
  await withFetch(
    async (url) => {
      seen = new URL(String(url));
      return jsonResponse({
        title: 'spawn EPERM on Windows',
        state: 'open',
        user: { login: 'octocat' },
        comments: 4,
        body: 'Steps to reproduce: run the plugin.',
      });
    },
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined });
      const result = await provider.fetch({ url: 'https://github.com/qikairo7/dsh-web-search/issues/40' });
      assert.equal(seen.pathname, '/repos/qikairo7/dsh-web-search/issues/40');
      assert.equal(result.url, 'https://github.com/qikairo7/dsh-web-search/issues/40');
      assert.equal(result.statusCode, 200);
      assert.match(result.body.content, /spawn EPERM on Windows/u);
      assert.match(result.body.content, /open/u);
      assert.match(result.body.content, /octocat/u);
      assert.match(result.body.content, /Steps to reproduce/u);
    },
  );
});

test('GithubProvider.fetch turns a repo home into its README', async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: new URL(String(url)), accept: init.headers.accept };
      return new Response('# dsh-web-search\n\nfree plugin', { status: 200, headers: { 'content-type': 'text/plain' } });
    },
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined });
      const result = await provider.fetch({ url: 'https://github.com/qikairo7/dsh-web-search' });
      assert.equal(seen.url.pathname, '/repos/qikairo7/dsh-web-search/readme');
      assert.match(seen.accept, /raw/u);
      assert.match(result.body.content, /free plugin/u);
    },
  );
});

test('GithubProvider.fetch rejects a non issue/repo URL as invalid', async () => {
  const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined });
  await assert.rejects(provider.fetch({ url: 'https://github.com/qikairo7/dsh-web-search/blob/main/x.js' }), (error) => {
    assert.equal(error.code, 'WEB_INVALID_URL');
    return true;
  });
});

test('githubFetchTarget and wantsGithub classify github targets', () => {
  assert.deepEqual(githubFetchTarget('https://github.com/o/r/issues/3'), { kind: 'issue', owner: 'o', repo: 'r', number: 3 });
  assert.deepEqual(githubFetchTarget('https://github.com/o/r'), { kind: 'readme', owner: 'o', repo: 'r' });
  assert.equal(githubFetchTarget('https://github.com/o/r/blob/main/x.js'), undefined);
  assert.equal(githubFetchTarget('https://example.com/o/r'), undefined);
  assert.equal(wantsGithub('site:github.com dsh-web-search'), true);
  assert.equal(wantsGithub('TypeError: spawn EPERM'), true);
  // Class 1: real owner/repo slugs and a bare repo name route to GitHub (F11).
  for (const query of [
    'facebook/react', 'vuejs/core', 'nodejs/node', 'vercel/next.js',
    'openai/gpt', 'microsoft/vscode', 'torvalds/linux',
    'qikairo7/dsh-web-search', 'dsh-web-search',
  ]) {
    assert.equal(wantsGithub(query), true, `${query} must route to GitHub`);
  }
  // Class 2: generic word pairs are excluded by the vocabulary, not by digits (F6).
  for (const query of ['input/output format', 'and/or', 'A/B test', 'npm/pnpm 差别', 'TCP/IP 设置']) {
    assert.equal(wantsGithub(query), false, `${query} is a word pair, not a repo`);
  }
  // Class 3: technical standard words are not bare repo names (F11).
  for (const query of ['node.js', 'vue.js', 'utf-8', 'sha-256', 'python3.11', 'w3.org', 'how-to', 'read-me', 'e-mail']) {
    assert.equal(wantsGithub(query), false, `${query} is a standard term, not a repo`);
  }
  // A lone owner/repo parses to its halves; prose and operators do not (A direct lookup).
  assert.deepEqual(parseRepoSlug('facebook/react'), { owner: 'facebook', repo: 'react' });
  assert.deepEqual(parseRepoSlug('vercel/next.js'), { owner: 'vercel', repo: 'next.js' });
  assert.equal(parseRepoSlug('site:github.com/o/r'), undefined);
  assert.equal(parseRepoSlug('node.js/utf-8'), undefined);
  assert.equal(parseRepoSlug('input/output format'), undefined);
  // A dotted left segment is a file path, not an owner (walkthrough P2).
  assert.equal(wantsGithub('node.js/utf-8'), false);
  assert.equal(wantsGithub('红烧肉做法'), false);
  // Class 4 (kept): the original error text still routes to GitHub, and Node
  // error codes with underscores are recognised (F11 / walkthrough P2).
  assert.equal(looksLikeErrorText('ModuleNotFoundError: no module named x'), true);
  assert.equal(looksLikeErrorText('ERR_MODULE_NOT_FOUND'), true);
  assert.equal(looksLikeErrorText('Cannot find module ./x'), true);
  assert.equal(wantsGithub('ERR_MODULE_NOT_FOUND'), true);
  assert.equal(looksLikeErrorText('best hiking trails'), false);
});

test('fast mode leads with github for a repo query without dropping the other backends', () => {
  const settings = resolveSettings();
  const repoOrder = fastOrder('facebook/react', settings, classifyIntent('facebook/react'));
  assert.equal(repoOrder[0], 'github', 'a repo query must try github first');
  assert.ok(repoOrder.length > 1 && repoOrder.includes('keenable'), 'github leads but must not monopolise the chain');
  const proseOrder = fastOrder('how to bake sourdough bread', settings, classifyIntent('how to bake sourdough bread'));
  assert.equal(proseOrder.includes('github'), false, 'a non-repo query keeps github out of the fast order');
});

test('AutoFetchProvider routes a github issue URL straight to the github provider', async () => {
  const settings = { ...resolveSettings(), fetchMode: 'fast', fetchOrder: ['http'] };
  const providers = {
    github: {
      id: 'github',
      available: () => true,
      ready: async () => true,
      fetch: async () => ({ url: 'github-hit', statusCode: 200, body: { kind: 'text', content: 'from github' }, truncated: false }),
    },
    http: {
      id: 'http',
      available: () => true,
      ready: async () => true,
      fetch: async () => ({ url: 'http-hit', statusCode: 200, body: { kind: 'text', content: 'from http' }, truncated: false }),
    },
  };
  const auto = new AutoFetchProvider({ settings: () => settings, providers });
  const result = await auto.fetch({ url: 'https://github.com/o/r/issues/3' });
  assert.equal(result.url, 'github-hit');
});

test('AutoFetchProvider keeps a non-GitHub URL on the HTTP path', async () => {
  const settings = { ...resolveSettings(), fetchMode: 'fast', fetchOrder: ['http'] };
  let githubCalled = false;
  const providers = {
    github: {
      id: 'github',
      available: () => true,
      ready: async () => true,
      fetch: async () => {
        githubCalled = true;
        throw webError('GitHub fetch supports issue and repository pages only', 'WEB_INVALID_URL');
      },
    },
    http: {
      id: 'http',
      available: () => true,
      ready: async () => true,
      fetch: async () => ({ url: 'http-hit', statusCode: 200, body: { kind: 'text', content: 'from http' }, truncated: false }),
    },
  };
  const auto = new AutoFetchProvider({ settings: () => settings, providers });
  const result = await auto.fetch({ url: 'https://example.com/article' });
  assert.equal(result.url, 'http-hit');
  assert.equal(githubCalled, false);
});

test('GithubProvider.search keeps a site:github.com/<owner>/<repo> path as a repo: filter', async () => {
  let seen;
  await withFetch(
    async (url) => {
      seen = new URL(String(url));
      return jsonResponse({ items: [] });
    },
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined });
      await provider.search({ query: 'site:github.com/qikairo7/dsh-web-search' });
      assert.equal(seen.pathname, '/search/repositories');
      assert.equal(seen.searchParams.get('q'), 'repo:qikairo7/dsh-web-search');
    },
  );
});

test('GithubProvider.search strips the provider-neutral lang: operator', async () => {
  let seen;
  await withFetch(
    async (url) => {
      seen = new URL(String(url));
      return jsonResponse({ items: [] });
    },
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined });
      await provider.search({ query: 'lang:zh vue' });
      assert.equal(seen.searchParams.get('q'), 'vue');
    },
  );
});

test('github does not declare the natural-language operator it cannot honor', () => {
  assert.equal(providerEntry('github').operators.includes('language'), false);
});

test('QualityEngine adds github to the fan-out for a github/error query', async () => {
  const { QualityEngine } = await import('../lib/quality.js');
  const called = [];
  const baseSettings = {
    officialDocsEnabled: false,
    newsFreshnessEnabled: false,
    enrichEnabled: false,
    semanticDedupThreshold: 0.95,
    requestTimeoutMs: 5_000,
    maxSnippetChars: 4_000,
    github: { enabled: true, apiKeyEnv: 'GITHUB_TOKEN', baseURL: 'https://api.github.com' },
    keenable: { enabled: true },
    anysearch: { enabled: true },
  };
  const mk = (id) => ({ id, available: () => true, ready: async () => true, search: async () => { called.push(id); return { sources: [{ url: 'https://' + id + '.example/x', title: id }], truncated: false }; } });
  const providers = { keenable: mk('keenable'), anysearch: mk('anysearch'), github: mk('github') };
  const { ProviderRunner } = await import('../lib/providerRunner.js');
  const engine = new QualityEngine({ settings: () => baseSettings, providers, runner: new ProviderRunner({ settings: () => baseSettings, providers }) });
  await engine.search({ query: 'TypeError: spawn EPERM', maxResults: 5 });
  assert.ok(called.includes('github'), 'github should be attempted in quality mode for an error query');
});