#!/usr/bin/env node
/** Live free-backend quality probe: 14 daily queries, no DeepSeek paid APIs. */

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

const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/u).filter(Boolean).map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));
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
const settings = { ...resolveSettings(), searchCacheTtlMs: 0, searchCacheMaxEntries: 0, enrichEnabled: false };
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
const fetcher = new AutoFetchProvider({ settings: () => settings, providers });
const search = new AutoSearchProvider({
  settings: () => settings,
  providers,
  reranker: new SiliconFlowReranker({ settings: () => settings, resolveKey }),
  embeddings: new SiliconFlowEmbeddings({ settings: () => settings, resolveKey }),
  fetcher,
});

const queries = [
  { id: 'zh-tech', query: 'DeepSeek Harness 插件开发', gold: /deepseek-harness\.github\.io\/deepseek-harness\/(develop|reference)|github\.com\/deepseek-ai\/deepseek-harness\/(blob|tree)\/master\/docs/ },
  { id: 'zh-community', query: '如何评价 DeepSeek Harness', gold: /zhihu\.com\/question|github\.com\/deepseek-ai\/deepseek-harness\/discussions|woshipm\.com|163\.com|aliyun\.com/ },
  { id: 'zh-news', query: '2026年11月 AI 行业新闻', gold: /sohu\.com|163\.com|ithome\.com|news\.qq\.com|sina\.com\.cn|ainews\./ },
  { id: 'zh-policy', query: '城市暴雨积水 安全出行 官方指南', gold: /\.gov\.cn\// },
  { id: 'zh-general', query: '2026年适合买什么电动车', gold: /163\.com|sohu\.com|zol\.com\.cn|autohome\.com|pcauto\.com\.cn|yoojia\.com/ },
  { id: 'weather', query: '上海明天天气', gold: /weather\.com\.cn|nmc\.cn|qweather\.com|weather\.cma\.cn|tianqi\.|weathernews|moji\.com|open-meteo\.com/ },
  { id: 'fx', query: '人民币兑美元汇率 今日', gold: /chinamoney\.com\.cn|pbc\.gov\.cn|finance\.sina\.com\.cn|eastmoney\.com|wise\.com|yicai\.com|cgbchina\.com|exchangerate-api\.com/ },
  { id: 'en-tech', query: 'Node.js fetch AbortSignal timeout', gold: /developer\.mozilla\.org\/en-US\/docs\/Web\/API\/AbortSignal|nodejs\.org\/api\/(globals|util)/ },
  { id: 'react-docs', query: 'React useEffect cleanup function', gold: /react\.dev\/reference\/react\/useEffect/ },
  { id: 'en-news', query: 'AI industry news November 2026', gold: /techcrunch\.com|theverge\.com|reuters\.com|techrepublic\.com|aimagazine\.com/ },
  { id: 'en-general', query: 'best budget laptop 2026', gold: /pcmag\.com|wired\.com|rtings\.com|cnet\.com|techradar\.com/ },
  { id: 'navigational', query: 'deepseek-ai deepseek-harness GitHub', gold: /github\.com\/deepseek-ai\/deepseek-harness/ },
  { id: 'niche-api', query: 'dsh plugin bundle patch cordis', gold: /deepseek-harness\.github\.io|dshpluginhub\.ai|github\.com\/deepseek-ai\/deepseek-harness\/(blob|tree)\/master\/docs/ },
  { id: 'code', query: 'TypeScript satisfies operator example', gold: /typescriptlang\.org\/docs\/handbook\/release-notes\/typescript-4-9/ },
];

function metrics(result, gold) {
  const sources = result.sources ?? [];
  return {
    count: sources.length,
    top3: sources.slice(0, 3).map((source) => ({ title: source.title ?? '', url: source.url })),
    goldTop3: sources.slice(0, 3).some((source) => gold.test(source.url ?? '')),
    goldTop10: sources.slice(0, 10).some((source) => gold.test(source.url ?? '')),
    domains: new Set(sources.slice(0, 10).map((source) => { try { return new URL(source.url).hostname; } catch { return ''; } }).filter(Boolean)).size,
    avgSummary: sources.length > 0 ? Math.round(sources.reduce((sum, source) => sum + String(source.summary ?? source.snippet ?? '').length, 0) / sources.length) : 0,
    dated: sources.slice(0, 10).filter((source) => source.publishedAt).length,
  };
}

const rows = [];
for (const item of queries) {
  const started = Date.now();
  try {
    const result = await search.search({ query: item.query, maxResults: 10 });
    rows.push({ id: item.id, query: item.query, ms: Date.now() - started, ok: true, ...metrics(result, item.gold) });
  } catch (error) {
    rows.push({ id: item.id, query: item.query, ms: Date.now() - started, ok: false, error: error.message });
  }
}
const ok = rows.filter((row) => row.ok);
const summary = {
  sampleSize: rows.length,
  success: ok.length + '/' + rows.length,
  avgMs: Math.round(ok.reduce((sum, row) => sum + row.ms, 0) / Math.max(ok.length, 1)),
  goldTop3: ok.filter((row) => row.goldTop3).length,
  goldTop10: ok.filter((row) => row.goldTop10).length,
  avgDomains: Math.round(ok.reduce((sum, row) => sum + row.domains, 0) / Math.max(ok.length, 1) * 10) / 10,
  avgSummary: Math.round(ok.reduce((sum, row) => sum + row.avgSummary, 0) / Math.max(ok.length, 1)),
  dated: ok.reduce((sum, row) => sum + row.dated, 0),
};
const output = { generatedAt: new Date().toISOString(), summary, rows };
await writeFile('.research/quality-probe.json', JSON.stringify(output, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 2));
