import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GithubProvider,
  GITHUB_PROVIDER_ID,
  mapGithubRepoSearch,
  mapGithubIssueSearch,
} from '../lib/providers/github.js';
import { wantsGithub, looksLikeErrorText } from '../lib/technical.js';
import { githubFetchTarget } from '../lib/host.js';
import { AutoFetchProvider } from '../lib/providers/router.js';
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

test('GithubProvider.search hits the repository endpoint for a repo slug and sends the PAT when present', async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: new URL(String(url)), headers: init.headers };
      return jsonResponse({ items: [] });
    },
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => 'ghp_test' });
      await provider.search({ query: 'qikairo7/dsh-web-search', maxResults: 10 });
      assert.equal(seen.url.pathname, '/search/repositories');
      assert.equal(seen.headers.authorization, 'Bearer ghp_test');
    },
  );
});

test('GithubProvider.search records the search rate-limit reading', async () => {
  await withFetch(
    () => jsonResponse({ items: [] }, { 'x-ratelimit-remaining': '57', 'x-ratelimit-limit': '60', 'x-ratelimit-resource': 'search' }),
    async () => {
      const provider = new GithubProvider({ settings: () => ghSettings(), resolveKey: async () => undefined });
      await provider.search({ query: 'qikairo7/dsh-web-search' });
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
  assert.equal(githubFetchTarget('https://example.com/x'), undefined);
  assert.equal(wantsGithub('site:github.com dsh-web-search'), true);
  assert.equal(wantsGithub('qikairo7/dsh-web-search'), true);
  assert.equal(wantsGithub('TypeError: spawn EPERM'), true);
  assert.equal(wantsGithub('红烧肉做法'), false);
  assert.equal(looksLikeErrorText('ModuleNotFoundError: no module named x'), true);
  assert.equal(looksLikeErrorText('best hiking trails'), false);
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
