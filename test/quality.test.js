import test from 'node:test';
import assert from 'node:assert/strict';

import { QualityEngine } from '../lib/quality.js';
import { ProviderRunner } from '../lib/providerRunner.js';
import { webError } from '../lib/errors.js';

function settings(overrides = {}) {
  return {
    officialDocsEnabled: false,
    enrichEnabled: false,
    semanticDedupThreshold: 0.95,
    keenable: { enabled: true },
    anysearch: { enabled: true },
    zhihu: { enabled: true },
    tavily: { enabled: true },
    ...overrides,
  };
}

/** Build the engine the way the router does: one settings thunk, real runner. */
function makeEngine({ providers, overrides = {}, reranker, embeddings, fetcher }) {
  const settingsThunk = () => settings(overrides);
  return new QualityEngine({
    settings: settingsThunk,
    providers,
    runner: new ProviderRunner({ settings: settingsThunk, providers }),
    reranker,
    embeddings,
    fetcher,
  });
}

function fakeProvider(result) {
  return {
    available: () => true,
    ready: async () => true,
    search: async () => result,
  };
}

test('QualityEngine merges provider results, dedupes by URL and applies the reranker', async () => {
  const providers = {
    zhihu: fakeProvider({
      sources: [
        { url: 'https://a.example/', title: 'A' },
        { url: 'https://shared.example/', title: 'shared' },
      ],
      truncated: false,
    }),
    anysearch: fakeProvider({
      sources: [
        { url: 'https://b.example/', title: 'B' },
        { url: 'https://shared.example/', title: 'shared duplicate' },
      ],
      truncated: false,
    }),
    tavily: fakeProvider({
      content: 'generated answer',
      sources: [{ url: 'https://c.example/', title: 'C' }],
      truncated: false,
    }),
  };
  const quality = makeEngine({
    providers,
    reranker: {
      rerankScored: async (_query, sources) =>
        sources.map((source, index) => ({ source, score: 10 - index, rank: index, index })),
    },
  });
  const outcome = await quality.search({ query: 'DeepSeek 插件开发', maxResults: 10 }, undefined);
  assert.deepEqual(
    outcome.sources.map((source) => source.url),
    ['https://a.example/', 'https://b.example/', 'https://shared.example/'],
  );
  assert.equal(outcome.content, undefined);
  assert.equal(outcome.truncated, false);
});

test('QualityEngine returns undefined when every provider fails', async () => {
  const failing = {
    available: () => true,
    ready: async () => true,
    search: async () => {
      throw new Error('search failed');
    },
  };
  const quality = makeEngine({ providers: { zhihu: failing, anysearch: failing } });
  const outcome = await quality.search({ query: '普通查询' }, undefined);
  assert.equal(outcome, undefined);
});

test('QualityEngine returns undefined when all free providers succeed with empty results', async () => {
  const empty = () => fakeProvider({ sources: [], truncated: false });
  const quality = makeEngine({
    providers: { keenable: empty(), anysearch: empty(), zhihu: empty() },
  });
  const outcome = await quality.search({ query: 'plain query' }, undefined);
  assert.equal(outcome, undefined);
});

test('QualityEngine calls rerankScored exactly once when reranking degrades', async () => {
  const calls = [];
  const reranker = {
    rerankScored: async (query) => {
      calls.push(query);
      return undefined;
    },
    // Mirrors the retired rerank() wrapper, which called rerankScored again:
    // kept so the count assertion below fails against the old two-attempt ladder.
    rerank: async (query, sources) => {
      await reranker.rerankScored(query, sources, undefined);
      return sources;
    },
  };
  const quality = makeEngine({
    providers: {
      keenable: fakeProvider({
        sources: [
          { url: 'https://k1.example/', title: 'K1' },
          { url: 'https://k2.example/', title: 'K2' },
        ],
        truncated: false,
      }),
      anysearch: fakeProvider({
        sources: [{ url: 'https://a1.example/', title: 'A1' }],
        truncated: false,
      }),
    },
    reranker,
  });
  const outcome = await quality.search({ query: 'quality search fallback' }, undefined);
  assert.equal(calls.length, 1);
  assert.deepEqual(
    outcome.sources.map((source) => source.url),
    ['https://k1.example/', 'https://a1.example/', 'https://k2.example/'],
  );
});

function officialDocsSetup(freeSources) {
  const supplementCalls = [];
  const providers = {
    keenable: fakeProvider({ sources: freeSources, truncated: false }),
    tavily: {
      available: () => true,
      ready: async () => true,
      searchWithDomains: async (request, domains) => {
        supplementCalls.push({ query: request.query, domains });
        return {
          sources: [{ url: 'https://nodejs.org/api/fs.html', title: 'Node.js fs promises API' }],
          truncated: false,
        };
      },
    },
  };
  return {
    supplementCalls,
    quality: makeEngine({ providers, overrides: { officialDocsEnabled: true } }),
  };
}

test('official-docs supplement runs when free results lack the official domain', async () => {
  const { supplementCalls, quality } = officialDocsSetup([
    { url: 'https://stackoverflow.com/questions/8752138', title: 'fs.promises usage' },
  ]);
  const outcome = await quality.search({ query: 'node.js fs promises', maxResults: 10 }, undefined);
  assert.equal(supplementCalls.length, 1);
  assert.deepEqual(supplementCalls[0].domains, ['nodejs.org']);
  assert.ok(outcome.sources.some((source) => source.url === 'https://nodejs.org/api/fs.html'));
});

test('official-docs supplement is skipped when free results cite the official domain', async () => {
  const { supplementCalls, quality } = officialDocsSetup([
    { url: 'https://nodejs.org/api/fs.html', title: 'File system | Node.js' },
  ]);
  const outcome = await quality.search({ query: 'node.js fs promises', maxResults: 10 }, undefined);
  assert.equal(supplementCalls.length, 0);
  assert.ok(outcome.sources.some((source) => source.url === 'https://nodejs.org/api/fs.html'));
});

test('official-docs supplement is skipped for site: queries', async () => {
  const { supplementCalls, quality } = officialDocsSetup([
    { url: 'https://example.com/nodejs-fs', title: 'nodejs fs notes' },
  ]);
  const outcome = await quality.search(
    { query: 'node.js fs promises site:example.com', maxResults: 10 },
    undefined,
  );
  assert.equal(supplementCalls.length, 0);
  assert.ok(outcome.sources.some((source) => source.url === 'https://example.com/nodejs-fs'));
});

test('news language filter drops wrong-language news instead of keeping every source', async () => {
  const engine = makeEngine({
    providers: {
      keenable: fakeProvider({
        sources: [{ url: 'https://www.reuters.com/world/china', title: 'China industry news' }],
        truncated: false,
      }),
    },
    overrides: { languageRouting: true },
  });
  const outcome = await engine.search({ query: '最新行业新闻 2026', maxResults: 10 }, undefined);
  assert.equal(outcome, undefined);
});

function newsFreshnessSetup(freeSources, { overrides = {} } = {}) {
  const supplementCalls = [];
  const providers = {
    zhihu: fakeProvider({ sources: freeSources, truncated: false }),
    keenable: fakeProvider({ sources: freeSources, truncated: false }),
    anysearch: fakeProvider({ sources: freeSources, truncated: false }),
    tavily: {
      available: () => true,
      ready: async () => true,
      search: async (request) => {
        supplementCalls.push(request.query);
        return {
          sources: [
            {
              url: 'https://www.sohu.com/a/fresh-news',
              title: '2026年11月 行业新闻汇总',
              publishedAt: new Date().toISOString(),
            },
          ],
          truncated: false,
        };
      },
    },
  };
  return {
    supplementCalls,
    quality: makeEngine({ providers, overrides }),
  };
}

test('news-freshness supplement runs when free news results lack fresh dates', async () => {
  const { supplementCalls, quality } = newsFreshnessSetup([
    { url: 'https://www.sohu.com/a/old-news', title: '旧闻', publishedAt: '2020-01-01T00:00:00Z' },
  ]);
  const outcome = await quality.search({ query: '2026年11月 行业新闻', maxResults: 10 }, undefined);
  assert.deepEqual(supplementCalls, ['2026年11月 行业新闻']);
  assert.ok(outcome.sources.some((source) => source.url === 'https://www.sohu.com/a/fresh-news'));
});

test('news-freshness supplement is skipped when three free results are freshly dated', async () => {
  const publishedAt = new Date().toISOString();
  const { supplementCalls, quality } = newsFreshnessSetup([
    { url: 'https://www.sohu.com/a/one', title: '一', publishedAt },
    { url: 'https://www.sohu.com/a/two', title: '二', publishedAt },
    { url: 'https://www.sohu.com/a/three', title: '三', publishedAt },
  ]);
  await quality.search({ query: '2026年11月 行业新闻', maxResults: 10 }, undefined);
  assert.deepEqual(supplementCalls, []);
});

test('news-freshness supplement never fires for AI news', async () => {
  const { supplementCalls, quality } = newsFreshnessSetup([
    { url: 'https://www.sohu.com/a/stale-ai', title: '旧 AI 新闻', publishedAt: '2020-01-01T00:00:00Z' },
  ]);
  await quality.search({ query: '2026年11月 AI 行业新闻', maxResults: 10 }, undefined);
  assert.deepEqual(supplementCalls, []);
});

test('news-freshness supplement respects newsFreshnessEnabled: false', async () => {
  const { supplementCalls, quality } = newsFreshnessSetup(
    [{ url: 'https://www.sohu.com/a/old-news', title: '旧闻', publishedAt: '2020-01-01T00:00:00Z' }],
    { overrides: { newsFreshnessEnabled: false } },
  );
  await quality.search({ query: '2026年11月 行业新闻', maxResults: 10 }, undefined);
  assert.deepEqual(supplementCalls, []);
});

test('news-freshness supplement failure returns the free results untouched', async () => {
  const providers = {
    zhihu: fakeProvider({
      sources: [{ url: 'https://www.sohu.com/a/free', title: '免费结果' }],
      truncated: false,
    }),
    tavily: {
      available: () => true,
      ready: async () => true,
      search: async () => {
        throw new Error('tavily down');
      },
    },
  };
  const quality = makeEngine({ providers });
  const outcome = await quality.search({ query: '2026年11月 行业新闻', maxResults: 10 }, undefined);
  assert.deepEqual(outcome.sources.map((source) => source.url), ['https://www.sohu.com/a/free']);
});

test('QualityEngine enriches through the pipeline with a bounded summary when bound keys are missing', async () => {
  // The settings thunk carries no enrichSummaryMinChars/MaxChars keys at all:
  // the engine chain must still produce an 800–1500 summary, never unbounded.
  const content = Array.from(
    { length: 60 },
    (_, index) => `The orbital station log entry number ${index} recorded the daily supply run.`,
  ).join('\n');
  const quality = makeEngine({
    providers: {
      zhihu: fakeProvider({
        sources: [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }],
        truncated: false,
      }),
    },
    overrides: { enrichEnabled: true, enrichTopN: 5 },
    fetcher: {
      fetch: async () => ({ body: { kind: 'text', content } }),
    },
  });
  const outcome = await quality.search({ query: '轨道空间站', maxResults: 10 }, undefined);
  const [source] = outcome.sources;
  assert.notEqual(source.summary, 'old');
  assert.ok(
    source.summary.length >= 800,
    `summary below the minimum bound: ${source.summary.length}`,
  );
  assert.ok(
    source.summary.length <= 1500,
    `summary above the maximum bound: ${source.summary.length}`,
  );
});

// --- internal deadline must degrade, not fail the whole search (issue #137) ---

test('QualityEngine keeps successful sources when the first fan-out hits the internal deadline', async () => {
  // #186: the router's internal deadline fires while a slow provider is still
  // running. A successful peer must survive; only caller cancellation may abort.
  const controller = new AbortController();
  const quality = makeEngine({
    providers: {
      keenable: fakeProvider({
        sources: [{ url: 'https://k1.example/', title: 'K1' }],
        truncated: false,
      }),
      anysearch: {
        available: () => true,
        ready: async () => true,
        search: async () => {
          controller.abort(new DOMException('search budget expired', 'TimeoutError'));
          throw webError('fan-out aborted', 'WEB_ABORTED');
        },
      },
    },
  });
  const outcome = await quality.search({ query: 'fan-out budget query' }, controller.signal);
  assert.deepEqual(
    outcome.sources.map((source) => source.url),
    ['https://k1.example/'],
  );
});

test('QualityEngine rethrows caller cancellation during the first fan-out', async () => {
  const controller = new AbortController();
  const quality = makeEngine({
    providers: {
      anysearch: {
        available: () => true,
        ready: async () => true,
        search: async () => {
          controller.abort(new DOMException('caller cancelled', 'AbortError'));
          throw webError('fan-out aborted', 'WEB_ABORTED');
        },
      },
    },
  });
  await assert.rejects(
    () => quality.search({ query: 'cancel fan-out query' }, controller.signal),
    (error) => error.code === 'WEB_ABORTED',
  );
});

test('QualityEngine returns merged sources when rerank hits the internal deadline', async () => {
  const controller = new AbortController();
  const quality = makeEngine({
    providers: {
      keenable: fakeProvider({
        sources: [
          { url: 'https://k1.example/', title: 'K1' },
          { url: 'https://k2.example/', title: 'K2' },
        ],
        truncated: false,
      }),
    },
    reranker: {
      rerankScored: async () => {
        controller.abort(new DOMException('search budget expired', 'TimeoutError'));
        throw webError('rerank aborted', 'WEB_ABORTED');
      },
    },
  });
  const outcome = await quality.search({ query: 'budget burn query' }, controller.signal);
  assert.equal(outcome.sources.length, 2);
  assert.deepEqual(
    outcome.sources.map((source) => source.url).sort(),
    ['https://k1.example/', 'https://k2.example/'],
  );
});

test('QualityEngine keeps the original candidates when embeddings hits the internal deadline', async () => {
  const controller = new AbortController();
  const quality = makeEngine({
    providers: {
      keenable: fakeProvider({
        sources: [
          { url: 'https://k1.example/', title: 'K1' },
          { url: 'https://k2.example/', title: 'K2' },
        ],
        truncated: false,
      }),
    },
    embeddings: {
      dedupe: async () => {
        controller.abort(new DOMException('search budget expired', 'TimeoutError'));
        throw webError('embeddings aborted', 'WEB_ABORTED');
      },
    },
  });
  const outcome = await quality.search({ query: 'dedupe budget query' }, controller.signal);
  assert.deepEqual(
    outcome.sources.map((source) => source.url).sort(),
    ['https://k1.example/', 'https://k2.example/'],
  );
});

test('QualityEngine returns merged sources when the internal deadline fires during an official-docs supplement', async () => {
  const controller = new AbortController();
  const quality = makeEngine({
    providers: {
      keenable: fakeProvider({
        sources: [{ url: 'https://stackoverflow.com/questions/1', title: 'fs.promises usage' }],
        truncated: false,
      }),
      tavily: {
        available: () => true,
        ready: async () => true,
        searchWithDomains: async () => {
          controller.abort(new DOMException('search budget expired', 'TimeoutError'));
          throw webError('official docs aborted', 'WEB_ABORTED');
        },
      },
    },
    overrides: { officialDocsEnabled: true },
    // A real reranker over the already-expired budget would also abort; it must
    // degrade too, so the whole search stays usable.
    reranker: {
      rerankScored: async () => {
        throw webError('rerank aborted', 'WEB_ABORTED');
      },
    },
  });
  const outcome = await quality.search(
    { query: 'node.js fs promises', maxResults: 10 },
    controller.signal,
  );
  assert.ok(
    outcome.sources.some((source) => source.url === 'https://stackoverflow.com/questions/1'),
  );
});

test('QualityEngine rethrows caller cancellation at rerank instead of degrading', async () => {
  const controller = new AbortController();
  const quality = makeEngine({
    providers: {
      keenable: fakeProvider({
        sources: [{ url: 'https://k1.example/', title: 'K1' }],
        truncated: false,
      }),
    },
    reranker: {
      rerankScored: async () => {
        controller.abort(new DOMException('caller cancelled', 'AbortError'));
        throw webError('rerank aborted', 'WEB_ABORTED');
      },
    },
  });
  await assert.rejects(
    () => quality.search({ query: 'cancel query' }, controller.signal),
    (error) => error.code === 'WEB_ABORTED',
  );
});

test('QualityEngine rethrows caller cancellation during an official-docs supplement', async () => {
  const controller = new AbortController();
  const quality = makeEngine({
    providers: {
      keenable: fakeProvider({
        sources: [{ url: 'https://stackoverflow.com/questions/1', title: 'fs.promises usage' }],
        truncated: false,
      }),
      tavily: {
        available: () => true,
        ready: async () => true,
        searchWithDomains: async () => {
          controller.abort(new DOMException('caller cancelled', 'AbortError'));
          throw webError('official docs aborted', 'WEB_ABORTED');
        },
      },
    },
    overrides: { officialDocsEnabled: true },
  });
  await assert.rejects(
    () => quality.search({ query: 'node.js fs promises' }, controller.signal),
    (error) => error.code === 'WEB_ABORTED',
  );
});

test('QualityEngine returns merged sources when the internal deadline fires during a news supplement', async () => {
  const controller = new AbortController();
  const quality = makeEngine({
    providers: {
      keenable: fakeProvider({
        sources: [
          { url: 'https://www.sohu.com/a/free', title: '旧闻', publishedAt: '2020-01-01T00:00:00Z' },
        ],
        truncated: false,
      }),
      tavily: {
        available: () => true,
        ready: async () => true,
        search: async () => {
          controller.abort(new DOMException('search budget expired', 'TimeoutError'));
          throw webError('news supplement aborted', 'WEB_ABORTED');
        },
      },
    },
  });
  const outcome = await quality.search(
    { query: '2026年11月 行业新闻', maxResults: 10 },
    controller.signal,
  );
  assert.ok(
    outcome.sources.some((source) => source.url === 'https://www.sohu.com/a/free'),
  );
});

test('QualityEngine rethrows caller cancellation during a news supplement', async () => {
  const controller = new AbortController();
  const quality = makeEngine({
    providers: {
      keenable: fakeProvider({
        sources: [
          { url: 'https://www.sohu.com/a/free', title: '旧闻', publishedAt: '2020-01-01T00:00:00Z' },
        ],
        truncated: false,
      }),
      tavily: {
        available: () => true,
        ready: async () => true,
        search: async () => {
          controller.abort(new DOMException('caller cancelled', 'AbortError'));
          throw webError('news supplement aborted', 'WEB_ABORTED');
        },
      },
    },
  });
  await assert.rejects(
    () => quality.search({ query: '2026年11月 行业新闻' }, controller.signal),
    (error) => error.code === 'WEB_ABORTED',
  );
});
