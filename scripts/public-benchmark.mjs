import { readFile, writeFile } from 'node:fs/promises';
import { AnySearchProvider } from '../lib/providers/anysearch.js';
import { KeenableProvider } from '../lib/providers/keenable.js';
import { ExaProvider } from '../lib/providers/exa.js';
import { TavilyProvider } from '../lib/providers/tavily.js';
import { FirecrawlProvider } from '../lib/providers/firecrawl.js';
import { ZhihuProvider, ZhihuSiteProvider } from '../lib/providers/zhihu.js';
import { AihotProvider } from '../lib/providers/aihot.js';
import { HttpFetchProvider } from '../lib/providers/http.js';
import { AutoFetchProvider, AutoSearchProvider } from '../lib/providers/router.js';
import { SiliconFlowReranker } from '../lib/rerank.js';
import { SiliconFlowEmbeddings } from '../lib/embeddings.js';
import { resolveSettings } from '../lib/settings.js';
import { deepseekAuthHeaders } from './benchmark-auth.mjs';

const keys = {
  ANYSEARCH_API_KEY: process.env.AS_KEY,
  TAVILY_API_KEY: process.env.TV_KEY,
  FIRECRAWL_API_KEY: process.env.FC_KEY,
  ZHIHU_API_KEY: process.env.ZH_KEY,
  SILICONFLOW_API_KEY: process.env.SF_KEY,
  KEENABLE_API_KEY: process.env.KN_KEY ?? process.env.KEENABLE_API_KEY,
  EXA_API_KEY: process.env.EXA_KEY ?? process.env.EXA_API_KEY,
};
const deepseekToken = process.env.DS_TOKEN;
const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE ?? 50);
const PREFLIGHT = process.argv.includes('--preflight');
const ENRICH = process.env.BENCHMARK_ENRICH === '1';

// Start from the real defaults, then make the benchmark's scope explicit:
// search-only by default; BENCHMARK_ENRICH=1 opts into evidence enrichment.
const settings = {
  ...resolveSettings(),
  searchMode: 'quality',
  fetchMode: 'clean',
  enrichEnabled: ENRICH,
  searchCacheTtlMs: 0,
  searchCacheMaxEntries: 0,
  fetchCacheTtlMs: 0,
  fetchCacheMaxEntries: 0,
};

const resolveKey = async (reference) => keys[reference];
const providers = {
  anysearch: new AnySearchProvider({ settings: () => settings, resolveKey }),
  keenable: new KeenableProvider({ settings: () => settings, resolveKey }),
  exa: new ExaProvider({ settings: () => settings, resolveKey }),
  tavily: new TavilyProvider({ settings: () => settings, resolveKey }),
  firecrawl: new FirecrawlProvider({ settings: () => settings, resolveKey }),
  zhihu: new ZhihuProvider({ settings: () => settings, resolveKey }),
  'zhihu-site': new ZhihuSiteProvider({ settings: () => settings, resolveKey }),
  aihot: new AihotProvider({ settings: () => settings }),
  http: new HttpFetchProvider({ settings: () => settings }),
};
const reranker = new SiliconFlowReranker({ settings: () => settings, resolveKey });
const embeddings = new SiliconFlowEmbeddings({ settings: () => settings, resolveKey });
const autoFetch = new AutoFetchProvider({ settings: () => settings, providers });
const autoSearch = new AutoSearchProvider({
  settings: () => settings,
  providers,
  reranker,
  embeddings,
  fetcher: {
    fetch: (request, signal) => autoFetch.fetch(request, signal, { order: settings.fetchOrder }),
  },
});

function clipQuery(question) {
  return Array.from(String(question)).slice(0, 128).join('');
}

function normalizeUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    return decodeURIComponent(parsed.toString())
      .toLowerCase()
      .replace(/^https?:\/\//u, '')
      .replace(/^www\./u, '')
      .replace(/\/$/u, '');
  } catch {
    return String(value).toLowerCase().replace(/\/$/u, '');
  }
}

function answerText(answer) {
  return String(answer ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function sourceText(source) {
  return `${source.title ?? ''} ${source.snippet ?? ''} ${source.summary ?? ''}`.toLowerCase();
}

function scoreResult(sources, goldUrls, answer) {
  const normalizedGold = [...new Set(goldUrls.map(normalizeUrl))];
  const normalizedSources = sources.map((source) => normalizeUrl(source.url));
  const firstGoldRank = normalizedGold.reduce((best, gold) => {
    const index = normalizedSources.indexOf(gold);
    return index === -1 ? best : best === -1 ? index : Math.min(best, index);
  }, -1);
  const matched = normalizedGold.filter((gold) => normalizedSources.includes(gold));
  const answerNeedle = answerText(answer);
  const answerHit =
    answerNeedle.length >= 2 &&
    !answerNeedle.includes('person_') &&
    sources.some((source) => answerText(sourceText(source)).includes(answerNeedle));
  return {
    count: sources.length,
    evidenceRecall: matched.length > 0 ? 1 : 0,
    allEvidenceRecall: normalizedGold.length > 0 && matched.length === normalizedGold.length ? 1 : 0,
    mrr: firstGoldRank === -1 ? 0 : 1 / (firstGoldRank + 1),
    answerHit: answerHit ? 1 : 0,
    top1Gold: normalizedGold.includes(normalizedSources[0]),
  };
}

async function loadRows(dataset, config, split, count) {
  // shortcut: fixture pins the 50-row sample; regenerate when the benchmark changes.
  const fixtureUrl = new URL('./fixtures/public-benchmark-sample.json', import.meta.url);
  let fixture = {};
  try {
    fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  } catch {
    // Fall back to the public rows API.
  }
  const key = `${dataset}|${config}|${split}`;
  if (Array.isArray(fixture[key]) && fixture[key].length >= count) {
    return fixture[key].slice(0, count);
  }
  const rows = [];
  for (let offset = 0; offset < count; offset += 100) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${Math.min(100, count - offset)}`;
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
        const text = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
        const data = JSON.parse(text);
        if (!Array.isArray(data.rows)) throw new Error(`no rows: ${text.slice(0, 160)}`);
        rows.push(...data.rows.map((entry) => entry.row));
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    if (lastError !== undefined) throw lastError;
  }
  return rows;
}

function goldUrlsFromFrames(row) {
  const raw = typeof row.wiki_links === 'string' ? row.wiki_links : '';
  return [...raw.matchAll(/https?:\/\/[^'"\],\s]+/gu)].map((match) => match[0]);
}

function goldUrlsFromWebWalker(row) {
  return Array.isArray(row.info?.source_website) ? row.info.source_website : [];
}

async function deepseekSearch(query) {
  // Accept both DSH account tokens and DeepSeek API keys (sk-...).
  const authHeaders = deepseekAuthHeaders(deepseekToken);
  const response = await fetch('https://api.deepseek.com/v1/tools/search', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ query, count: 10, need_content: false, ori_question: query }),
    signal: AbortSignal.timeout(60_000),
    redirect: 'error',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`DeepSeek search HTTP ${response.status}: ${text.slice(0, 180)}`);
  const data = JSON.parse(text);
  return (Array.isArray(data.results) ? data.results : []).map((item) => ({
    url: item.url,
    title: item.title,
    snippet: item.snippet,
    summary: item.summary,
  }));
}

async function oursSearch(query) {
  const result = await autoSearch.search({ query, maxResults: 10 });
  return result.sources;
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

async function preflight() {
  const checks = [];
  const record = async (name, check, required = false) => {
    try {
      const detail = await check();
      checks.push({ name, ok: true, required, detail: String(detail ?? 'ok') });
    } catch (error) {
      checks.push({ name, ok: false, required, detail: errorText(error) });
    }
  };

  for (const [name, provider] of Object.entries(providers)) {
    if (typeof provider.search === 'function') {
      await record(`${name}:search`, async () => {
        if (!provider.available()) throw new Error('unavailable');
        if (!(await provider.ready())) throw new Error('credential missing');
        const result = await provider.search({ query: 'DeepSeek Harness', maxResults: 2 });
        return `${result.sources.length} sources`;
      });
    }
    if (typeof provider.fetch === 'function') {
      await record(`${name}:fetch`, async () => {
        if (!provider.available()) throw new Error('unavailable');
        if (!(await provider.ready())) throw new Error('credential missing');
        const result = await provider.fetch({ url: 'https://example.com' });
        return `${result.body.content.length} chars`;
      });
    }
  }

  await record('siliconflow:rerank', async () => {
    if (!reranker.available()) throw new Error('unavailable');
    if (!(await reranker.ready())) throw new Error('credential missing');
    const result = await reranker.rerankScored('DeepSeek Harness', [
      { url: 'https://example.com', title: 'Example', summary: 'DeepSeek Harness' },
    ]);
    return Array.isArray(result) ? 'ok' : 'no result';
  }, true);
  await record('siliconflow:embeddings', async () => {
    if (!embeddings.available()) throw new Error('unavailable');
    if (!(await embeddings.ready())) throw new Error('credential missing');
    const result = await embeddings.embed(['DeepSeek Harness']);
    return Array.isArray(result) ? 'ok' : 'no result';
  }, true);
  await record('deepseek:search', async () => {
    const results = await deepseekSearch('DeepSeek Harness');
    return `${results.length} results`;
  }, true);

  for (const check of checks) {
    const status = check.ok ? 'PASS' : check.required ? 'FAIL' : 'WARN';
    console.log(`${status} ${check.name}: ${check.detail}`);
  }
  const hardFailure = checks.some((check) => !check.ok && check.required);
  const searchPasses = checks.filter((check) => check.name.endsWith(':search') && check.ok).length;
  if (hardFailure || searchPasses < 2) {
    console.error(`preflight failed: required checks failed or only ${searchPasses} search providers passed`);
    return false;
  }
  return true;
}

if (PREFLIGHT) {
  const ok = await preflight();
  process.exit(ok ? 0 : 1);
}

async function evaluateDataset(name, rows, getQuestion, getGoldUrls, getAnswer) {
  const details = [];
  const aggregate = {
    ours: { evidenceRecall: 0, allEvidenceRecall: 0, mrr: 0, answerHit: 0, top1Gold: 0 },
    deepseek: { evidenceRecall: 0, allEvidenceRecall: 0, mrr: 0, answerHit: 0, top1Gold: 0 },
  };
  let completed = 0;
  let oursErrors = 0;
  let deepseekErrors = 0;
  let oursEmpty = 0;
  let deepseekEmpty = 0;
  for (const row of rows.slice(0, SAMPLE_SIZE)) {
    const question = clipQuery(getQuestion(row));
    const goldUrls = getGoldUrls(row);
    const answer = getAnswer(row);
    const oursResult = await oursSearch(question)
      .then((value) => ({ value }))
      .catch((error) => ({ error }));
    const deepseekResult = await deepseekSearch(question)
      .then((value) => ({ value }))
      .catch((error) => ({ error }));
    if (oursResult.error !== undefined) oursErrors += 1;
    if (deepseekResult.error !== undefined) deepseekErrors += 1;
    const ours = oursResult.value ?? [];
    const deepseek = deepseekResult.value ?? [];
    if (ours.length === 0) oursEmpty += 1;
    if (deepseek.length === 0) deepseekEmpty += 1;
    const oursScore = scoreResult(ours, goldUrls, answer);
    const deepseekScore = scoreResult(deepseek, goldUrls, answer);
    for (const key of Object.keys(aggregate.ours)) {
      aggregate.ours[key] += oursScore[key];
      aggregate.deepseek[key] += deepseekScore[key];
    }
    details.push({ question, goldUrls, answer, ours: oursScore, deepseek: deepseekScore });
    completed += 1;
    if (completed % 5 === 0) console.log(`${name}: ${completed}/${Math.min(SAMPLE_SIZE, rows.length)}`);
  }
  if (details.length > 0 && oursErrors === details.length) {
    throw new Error(`${name}: every plugin search failed; run pnpm benchmark:preflight`);
  }
  if (details.length > 0 && deepseekErrors === details.length) {
    throw new Error(`${name}: every DeepSeek search failed; check DS_TOKEN`);
  }
  if (oursErrors > 0 || deepseekErrors > 0) {
    console.warn(
      `${name}: provider errors ours=${oursErrors} deepseek=${deepseekErrors}; empty ours=${oursEmpty} deepseek=${deepseekEmpty}`,
    );
  }
  const n = Math.max(details.length, 1);
  for (const key of Object.keys(aggregate.ours)) {
    aggregate.ours[key] = Math.round((aggregate.ours[key] / n) * 1000) / 1000;
    aggregate.deepseek[key] = Math.round((aggregate.deepseek[key] / n) * 1000) / 1000;
  }
  return {
    name,
    sampleSize: details.length,
    aggregate,
    errors: { ours: oursErrors, deepseek: deepseekErrors },
    empty: { ours: oursEmpty, deepseek: deepseekEmpty },
    details,
  };
}

const framesRows = await loadRows('google/frames-benchmark', 'default', 'test', SAMPLE_SIZE);
const webwalkerRows = await loadRows('callanwu/WebWalkerQA', 'default', 'main', SAMPLE_SIZE);

const results = {
  generatedAt: new Date().toISOString(),
  sampleSize: SAMPLE_SIZE,
  frames: await evaluateDataset(
    'FRAMES',
    framesRows,
    (row) => row.Prompt,
    goldUrlsFromFrames,
    (row) => row.Answer,
  ),
  webwalker: await evaluateDataset(
    'WebWalkerQA',
    webwalkerRows,
    (row) => row.question,
    goldUrlsFromWebWalker,
    (row) => row.answer,
  ),
};

await writeFile('.research/public-benchmark.json', JSON.stringify(results, null, 2), 'utf8');
console.log(JSON.stringify({
  sampleSize: results.sampleSize,
  frames: {
    sampleSize: results.frames.sampleSize,
    aggregate: results.frames.aggregate,
    errors: results.frames.errors,
    empty: results.frames.empty,
  },
  webwalker: {
    sampleSize: results.webwalker.sampleSize,
    aggregate: results.webwalker.aggregate,
    errors: results.webwalker.errors,
    empty: results.webwalker.empty,
  },
}, null, 2));
