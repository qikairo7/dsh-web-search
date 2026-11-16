import test from 'node:test';
import assert from 'node:assert/strict';

import { BingProvider, BING_PROVIDER_ID, mapBingSearch, unwrapBingUrl } from '../lib/providers/bing.js';
import { ProviderRunner } from '../lib/providerRunner.js';
import { resolveSettings } from '../lib/settings.js';
import { USER_AGENT } from '../lib/providers/shared.js';
import { withFetch } from './helpers/withFetch.js';

/** Build a bing.com/ck/a redirect the way Bing wraps result URLs. */
function ckHref(target) {
  return `https://www.bing.com/ck/a?FORM=QBLH&u=a1${Buffer.from(target).toString('base64url')}&ntb=1`;
}

function serpBlock({ href, title, snippet }) {
  return `<li class="b_algo"><h2><a href="${href}">${title}</a></h2><p>${snippet}</p></li>`;
}

test('unwrapBingUrl decodes the u parameter and keeps undecodable or non-http links', () => {
  assert.equal(unwrapBingUrl(ckHref('https://example.com/page')), 'https://example.com/page');
  assert.equal(unwrapBingUrl('https://example.com/direct'), 'https://example.com/direct');
  assert.equal(
    unwrapBingUrl(ckHref('https://example.com/a?b=1&c=2').replaceAll('&', '&amp;')),
    'https://example.com/a?b=1&c=2',
  );
  const ftp = `https://www.bing.com/ck/a?u=a1${Buffer.from('ftp://example.com/x').toString('base64url')}`;
  assert.equal(unwrapBingUrl(ftp), ftp);
  const junk = 'https://www.bing.com/ck/a?u=a1%2A%2A';
  assert.equal(unwrapBingUrl(junk), junk);
});

test('mapBingSearch maps b_algo blocks, dedupes by URL, and truncates snippets', () => {
  const html = `<ol>${serpBlock({
    href: ckHref('https://a.example/one'),
    title: 'DeepSeek <b>指南</b>',
    snippet: `A &amp; B ${'x'.repeat(100)}`,
  })}${serpBlock({ href: ckHref('https://a.example/one'), title: 'duplicate', snippet: 'dup' })}${serpBlock(
    { href: 'https://b.example/two', title: 'DeepSeek 教程', snippet: 'second' },
  )}</ol>`;
  const result = mapBingSearch(html, 'DeepSeek 指南', 10);
  assert.equal(result.truncated, false);
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[0].url, 'https://a.example/one');
  assert.equal(result.sources[0].title, 'DeepSeek 指南');
  assert.equal(result.sources[0].snippet, 'A & B xxxx');
  assert.equal(result.sources[1].url, 'https://b.example/two');
  assert.equal(result.sources[1].snippet, 'second');
});

test('mapBingSearch maps an empty SERP to zero sources', () => {
  const html = '<html><body><main><div class="b_no"><p>没有与此相关的结果</p></div></main></body></html>';
  assert.deepEqual(mapBingSearch(html, 'any query', 4000), { sources: [], truncated: false });
});

test('mapBingSearch rejects an unrelated cache-page batch as zero sources', () => {
  const html = `<ol>${serpBlock({ href: 'https://weather.example/paris', title: 'Weather Forecast Paris', snippet: 'Rain all week in Paris' })}${serpBlock({ href: 'https://food.example/pizza', title: 'Best Pizza Recipes', snippet: 'Classic dough and sauce' })}${serpBlock({ href: 'https://cars.example/used', title: 'Used Cars Sale', snippet: 'Cheap sedans near you' })}</ol>`;
  assert.deepEqual(mapBingSearch(html, 'deepseek harness plugin', 4000), { sources: [], truncated: false });
});

function bingSettings(bing = {}) {
  return {
    ...resolveSettings(),
    requestTimeoutMs: 5_000,
    bing: { enabled: true, baseURL: 'https://www.bing.com', market: '', ...bing },
  };
}

test('BingProvider.search requests the SERP with the shared UA and no mkt by default', async () => {
  assert.equal(BING_PROVIDER_ID, 'bing');
  const html = serpBlock({
    href: ckHref('https://doc.example/guide'),
    title: 'DeepSeek Harness 插件开发指南',
    snippet: 'How to develop the plugin',
  });
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url: String(url), init };
      return new Response(`<ol>${html}</ol>`, { status: 200, headers: { 'content-type': 'text/html' } });
    },
    async () => {
      const provider = new BingProvider({ settings: () => bingSettings() });
      assert.equal(provider.id, 'bing');
      const result = await provider.search({ query: 'DeepSeek Harness 插件开发', maxResults: 20 });
      assert.deepEqual(result.sources.map((source) => source.url), ['https://doc.example/guide']);
      const url = new URL(seen.url);
      assert.equal(`${url.origin}${url.pathname}`, 'https://www.bing.com/search');
      assert.equal(url.searchParams.get('q'), 'DeepSeek Harness 插件开发');
      assert.equal(url.searchParams.has('mkt'), false);
      assert.equal(seen.init.method, 'GET');
      assert.match(seen.init.headers.accept, /text\/html/u);
      assert.equal(seen.init.headers['accept-language'], 'zh-CN,zh;q=0.9,en;q=0.8');
      assert.equal(seen.init.headers['user-agent'], USER_AGENT);
    },
  );
});

test('BingProvider.search localizes via language and sends mkt only when bingMarket is set', async () => {
  const html = serpBlock({
    href: 'https://doc.example/harness',
    title: 'DeepSeek Harness plugin guide',
    snippet: 'develop plugins with harness',
  });
  const seen = [];
  await withFetch(
    async (url, init) => {
      seen.push({ url: new URL(String(url)), init });
      return new Response(`<ol>${html}</ol>`, { status: 200, headers: { 'content-type': 'text/html' } });
    },
    async () => {
      const plain = new BingProvider({ settings: () => bingSettings() });
      await plain.search({ query: 'DeepSeek Harness plugin' });
      assert.equal(seen[0].init.headers['accept-language'], 'en-US,en;q=0.9');
      assert.equal(seen[0].url.searchParams.has('mkt'), false);

      const market = new BingProvider({
        settings: () => bingSettings({ baseURL: 'https://www.bing.com', market: 'en-US' }),
      });
      await market.search({ query: 'DeepSeek Harness 插件开发' });
      assert.equal(seen[1].url.searchParams.get('mkt'), 'en-US');
      assert.equal(seen[1].init.headers['accept-language'], 'en-US');
    },
  );
});

test('BingProvider.search throws a recoverable error on zero relevant results', async () => {
  await withFetch(
    { status: 200, headers: { 'content-type': 'text/html' }, body: '<html><body><p>no results</p></body></html>' },
    async () => {
      const provider = new BingProvider({ settings: () => bingSettings() });
      await assert.rejects(provider.search({ query: 'deepseek harness' }), (error) => {
        assert.equal(error.name, 'WebError');
        assert.equal(error.code, 'WEB_PROVIDER_ERROR');
        return true;
      });
    },
  );
});

test('the runner advances to the next provider after Bing maps zero results', async () => {
  const settings = () => bingSettings();
  const providers = {
    bing: new BingProvider({ settings }),
    exa: {
      id: 'exa',
      available: () => true,
      ready: async () => true,
      async search() {
        return { sources: [{ url: 'https://exa.example/answer', title: 'Exa answer' }], truncated: false };
      },
    },
  };
  const runner = new ProviderRunner({ settings, providers });
  const result = await withFetch({ body: '<html><body></body></html>' }, () =>
    runner.run({ capability: 'search', order: ['bing', 'exa'], request: { query: 'deepsearch harness' } }));
  assert.deepEqual(result.sources.map((source) => source.url), ['https://exa.example/answer']);
});
