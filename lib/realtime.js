/** Free live-data providers for weather and currency-rate queries. */

import { requestJSON } from './http.js';
import { webError } from './errors.js';

const WEATHER_PATTERN = /(天气|气温|温度|降雨|下雨|降雪|天气预报|weather|temperature|forecast)/iu;
const FX_PATTERN = /(汇率|汇价|兑换|兑美元|兑人民币|exchange rate|forex|usd\/cny|cny\/usd|美元.*人民币|人民币.*美元)/iu;

const CURRENCIES = [
  { code: 'CNY', pattern: /人民币|\bCNY\b|\bRMB\b/iu },
  { code: 'USD', pattern: /美元|美金|\bUSD\b/iu },
  { code: 'EUR', pattern: /欧元|\bEUR\b/iu },
  { code: 'JPY', pattern: /日元|\bJPY\b/iu },
  { code: 'GBP', pattern: /英镑|\bGBP\b/iu },
  { code: 'HKD', pattern: /港币|港元|\bHKD\b/iu },
  { code: 'KRW', pattern: /韩元|\bKRW\b/iu },
  { code: 'AUD', pattern: /澳元|\bAUD\b/iu },
  { code: 'CAD', pattern: /加元|\bCAD\b/iu },
  { code: 'SGD', pattern: /新加坡元|\bSGD\b/iu },
  { code: 'TWD', pattern: /台币|新台币|\bTWD\b/iu },
  { code: 'CHF', pattern: /瑞士法郎|\bCHF\b/iu },
  { code: 'RUB', pattern: /卢布|\bRUB\b/iu },
  { code: 'INR', pattern: /印度卢比|\bINR\b/iu },
];

const WEATHER_CODES = new Map([
  [0, '晴'], [1, '大部晴朗'], [2, '多云'], [3, '阴天'],
  [45, '雾'], [48, '雾凇'],
  [51, '轻度毛毛雨'], [53, '毛毛雨'], [55, '强毛毛雨'], [56, '轻度冻毛毛雨'], [57, '冻毛毛雨'],
  [61, '小雨'], [63, '中雨'], [65, '大雨'], [66, '轻度冻雨'], [67, '冻雨'],
  [71, '小雪'], [73, '中雪'], [75, '大雪'], [77, '雪粒'],
  [80, '小阵雨'], [81, '中阵雨'], [82, '强阵雨'], [85, '小阵雪'], [86, '强阵雪'],
  [95, '雷暴'], [96, '雷暴伴小冰雹'], [99, '雷暴伴大冰雹'],
]);

/** Parse a weather query into city and day offset (0 today, 1 tomorrow, 2 day after). */
export function parseWeatherQuery(query) {
  if (!WEATHER_PATTERN.test(query)) return undefined;
  let city = String(query)
    .replace(/(今天|明天|后天|今日|明日|本周|周末|现在|上午|下午|晚上|夜间)/gu, ' ')
    .replace(/(天气预报|天气|气温|温度|降雨|下雨|降雪|预报|查询|怎么样|如何)/gu, ' ')
    .replace(/\b(?:weather|forecast|today|tomorrow|temperature|in|at|for)\b/giu, ' ')
    .replace(/[，,。?？!！]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (city.length === 0) return undefined;
  const dayOffset = /(后天|day after tomorrow)/iu.test(query) ? 2 : /(明天|tomorrow)/iu.test(query) ? 1 : 0;
  return { city, dayOffset };
}

/** Parse a currency query into base and target ISO codes. */
export function parseFxQuery(query) {
  if (!FX_PATTERN.test(query)) return undefined;
  const lower = String(query).toLowerCase();
  const found = [];
  for (const currency of CURRENCIES) {
    const match = lower.match(currency.pattern);
    if (match !== null && match.index !== undefined) found.push({ code: currency.code, index: match.index });
  }
  found.sort((a, b) => a.index - b.index);
  const unique = [...new Map(found.map((item) => [item.code, item])).values()];
  if (unique.length >= 2) return { base: unique[0].code, target: unique[1].code };
  if (unique.length === 1) return { base: unique[0].code, target: unique[0].code === 'CNY' ? 'USD' : 'CNY' };
  return undefined;
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
}

function weatherText(code) {
  return WEATHER_CODES.get(code) ?? '天气状况未知';
}

async function weatherSearch(query, settings, signal) {
  const parsed = parseWeatherQuery(query);
  if (parsed === undefined) return undefined;
  const geo = await requestJSON(
    'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(parsed.city) + '&count=1&language=zh&format=json',
    { method: 'GET', redirect: 'follow', signal, timeoutMs: settings.requestTimeoutMs, provider: 'Open-Meteo', operation: 'geocode' },
  );
  const place = geo.data?.results?.[0];
  if (place === undefined) return undefined;
  const forecast = await requestJSON(
    'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(place.latitude) +
      '&longitude=' + encodeURIComponent(place.longitude) +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode' +
      '&timezone=' + encodeURIComponent(place.timezone || 'auto') + '&forecast_days=5',
    { method: 'GET', redirect: 'follow', signal, timeoutMs: settings.requestTimeoutMs, provider: 'Open-Meteo', operation: 'forecast' },
  );
  const daily = forecast.data?.daily;
  if (daily === undefined || !Array.isArray(daily.time) || daily.time.length === 0) return undefined;
  const index = Math.min(parsed.dayOffset, daily.time.length - 1);
  const date = daily.time[index];
  const summary = place.name + ' ' + date + ' 天气预报：' + weatherText(daily.weathercode?.[index]) +
    '，气温 ' + formatNumber(daily.temperature_2m_min?.[index]) + '~' + formatNumber(daily.temperature_2m_max?.[index]) +
    '°C，降水概率 ' + formatNumber(daily.precipitation_probability_max?.[index]) + '%。数据时间：' + new Date().toISOString() + '（Open-Meteo）';
  return {
    sources: [{
      url: 'https://open-meteo.com/',
      title: place.name + '天气预报（Open-Meteo）',
      snippet: summary,
      summary,
      publishedAt: new Date().toISOString(),
    }],
    truncated: false,
  };
}

async function fxSearch(query, settings, signal) {
  const parsed = parseFxQuery(query);
  if (parsed === undefined) return undefined;
  if (parsed.base === parsed.target) {
    const now = new Date().toISOString();
    const summary = '1 ' + parsed.base + ' = 1 ' + parsed.target + '；数据时间：' + now;
    return { sources: [{ url: 'https://www.exchangerate-api.com/', title: parsed.base + '→' + parsed.target + ' 汇率', summary, snippet: summary, publishedAt: now }], truncated: false };
  }
  let rate;
  let updated;
  let source = 'ExchangeRate-API';
  try {
    const live = await requestJSON('https://open.er-api.com/v6/latest/' + encodeURIComponent(parsed.base), {
      method: 'GET', redirect: 'follow', signal, timeoutMs: settings.requestTimeoutMs, provider: 'ExchangeRate-API', operation: 'rates',
    });
    rate = live.data?.rates?.[parsed.target];
    updated = live.data?.time_last_update_utc;
  } catch (error) {
    if (error?.code === 'WEB_ABORTED') throw error;
  }
  if (typeof rate !== 'number') {
    source = 'Frankfurter';
    const fallback = await requestJSON('https://api.frankfurter.app/latest?from=' + encodeURIComponent(parsed.base) + '&to=' + encodeURIComponent(parsed.target), {
      method: 'GET', redirect: 'follow', signal, timeoutMs: settings.requestTimeoutMs, provider: 'Frankfurter', operation: 'rates',
    });
    rate = fallback.data?.rates?.[parsed.target];
    updated = fallback.data?.date;
  }
  if (typeof rate !== 'number') return undefined;
  const stamp = updated === undefined ? Number.NaN : new Date(updated).getTime();
  const publishedAt = new Date(Number.isFinite(stamp) ? stamp : Date.now()).toISOString();
  const summary = '1 ' + parsed.base + ' = ' + rate + ' ' + parsed.target + '；数据时间：' + updated + '（' + source + '）';
  return {
    sources: [{
      url: source === 'Frankfurter' ? 'https://www.frankfurter.app/' : 'https://www.exchangerate-api.com/',
      title: parsed.base + '→' + parsed.target + ' 汇率（实时）',
      snippet: summary,
      summary,
      publishedAt,
    }],
    truncated: false,
  };
}

/** Return a live weather/FX result for recognized queries, or undefined to use normal search. */
export async function realtimeSearch(query, settings, signal) {
  if (signal?.aborted === true) throw webError('Web search aborted', 'WEB_ABORTED', { cause: signal.reason });
  try {
    if (WEATHER_PATTERN.test(query)) {
      const result = await weatherSearch(query, settings, signal);
      if (result !== undefined) return result;
    }
    if (FX_PATTERN.test(query)) {
      const result = await fxSearch(query, settings, signal);
      if (result !== undefined) return result;
    }
  } catch (error) {
    if (error?.code === 'WEB_ABORTED') throw error;
  }
  return undefined;
}
