import test from 'node:test';
import assert from 'node:assert/strict';

import { enrichSources } from '../lib/enrich.js';

/**
 * Enrichment settings without the bound keys, so every test that omits them
 * exercises the module-internal 800/1500 fallback instead of the spec's
 * resolveSettings() output, which always carries both keys.
 */
function settings(overrides = {}) {
  return { enrichEnabled: true, enrichTopN: 5, ...overrides };
}

/**
 * Plain prose that mentions the query terms and carries no technical marker.
 * Newlines split it into real sentences for the extractive summarizer; ASCII
 * periods do not (`.` is not a split delimiter in summarize.js).
 */
function prose(count) {
  return Array.from(
    { length: count },
    (_, index) => `The orbital station log entry number ${index} recorded the daily supply run.`,
  ).join('\n');
}

/** A recording fake fetcher that always returns the same page body. */
function pageFetcher(content, kind = 'text') {
  const calls = [];
  return {
    calls,
    fetch: async (request) => {
      calls.push(request.url);
      return { body: { kind, content } };
    },
  };
}

test('enrichSources returns the input unchanged when enrichEnabled is false', async () => {
  const sources = [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }];
  const fetcher = {
    fetch: async () => {
      throw new Error('disabled enrichment must not fetch');
    },
  };
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: { enrichEnabled: false },
    fetcher,
    signal: undefined,
  });
  assert.equal(outcome, sources);
});

test('enrichSources returns the input unchanged when fetcher is undefined', async () => {
  const sources = [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }];
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings(),
    fetcher: undefined,
    signal: undefined,
  });
  assert.equal(outcome, sources);
});

test('enrichSources falls back to the 800–1500 bound when both settings keys are missing', async () => {
  const sources = [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }];
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings(),
    fetcher: pageFetcher(prose(60)),
    signal: undefined,
  });
  assert.notEqual(outcome[0].summary, 'old');
  assert.ok(
    outcome[0].summary.length >= 800,
    `summary below the minimum bound: ${outcome[0].summary.length}`,
  );
  assert.ok(
    outcome[0].summary.length <= 1500,
    `summary above the maximum bound: ${outcome[0].summary.length}`,
  );
  assert.match(outcome[0].summary, /orbital station/u);
});

test('enrichSources stays bounded when settings only define enrichSummaryMinChars', async () => {
  const sources = [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }];
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings({ enrichSummaryMinChars: 900 }),
    fetcher: pageFetcher(prose(60)),
    signal: undefined,
  });
  assert.ok(
    outcome[0].summary.length >= 900,
    `summary below enrichSummaryMinChars: ${outcome[0].summary.length}`,
  );
  assert.ok(
    outcome[0].summary.length <= 1500,
    `summary above the fallback maximum: ${outcome[0].summary.length}`,
  );
});

test('enrichSources clamps enrichSummaryMinChars above enrichSummaryMaxChars', async () => {
  const sources = [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }];
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings({ enrichSummaryMinChars: 2000, enrichSummaryMaxChars: 1000 }),
    fetcher: pageFetcher(prose(60)),
    signal: undefined,
  });
  assert.notEqual(outcome[0].summary, 'old');
  assert.equal(outcome[0].summary.length, 2000);
});

test('enrichSources converts an html body to text before summarizing', async () => {
  const paragraphs = Array.from(
    { length: 12 },
    (_, index) => `<p>The orbital station log entry number ${index} recorded the daily supply run.</p>`,
  );
  const sources = [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }];
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings({ enrichSummaryMinChars: 200, enrichSummaryMaxChars: 500 }),
    fetcher: pageFetcher(`<html><body>${paragraphs.join('')}</body></html>`, 'html'),
    signal: undefined,
  });
  assert.ok(
    outcome[0].summary.length >= 200 && outcome[0].summary.length <= 500,
    `summary out of bounds: ${outcome[0].summary.length}`,
  );
  assert.doesNotMatch(outcome[0].summary, /<\/?(?:p|body|html)/iu);
  assert.match(outcome[0].summary, /orbital station/u);
});

test('enrichSources summarizes official-doc hosts block-wise and plain hosts sentence-wise', async () => {
  const filler = Array.from(
    { length: 8 },
    (_, index) => `Background paragraph ${index}. The crew rotated the greens and checked the water.`,
  );
  const code = Array.from(
    { length: 3 },
    (_, index) =>
      '```js\n' +
      `const slot = await station.orbit(${index + 1});\n` +
      `const next = await station.orbit(${index + 11});\n` +
      '```',
  );
  const content = [...filler, ...code].join('\n\n');
  const sources = [
    { url: 'https://docs.python.org/3/library/scheduling.html', title: 'Scheduling', summary: 'old' },
    { url: 'https://www.freshgreens.net/notes', title: 'Greenhouse notes', summary: 'old' },
  ];
  const outcome = await enrichSources({
    sources,
    query: 'station orbit schedule',
    settings: settings({ enrichTopN: 2, enrichSummaryMinChars: 200, enrichSummaryMaxChars: 500 }),
    fetcher: pageFetcher(content),
    signal: undefined,
  });
  const [technical, plain] = outcome;
  assert.notEqual(technical.summary, 'old');
  assert.match(technical.summary, /station\.orbit/u);
  assert.ok(technical.summary.includes('\n'), 'technical path must keep code-block line breaks');
  assert.ok(
    plain.summary.length >= 200 && plain.summary.length <= 500,
    `plain summary out of bounds: ${plain.summary.length}`,
  );
  assert.ok(!plain.summary.includes('\n'), 'sentence path must join with spaces, not newlines');
});

test('enrichSources keeps the original source when the fetcher throws', async () => {
  const sources = [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }];
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings(),
    fetcher: {
      fetch: async () => {
        throw new Error('connection reset');
      },
    },
    signal: undefined,
  });
  assert.equal(outcome[0], sources[0]);
});

test('enrichSources rethrows abort-like fetcher errors', async () => {
  const abortShapes = [
    Object.assign(new Error('caller aborted'), { name: 'AbortError' }),
    Object.assign(new Error('caller aborted'), { code: 'WEB_ABORTED' }),
  ];
  for (const error of abortShapes) {
    const sources = [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }];
    await assert.rejects(
      enrichSources({
        sources,
        query: 'orbital station',
        settings: settings(),
        fetcher: {
          fetch: async () => {
            throw error;
          },
        },
        signal: undefined,
      }),
      (thrown) => thrown === error,
    );
  }
});

test('enrichSources returns the input untouched for enrichTopN 0 without fetching', async () => {
  const sources = [
    { url: 'https://freshgreens.net/a', title: 'A', summary: 'old' },
    { url: 'https://freshgreens.net/b', title: 'B', summary: 'old' },
  ];
  const fetcher = pageFetcher(prose(60));
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings({ enrichTopN: 0 }),
    fetcher,
    signal: undefined,
  });
  assert.equal(outcome, sources);
  assert.equal(fetcher.calls.length, 0);
});

test('enrichSources enriches every source when enrichTopN exceeds the source count', async () => {
  const sources = ['a', 'b', 'c'].map(
    (slug) => ({ url: `https://freshgreens.net/${slug}`, title: `Log ${slug}`, summary: 'old' }),
  );
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings({ enrichTopN: 99 }),
    fetcher: pageFetcher(prose(60)),
    signal: undefined,
  });
  for (const source of outcome) {
    assert.notEqual(source.summary, 'old');
    assert.ok(
      source.summary.length >= 800 && source.summary.length <= 1500,
      `summary out of bounds: ${source.summary.length}`,
    );
  }
});

test('enrichSources leaves entries at or beyond enrichTopN untouched', async () => {
  const sources = ['a', 'b', 'c'].map(
    (slug) => ({ url: `https://freshgreens.net/${slug}`, title: `Log ${slug}`, summary: 'old' }),
  );
  const fetcher = pageFetcher(prose(60));
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings({ enrichTopN: 1 }),
    fetcher,
    signal: undefined,
  });
  assert.equal(fetcher.calls.length, 1);
  assert.notEqual(outcome[0].summary, 'old');
  assert.equal(outcome[1], sources[1]);
  assert.equal(outcome[2], sources[2]);
});

test('enrichSources keeps the original when fetched content is under 200 chars', async () => {
  const sources = [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }];
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings(),
    fetcher: pageFetcher('Orbital station log is empty today.'),
    signal: undefined,
  });
  assert.equal(outcome[0], sources[0]);
});

test('enrichSources rejects a candidate summary shorter than 200 chars', async () => {
  const sources = [{ url: 'https://freshgreens.net/log', title: 'Garden log', summary: 'old' }];
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings({ enrichSummaryMinChars: 1 }),
    fetcher: pageFetcher(prose(30)),
    signal: undefined,
  });
  assert.equal(outcome[0], sources[0]);
});

test('enrichSources keeps an original summary the candidate cannot beat', async () => {
  const longOriginal = 'Detailed provider summary. '.repeat(120);
  const sources = [
    { url: 'https://freshgreens.net/log', title: 'Garden log', summary: longOriginal },
  ];
  const outcome = await enrichSources({
    sources,
    query: 'orbital station',
    settings: settings(),
    fetcher: pageFetcher(prose(60)),
    signal: undefined,
  });
  assert.equal(outcome[0].summary, longOriginal);
});
