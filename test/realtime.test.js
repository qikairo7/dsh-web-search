import test from 'node:test';
import assert from 'node:assert/strict';

import { parseWeatherQuery, parseFxQuery, realtimeSearch } from '../lib/realtime.js';

test('parses weather city and day offsets', () => {
  assert.deepEqual(parseWeatherQuery('上海明天天气'), { city: '上海', dayOffset: 1 });
  assert.deepEqual(parseWeatherQuery('北京后天天气预报'), { city: '北京', dayOffset: 2 });
  assert.equal(parseWeatherQuery('城市暴雨积水 安全出行 官方指南'), undefined);
});

test('parses currency pairs in both directions', () => {
  assert.deepEqual(parseFxQuery('人民币兑美元汇率 今日'), { base: 'CNY', target: 'USD' });
  assert.deepEqual(parseFxQuery('美元兑人民币汇率'), { base: 'USD', target: 'CNY' });
  assert.deepEqual(parseFxQuery('USD/CNY exchange rate'), { base: 'USD', target: 'CNY' });
});

test('realtimeSearch returns live weather with a dated summary', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('geocoding-api')) {
      return new Response(JSON.stringify({ results: [{ name: '上海', latitude: 31.2, longitude: 121.4, timezone: 'Asia/Shanghai' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ daily: { time: ['2026-11-15', '2026-11-16'], temperature_2m_max: [20, 18], temperature_2m_min: [12, 11], precipitation_probability_max: [10, 20], weathercode: [1, 3] } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await realtimeSearch('上海明天天气', { requestTimeoutMs: 5_000 }, undefined);
    assert.ok(result);
    assert.equal(result.sources.length, 1);
    assert.match(result.sources[0].summary, /上海 2026-11-16/);
    assert.match(result.sources[0].summary, /11~18°C/);
    assert.ok(result.sources[0].publishedAt);
  } finally {
    globalThis.fetch = original;
  }
});

test('realtimeSearch returns live FX with a dated summary', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    result: 'success',
    time_last_update_utc: 'Sat, 14 Nov 2026 00:02:31 +0000',
    rates: { USD: 0.14959 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const result = await realtimeSearch('人民币兑美元汇率 今日', { requestTimeoutMs: 5_000 }, undefined);
    assert.ok(result);
    assert.match(result.sources[0].summary, /1 CNY = 0\.14959 USD/);
    assert.equal(result.sources[0].publishedAt, '2026-11-14T00:02:31.000Z');
  } finally {
    globalThis.fetch = original;
  }
});
