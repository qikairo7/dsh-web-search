import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyIntent, fastOrder, qualityPair } from '../lib/intent.js';

test('classifies technical, news and Chinese community queries', () => {
  assert.equal(classifyIntent('DeepSeek Harness 插件开发'), 'technical');
  assert.equal(classifyIntent('2026年11月 AI 行业新闻'), 'news');
  assert.equal(classifyIntent('怎么评价 DeepSeek Harness 这个工具'), 'chinese-community');
});

test('chooses two-provider quality pairs', () => {
  assert.deepEqual(qualityPair('DeepSeek Harness 插件开发', 'technical'), [
    'anysearch',
    'zhihu',
    'tavily',
  ]);
  assert.deepEqual(qualityPair('2026年11月 AI 行业新闻', 'news'), [
    'aihot',
    'tavily',
    'anysearch',
  ]);
  assert.deepEqual(qualityPair('2026年11月 行业新闻', 'news'), [
    'zhihu',
    'tavily',
    'anysearch',
  ]);
  assert.deepEqual(qualityPair('Node.js fetch timeout', 'technical'), [
    'anysearch',
    'tavily',
    'zhihu',
  ]);
  assert.deepEqual(qualityPair('latest AI news', 'news'), ['aihot', 'tavily', 'anysearch']);
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
    'tavily',
    'anysearch',
    'firecrawl',
  ]);
  assert.deepEqual(fastOrder('2026年11月 行业新闻', settings, 'news'), [
    'zhihu',
    'tavily',
    'anysearch',
    'firecrawl',
  ]);
  assert.deepEqual(
    fastOrder('DeepSeek 插件开发', { ...settings, intentRouting: false }, 'technical'),
    settings.chineseSearchOrder,
  );
});
