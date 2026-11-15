import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { classifyIntent, fastOrder, qualityPair } from '../lib/intent.js';
import { PROVIDER_CATALOG, paidSearchFallback } from '../lib/catalog.js';

test('classifies technical, news and Chinese community queries', () => {
  assert.equal(classifyIntent('DeepSeek Harness 插件开发'), 'technical');
  assert.equal(classifyIntent('2026年11月 AI 行业新闻'), 'news');
  assert.equal(classifyIntent('怎么评价 DeepSeek Harness 这个工具'), 'chinese-community');
  assert.equal(classifyIntent(`${new Date().getFullYear()} 行业盘点`), 'news');
  assert.equal(classifyIntent(`${new Date().getFullYear() - 1} 行业盘点`), 'news');
});

test('rebuilds the news year list after the year rolls over', () => {
  const nextYear = new Date().getFullYear() + 1;
  mock.timers.enable({ now: Date.UTC(nextYear, 0, 1) });
  try {
    assert.equal(classifyIntent(`${nextYear} conference schedule`), 'news');
  } finally {
    mock.timers.reset();
  }
});

test('chooses free-provider quality pairs', () => {
  assert.deepEqual(qualityPair('DeepSeek Harness 插件开发', 'technical'), ['zhihu', 'keenable', 'anysearch']);
  assert.deepEqual(qualityPair('2026年11月 AI 行业新闻', 'news'), ['aihot', 'keenable', 'anysearch', 'zhihu']);
  assert.deepEqual(qualityPair('2026年11月 行业新闻', 'news'), ['zhihu', 'keenable', 'anysearch']);
  assert.deepEqual(qualityPair('Node.js fetch timeout', 'technical'), ['keenable', 'anysearch', 'zhihu']);
  assert.deepEqual(qualityPair('latest AI news', 'news'), ['aihot', 'keenable', 'anysearch', 'zhihu']);
});

test('fast order applies intent routing only when enabled', () => {
  const settings = {
    intentRouting: true,
    chineseSearchOrder: ['zhihu', 'anysearch', 'tavily', 'firecrawl'],
    defaultSearchOrder: ['anysearch', 'tavily', 'zhihu', 'firecrawl'],
  };
  assert.deepEqual(fastOrder('2026年11月 AI 行业新闻', settings, 'news'), [
    'aihot',
    'zhihu',
    'keenable',
    'anysearch',
    'exa',
    'tavily',
    'firecrawl',
  ]);
  assert.deepEqual(fastOrder('2026年11月 行业新闻', settings, 'news'), [
    'zhihu',
    'keenable',
    'anysearch',
    'exa',
    'tavily',
    'firecrawl',
  ]);
  assert.deepEqual(
    fastOrder('DeepSeek 插件开发', { ...settings, intentRouting: false }, 'technical'),
    settings.chineseSearchOrder,
  );
});

test('fast orders end with the paid fallback and quality pairs stay free', () => {
  const paidTail = paidSearchFallback();
  const settings = {
    intentRouting: true,
    chineseSearchOrder: ['zhihu', 'keenable', 'anysearch', ...paidTail],
    defaultSearchOrder: ['keenable', 'anysearch', 'zhihu', ...paidTail],
  };
  const queries = [
    '2026年11月 AI 行业新闻',
    '2026年11月 行业新闻',
    'DeepSeek 插件开发',
    '红烧肉做法',
    'latest AI news',
    'latest industry news',
    'Node.js fetch timeout',
    'best hiking trails',
  ];
  for (const query of queries) {
    const intent = classifyIntent(query);
    for (const routing of [settings, { ...settings, intentRouting: false }]) {
      const order = fastOrder(query, routing, intent);
      assert.deepEqual(order.slice(-paidTail.length), paidTail, `${query} paid tail`);
      for (const id of order.slice(0, -paidTail.length)) {
        assert.equal(
          PROVIDER_CATALOG.find((provider) => provider.id === id).tier,
          'free',
          `${query} keeps ${id} before the paid tail`,
        );
      }
    }
    const pair = qualityPair(query, intent);
    for (const id of pair) {
      assert.equal(
        PROVIDER_CATALOG.find((provider) => provider.id === id).tier,
        'free',
        `${query} quality pair keeps ${id} free`,
      );
    }
  }
});
