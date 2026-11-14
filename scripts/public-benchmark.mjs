import { readFile, writeFile } from 'node:fs/promises';
import { AnySearchProvider } from '../lib/providers/anysearch.js';
import { TavilyProvider } from '../lib/providers/tavily.js';
import { FirecrawlProvider } from '../lib/providers/firecrawl.js';
import { ZhihuProvider, ZhihuSiteProvider } from '../lib/providers/zhihu.js';
import { AihotProvider } from '../lib/providers/aihot.js';
import { HttpFetchProvider } from '../lib/providers/http.js';
import { AutoFetchProvider, AutoSearchProvider } from '../lib/providers/router.js';
import { SiliconFlowReranker } from '../lib/rerank.js';
import { SiliconFlowEmbeddings } from '../lib/embeddings.js';

const keys = {
  ANYSEARCH_API_KEY: process.env.AS_KEY,
  TAVILY_API_KEY: process.env.TV_KEY,
  FIRECRAWL_API_KEY: process.env.FC_KEY,
  ZHIHU_API_KEY: process.env.ZH_KEY,
  SILICONFLOW_API_KEY: process.env.SF_KEY,
};
const deepseekToken = process.env.DS_TOKEN;
const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE ?? 30);

const settings = {
  searchMode: 'quality',
  fetchMode: 'clean',
  intentRouting: true,
  languageRouting: true,
  officialDocsEnabled: true,
  chineseSearchOrder: ['zhihu', 'anysearch', 'tavily', 'firecrawl'],
  defaultSearchOrder: ['anysearch', 'tavily', 'zhihu', 'firecrawl'],
  fetchOrder: ['http', 'tavily', 'firecrawl', 'anysearch'],
  cleanFetchOrder: ['tavily', 'firecrawl', 'http', 'anysearch'],
  anysearch: { enabled: true, apiKeyEnv: 'ANYSEARCH_API_KEY', baseURL: 'https://api.anysearch.com' },
  tavily: { enabled: true, apiKeyEnv: 'TAVILY_API_KEY', baseURL: 'https://api.tavily.com', includeAnswer: true },
  firecrawl: { enabled: true, apiKeyEnv: 'FIRECRAWL_API_KEY', baseURL: 'https://api.firecrawl.dev' },
  zhihu: { enabled: true, apiKeyEnv: 'ZHIHU_API_KEY', baseURL: 'https://developer.zhihu.com', includeMetadata: true },
  aihot: { enabled: true, baseURL: 'https://aihot.news' },
  http: { enabled: true },
  siliconflow: {
    enabled: true,
    apiKeyEnv: 'SILICONFLOW_API_KEY',
    baseURL: 'https://api.siliconflow.cn/v1',
    model: 'BAAI/bge-reranker-v2-m3',
    embeddingsEnabled: true,
    embeddingModel: 'BAAI/bge-m3',
  },
  requestTimeoutMs: 30_000,
  maxFetchChars: 200_000,
  maxSnippetChars: 4_000,
  minDirectHtmlChars: 2_048,
  searchCacheTtlMs: 0,
  searchCacheMaxEntries: 0,
  fetchCacheTtlMs: 0,
  fetchCacheMaxEntries: 0,
  breakerFailureThreshold: 3,
  breakerCooldownMs: 300_000,
  semanticDedupThreshold: 0.95,
};

const resolveKey = async (reference) => keys[reference];
const providers = {
  anysearch: new AnySearchProvider({ settings: () => settings, resolveKey }),
  tavily: new TavilyProvider({ settings: () => settings, resolveKey }),
  firecrawl: new FirecrawlProvider({ settings: () => settings, resolveKey }),
  zhihu: new ZhihuProvider({ settings: () => settings, resolveKey }),
  'zhihu-site': new ZhihuSiteProvider({ settings: () => settings, resolveKey }),
  aihot: new AihotProvider({ settings: () => settings }),
  http: new HttpFetchProvider({ settings: () => settings }),
};
const reranker = new SiliconFlowReranker({ settings: () => settings, resolveKey });
const embeddings = new SiliconFlowEmbeddings({ settings: () => settings, resolveKey });
const enrichmentFetch = new AutoFetchProvider({
  settings: () => ({ ...settings, fetchMode: 'fast' }),
  providers,
});
const autoSearch = new AutoSearchProvider({
  settings: () => settings,
  providers,
  reranker,
  embeddings,
  fetcher: enrichmentFetch,
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
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
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
  const response = await fetch('https://api.deepseek.com/v1/tools/search', {
    method: 'POST',
    headers: { 'x-dsh-auth-token': deepseekToken, 'content-type': 'application/json' },
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

async function evaluateDataset(name, rows, getQuestion, getGoldUrls, getAnswer) {
  const details = [];
  const aggregate = {
    ours: { evidenceRecall: 0, allEvidenceRecall: 0, mrr: 0, answerHit: 0, top1Gold: 0 },
    deepseek: { evidenceRecall: 0, allEvidenceRecall: 0, mrr: 0, answerHit: 0, top1Gold: 0 },
  };
  let completed = 0;
  for (const row of rows.slice(0, SAMPLE_SIZE)) {
    const question = clipQuery(getQuestion(row));
    const goldUrls = getGoldUrls(row);
    const answer = getAnswer(row);
    const ours = await oursSearch(question).catch(() => []);
    const deepseek = await deepseekSearch(question).catch(() => []);
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
  const n = Math.max(details.length, 1);
  for (const key of Object.keys(aggregate.ours)) {
    aggregate.ours[key] = Math.round((aggregate.ours[key] / n) * 1000) / 1000;
    aggregate.deepseek[key] = Math.round((aggregate.deepseek[key] / n) * 1000) / 1000;
  }
  return { name, sampleSize: details.length, aggregate, details };
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
  frames: { sampleSize: results.frames.sampleSize, aggregate: results.frames.aggregate },
  webwalker: { sampleSize: results.webwalker.sampleSize, aggregate: results.webwalker.aggregate },
}, null, 2));
