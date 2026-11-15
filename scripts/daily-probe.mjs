#!/usr/bin/env node
/**
 * Daily live probe: fixed queries against every backend through the real
 * router, with per-provider telemetry, list-health signals, a rolling 7-day
 * aggregate, and PASS/FAIL verdicts. This is the project's daily live
 * evidence; the FRAMES/WebWalkerQA benchmark stays reserved for releases.
 *
 * Thresholds and signals are owned by docs/testing.md.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
import { classifyIntent } from '../lib/intent.js';
import { newsDomainLanguage } from '../lib/news.js';
import { officialDomainsForQuery } from '../lib/officialDocs.js';
import { hostMatchesDomain } from '../lib/host.js';

const PROBE_DIR = '.research/daily-probe';
const HISTORY_DAYS = 7;

/** Local calendar date (YYYY-MM-DD), so the file name matches the runner's day. */
function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const FULL = process.argv.includes('--full');

const env = Object.fromEntries(
  (await readFile('.env', 'utf8')).split(/\r?\n/u).filter(Boolean).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }),
);
const keys = {
  ANYSEARCH_API_KEY: env.AS_KEY ?? env.ANYSEARCH_API_KEY,
  KEENABLE_API_KEY: env.KEENABLE_API_KEY,
  EXA_API_KEY: env.EXA_API_KEY,
  TAVILY_API_KEY: env.TV_KEY ?? env.TAVILY_API_KEY,
  FIRECRAWL_API_KEY: env.FC_KEY ?? env.FIRECRAWL_API_KEY,
  ZHIHU_API_KEY: env.ZH_KEY ?? env.ZHIHU_API_KEY,
  SILICONFLOW_API_KEY: env.SF_KEY ?? env.SILICONFLOW_API_KEY,
};
const resolveKey = async (reference) => keys[reference];
const settings = {
  ...resolveSettings(),
  searchCacheTtlMs: 0,
  searchCacheMaxEntries: 0,
  fetchCacheTtlMs: 0,
  fetchCacheMaxEntries: 0,
  enrichEnabled: false,
};

function instrument(providers) {
  const telemetry = {};
  for (const [name, provider] of Object.entries(providers)) {
    telemetry[name] = { calls: 0, errors: 0, totalMs: 0, results: 0 };
    if (typeof provider.search !== 'function') continue;
    const original = provider.search.bind(provider);
    provider.search = async (...args) => {
      const started = Date.now();
      telemetry[name].calls += 1;
      try {
        const result = await original(...args);
        telemetry[name].totalMs += Date.now() - started;
        telemetry[name].results += result?.sources?.length ?? 0;
        return result;
      } catch (error) {
        telemetry[name].errors += 1;
        telemetry[name].totalMs += Date.now() - started;
        throw error;
      }
    };
  }
  return telemetry;
}

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
const telemetry = instrument(providers);
const fetcher = new AutoFetchProvider({ settings: () => settings, providers });
const search = new AutoSearchProvider({
  settings: () => settings,
  providers,
  reranker: new SiliconFlowReranker({ settings: () => settings, resolveKey }),
  embeddings: new SiliconFlowEmbeddings({ settings: () => settings, resolveKey }),
  fetcher,
});

// Fixed query set: every routing lane, with the gold regexes the quality
// probes have used since 2026-11-14 so history stays comparable.
const QUERIES = [
  { id: 'zh-tech', query: 'DeepSeek Harness 插件开发', gold: /deepseek-harness\.github\.io\/deepseek-harness\/(develop|reference)|github\.com\/deepseek-ai\/deepseek-harness\/(blob|tree)\/master\/docs/ },
  { id: 'zh-community', query: '如何评价 DeepSeek Harness', gold: /zhihu\.com\/question|github\.com\/deepseek-ai\/deepseek-harness\/discussions|woshipm\.com|163\.com|aliyun\.com/ },
  { id: 'zh-news', query: '2026年11月 AI 行业新闻', gold: /sohu\.com|163\.com|ithome\.com|news\.qq\.com|sina\.com\.cn|ainews\./, news: true },
  { id: 'zh-policy', query: '城市暴雨积水 安全出行 官方指南', gold: /\.gov\.cn\// },
  { id: 'zh-general', query: '2026年适合买什么电动车', gold: /163\.com|sohu\.com|zol\.com\.cn|autohome\.com|pcauto\.com\.cn|yoojia\.com/ },
  { id: 'weather', query: '上海明天天气', gold: /weather\.com\.cn|nmc\.cn|qweather\.com|weather\.cma\.cn|tianqi\.|weathernews|moji\.com|open-meteo\.com/ },
  { id: 'fx', query: '人民币兑美元汇率 今日', gold: /chinamoney\.com\.cn|pbc\.gov\.cn|finance\.sina\.com\.cn|eastmoney\.com|wise\.com|yicai\.com|cgbchina\.com|exchangerate-api\.com/ },
  { id: 'en-tech', query: 'Node.js fetch AbortSignal timeout', gold: /developer\.mozilla\.org\/en-US\/docs\/Web\/API\/AbortSignal|nodejs\.org\/api\/(globals|util)/ },
  { id: 'react-docs', query: 'React useEffect cleanup function', gold: /react\.dev\/reference\/react\/useEffect/ },
  { id: 'en-news', query: 'AI industry news November 2026', gold: /techcrunch\.com|theverge\.com|reuters\.com|techrepublic\.com|aimagazine\.com/, news: true },
  { id: 'en-general', query: 'best budget laptop 2026', gold: /pcmag\.com|wired\.com|rtings\.com|cnet\.com|techradar\.com/ },
  { id: 'navigational', query: 'deepseek-ai deepseek-harness GitHub', gold: /github\.com\/deepseek-ai\/deepseek-harness/ },
  { id: 'niche-api', query: 'dsh plugin bundle patch cordis', gold: /deepseek-harness\.github\.io|dshpluginhub\.ai|github\.com\/deepseek-ai\/deepseek-harness\/(blob|tree)\/master\/docs/ },
  { id: 'code', query: 'TypeScript satisfies operator example', gold: /typescriptlang\.org\/docs\/handbook\/release-notes\/typescript-4-9/ },
];

const FETCH_URLS = [
  { id: 'react-learn', url: 'https://react.dev/learn' },
  { id: 'example', url: 'https://example.com' },
];

/**
 * `--full` direct-checks every backend, including the ones the routed probe
 * never reaches on a healthy day (exa, tavily, firecrawl, zhihu-site, http).
 * Costs a handful of paid credits per run; meant for weekly or on-suspicion
 * use, not the daily schedule.
 */
async function directCheck(name, capability, request) {
  const provider = providers[name];
  const started = Date.now();
  const base = { name, capability, ms: Date.now() - started };
  try {
    if (provider?.available !== undefined && !provider.available()) {
      return { ...base, ms: Date.now() - started, skipped: 'unavailable' };
    }
    if (typeof provider?.ready === 'function' && !(await provider.ready())) {
      return { ...base, ms: Date.now() - started, skipped: 'not ready' };
    }
    const result = await provider[capability](request);
    return {
      ...base,
      ms: Date.now() - started,
      ok: true,
      count: result?.sources?.length ?? result?.body?.content?.length ?? 0,
    };
  } catch (error) {
    return { ...base, ms: Date.now() - started, ok: false, error: error.message };
  }
}

const directChecks = [];
if (FULL) {
  for (const name of ['keenable', 'anysearch', 'zhihu', 'zhihu-site', 'aihot', 'exa', 'tavily', 'firecrawl']) {
    directChecks.push(await directCheck(name, 'search', { query: 'DeepSeek Harness 插件', maxResults: 3 }));
    console.error(`${name}: direct search done`);
  }
  for (const name of ['http', 'anysearch', 'exa', 'tavily', 'firecrawl']) {
    directChecks.push(await directCheck(name, 'fetch', { url: 'https://example.com' }));
    console.error(`${name}: direct fetch done`);
  }
}

function searchMetrics(result, item) {
  const sources = result.sources ?? [];
  const domains = officialDomainsForQuery(item.query);
  return {
    count: sources.length,
    goldTop3: sources.slice(0, 3).some((source) => item.gold.test(source.url ?? '')),
    goldTop10: sources.slice(0, 10).some((source) => item.gold.test(source.url ?? '')),
    dated: sources.slice(0, 10).filter((source) => source.publishedAt).length,
    knownNewsShare:
      item.news === true && sources.length > 0
        ? Math.round(
            (sources.slice(0, 10).filter((source) => newsDomainLanguage(source.url) !== undefined).length /
              Math.min(sources.length, 10)) *
              100,
          ) / 100
        : undefined,
    officialHit:
      domains.length > 0
        ? sources.slice(0, 10).some((source) => domains.some((domain) => hostMatchesDomain(source.url, domain)))
        : undefined,
  };
}

const rows = [];
for (const item of QUERIES) {
  const started = Date.now();
  const intent = classifyIntent(item.query);
  try {
    const result = await search.search({ query: item.query, maxResults: 10 });
    rows.push({ id: item.id, intent, ms: Date.now() - started, ok: true, ...searchMetrics(result, item) });
  } catch (error) {
    rows.push({ id: item.id, intent, ms: Date.now() - started, ok: false, error: error.message });
  }
  console.error(`${item.id}: done`);
}

const fetches = [];
for (const item of FETCH_URLS) {
  const started = Date.now();
  try {
    const result = await fetcher.fetch({ url: item.url });
    const chars = result?.body?.content?.length ?? 0;
    fetches.push({ id: item.id, ms: Date.now() - started, ok: true, chars });
  } catch (error) {
    fetches.push({ id: item.id, ms: Date.now() - started, ok: false, error: error.message });
  }
  console.error(`${item.id}: fetch done`);
}

function share(rowsSubset, key) {
  const values = rowsSubset.filter((row) => row[key] !== undefined);
  if (values.length === 0) return undefined;
  return Math.round((values.filter((row) => row[key]).length / values.length) * 100) / 100;
}

const okRows = rows.filter((row) => row.ok);
const newsRows = okRows.filter((row) => row.news === true || ['zh-news', 'en-news'].includes(row.id));
const officialRows = okRows.filter((row) => row.officialHit !== undefined);
const providerHealth = Object.fromEntries(
  Object.entries(telemetry).map(([name, stats]) => [
    name,
    {
      ...stats,
      avgMs: stats.calls > 0 ? Math.round(stats.totalMs / stats.calls) : 0,
      dead: stats.calls > 0 && stats.errors === stats.calls,
    },
  ]),
);

const summary = {
  date: localDate(),
  search: {
    success: `${okRows.length}/${rows.length}`,
    goldTop3: okRows.filter((row) => row.goldTop3).length,
    goldTop10: okRows.filter((row) => row.goldTop10).length,
    avgMs: Math.round(okRows.reduce((sum, row) => sum + row.ms, 0) / Math.max(okRows.length, 1)),
    datedTotal: okRows.reduce((sum, row) => sum + row.dated, 0),
  },
  listHealth: {
    knownNewsShare: share(newsRows, 'knownNewsShare'),
    officialHitShare: share(officialRows, 'officialHit'),
  },
  fetch: {
    success: `${fetches.filter((row) => row.ok).length}/${fetches.length}`,
    avgMs: Math.round(
      fetches.reduce((sum, row) => sum + row.ms, 0) / Math.max(fetches.length, 1),
    ),
  },
};

const verdicts = {
  searchPass: okRows.length >= 13 && okRows.filter((row) => row.goldTop10).length >= 12,
  fetchPass: fetches.filter((row) => row.ok).length >= 1,
  noDeadProvider: Object.values(providerHealth).every((stats) => !stats.dead),
  ...(FULL
    ? {
        fullPass: directChecks.every(
          (check) => check.skipped !== undefined || check.ok === true,
        ),
      }
    : {}),
};
const warns = [];
if (summary.listHealth.knownNewsShare !== undefined && summary.listHealth.knownNewsShare < 0.3) {
  warns.push('knownNewsShare below 0.3: refresh the news domain lists in lib/news.js');
}
if (summary.listHealth.officialHitShare !== undefined && summary.listHealth.officialHitShare < 0.6) {
  warns.push('officialHitShare below 0.6: check the official-domain rules in lib/officialDocs.js');
}

async function rollingAggregate(today, todaySummary) {
  let names = [];
  try {
    names = (await readdir(PROBE_DIR)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/u.test(name)).sort();
  } catch {
    return { days: 1 };
  }
  const recent = names.slice(-(HISTORY_DAYS - 1));
  const summaries = [];
  for (const name of recent) {
    try {
      summaries.push(JSON.parse(await readFile(join(PROBE_DIR, name), 'utf8')).summary);
    } catch {
      // Skip unreadable history entries.
    }
  }
  const pool = [...summaries, todaySummary];
  const median = (values) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : undefined;
  };
  return {
    days: pool.length,
    goldTop10Median: median(pool.map((entry) => entry.search?.goldTop10)),
    avgMsMedian: median(pool.map((entry) => entry.search?.avgMs)),
    knownNewsShareMedian: median(pool.map((entry) => entry.listHealth?.knownNewsShare)),
  };
}

await mkdir(PROBE_DIR, { recursive: true });
const rolling = await rollingAggregate(summary.date, summary);
await writeFile(join(PROBE_DIR, `${summary.date}.json`), JSON.stringify({ summary, verdicts, warns, rolling, providerHealth, rows, fetches, directChecks }, null, 2), 'utf8');

const pass = verdicts.searchPass && verdicts.fetchPass && verdicts.noDeadProvider && (FULL ? verdicts.fullPass : true);
console.log(JSON.stringify({ summary, verdicts, warns, rolling }, null, 2));
if (!pass) {
  console.error('PROBE FAIL');
  process.exitCode = 1;
} else {
  console.error('PROBE PASS');
}
