import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyIntent, fastOrder, qualityPair } from '../lib/intent.js';

test('classifies technical, news and Chinese community queries', () => {
  assert.equal(classifyIntent('DeepSeek Harness 插件开发'), 'technical');
  assert.equal(classifyIntent('2026年11月 AI 行业新闻'), 'news');
  assert.equal(classifyIntent('怎么评价 DeepSeek Harness 这个工具'), 'chinese-community');
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
