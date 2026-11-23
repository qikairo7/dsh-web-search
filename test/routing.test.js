import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRouting, routingFacts } from '../lib/routing.js';

test('resolveRouting returns the annotated facts unchanged', () => {
  const routing = { intent: 'news', syntax: { site: 'example.com' }, language: 'zh' };
  const facts = resolveRouting({ query: 'ignored lang:en 中文查询', routing }, { languageRouting: true });
  assert.deepEqual(facts, { intent: 'news', syntax: { site: 'example.com' }, language: 'zh' });
});

test('resolveRouting derives each missing field from the query', () => {
  const facts = resolveRouting({ query: 'DeepSeek 插件 site:github.com 2026 最新' }, { languageRouting: true });
  assert.equal(facts.intent, 'news');
  assert.equal(facts.syntax.site, 'github.com');
  assert.equal(facts.language, 'zh');
});

test('resolveRouting gives the lang: operator priority over detection and the kill-switch', () => {
  assert.equal(resolveRouting({ query: 'lang:zh english query' }, { languageRouting: true }).language, 'zh');
  assert.equal(resolveRouting({ query: 'lang:zh english query' }, { languageRouting: false }).language, 'zh');
  assert.equal(resolveRouting({ query: 'lang:zh,en english query' }, {}).language, 'zh');
});

test('resolveRouting drops the detected language when languageRouting is off', () => {
  const facts = resolveRouting({ query: '中文查询' }, { languageRouting: false });
  assert.equal(facts.language, undefined);
  assert.equal(resolveRouting({ query: '中文查询' }, { languageRouting: true }).language, 'zh');
});

test('resolveRouting derives language from the annotated syntax before parsing the query', () => {
  const facts = resolveRouting({ query: 'english query', routing: { syntax: { lang: 'zh' } } }, {});
  assert.equal(facts.language, 'zh');
});

test('routingFacts keeps the router annotation shape', () => {
  const facts = routingFacts('quiet topic lorem', { languageRouting: true }, 'general');
  assert.deepEqual(facts, {
    intent: 'general',
    language: 'en',
    syntax: { site: undefined, lang: undefined, after: undefined, before: undefined },
  });
});
