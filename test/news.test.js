import test from 'node:test';
import assert from 'node:assert/strict';

import { filterNewsLanguage, isNewsDomain, newsBoostValue } from '../lib/news.js';

test('recognizes language-specific Chinese and English news domains', () => {
  assert.equal(isNewsDomain('https://www.sohu.com/a/1100338793_121732504', 'zh'), true);
  assert.equal(isNewsDomain('https://www.sohu.com/a/1100338793_121732504', 'en'), false);
  assert.equal(isNewsDomain('https://www.163.com/dy/article/LBC1C14J0534A4SC.html', 'zh'), true);
  assert.equal(isNewsDomain('https://www.reuters.com/technology/', 'en'), true);
  assert.equal(isNewsDomain('https://www.reuters.com/technology/', 'zh'), false);
  assert.equal(isNewsDomain('https://example.com/news', 'zh'), false);
});

test('mainstream Chinese news gets a larger boost', () => {
  assert.equal(newsBoostValue('https://www.sohu.com/a/1', 'zh'), 0.2);
  assert.equal(newsBoostValue('https://www.ithome.com/1', 'zh'), 0.12);
  assert.equal(newsBoostValue('https://www.reuters.com/technology/', 'en'), 0.12);
  assert.equal(newsBoostValue('https://www.sohu.com/a/1', 'en'), 0);
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
});
