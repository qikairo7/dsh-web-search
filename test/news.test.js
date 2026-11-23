import test from 'node:test';
import assert from 'node:assert/strict';

import { filterNewsLanguage, newsBoostValue } from '../lib/news.js';
import { sortByAuthority } from '../lib/authority.js';

test('mainstream Chinese news gets a larger boost', () => {
  assert.equal(newsBoostValue('https://www.sohu.com/a/1', 'zh'), 0.5);
  assert.equal(newsBoostValue('https://www.163.com/dy/article/1.html', 'zh'), 0.5);
  assert.equal(newsBoostValue('https://www.thepaper.cn/newsDetail_1', 'zh'), 0.5);
  assert.equal(newsBoostValue('https://www.chinanews.com.cn/1', 'zh'), 0.5);
  assert.equal(newsBoostValue('https://www.ithome.com/1', 'zh'), 0.12);
  assert.equal(newsBoostValue('https://www.reuters.com/technology/', 'en'), 0.12);
  assert.equal(newsBoostValue('https://www.sohu.com/a/1', 'en'), 0);
});

test('mainstream Chinese news ranks above other Chinese news at equal scores', () => {
  const sorted = sortByAuthority(
    [
      { source: { url: 'https://www.ithome.com/1' }, score: 0.5, index: 0 },
      { source: { url: 'https://www.sohu.com/a/1' }, score: 0.5, index: 1 },
      { source: { url: 'https://www.thepaper.cn/newsDetail_1' }, score: 0.5, index: 2 },
      { source: { url: 'https://www.163.com/dy/article/1.html' }, score: 0.5, index: 3 },
      { source: { url: 'https://www.chinanews.com.cn/1' }, score: 0.5, index: 4 },
    ],
    { news: true, language: 'zh' },
  );
  assert.deepEqual(
    sorted.map((entry) => entry.source.url),
    [
      'https://www.sohu.com/a/1',
      'https://www.thepaper.cn/newsDetail_1',
      'https://www.163.com/dy/article/1.html',
      'https://www.chinanews.com.cn/1',
      'https://www.ithome.com/1',
    ],
  );
});

test('filterNewsLanguage removes wrong-language news sources and titles', () => {
  const sources = [
    { url: 'https://www.sohu.com/a/1', title: '中文新闻' },
    { url: 'https://www.reuters.com/technology/', title: 'English news' },
    { url: 'https://example.com/article', title: 'English article' },
    { url: 'https://example.com/zh', title: '中文文章' },
  ];
  assert.deepEqual(
    filterNewsLanguage(sources, 'zh').map((source) => source.url),
    ['https://www.sohu.com/a/1', 'https://example.com/zh'],
  );
  assert.deepEqual(filterNewsLanguage(sources, undefined), sources);
});
