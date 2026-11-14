/** Ordered fallback router registered as the single `auto` provider. */

import { errorMessage, isAbortLike, webError } from '../errors.js';
import { hasHan } from '../text.js';
import { providerSettings } from '../settings.js';

function candidates(settings, order, providers, capability) {
  const result = [];
  for (const name of order) {
    const provider = providers[name];
    if (provider === undefined || typeof provider[capability] !== 'function') continue;
    const config = providerSettings(settings, name);
    if (config === undefined || config.enabled !== true) continue;
    result.push({ name, provider });
  }
  return result;
}

function searchOrders(settings) {
  return [...new Set([...settings.chineseSearchOrder, ...settings.defaultSearchOrder])];
}

/** Fallback search provider. */
export class AutoSearchProvider {
  constructor({ settings, providers }) {
    this.settings = settings;
    this.providers = providers;
  }

  get id() {
    return 'auto';
  }

  get title() {
    return '自动路由';
  }

  get description() {
    return {
      en: 'Chooses Zhihu for Chinese queries, AnySearch/Tavily for others, and falls back on failure.',
      zh: '中文查询优先知乎，其他查询优先 AnySearch/Tavily，失败时自动回退。',
    };
  }

  available() {
    const settings = this.settings();
    return candidates(settings, searchOrders(settings), this.providers, 'search').some(({ provider }) =>
      provider.available(),
    );
  }

  async ready() {
    const settings = this.settings();
    for (const { provider } of candidates(settings, searchOrders(settings), this.providers, 'search')) {
      try {
        if (await provider.ready()) return true;
      } catch {
        // Keep checking the remaining providers.
      }
    }
    return false;
  }

  async search(request, signal) {
    if (signal?.aborted === true) throw webError('Web search aborted', 'WEB_ABORTED', { cause: signal.reason });
    const settings = this.settings();
    const order = hasHan(request.query) ? settings.chineseSearchOrder : settings.defaultSearchOrder;
    const attempts = [];
    let eligible = 0;
    for (const { name, provider } of candidates(settings, order, this.providers, 'search')) {
      if (!provider.available()) {
        attempts.push(`${name}: unavailable`);
        continue;
      }
      try {
        if (!(await provider.ready())) {
          attempts.push(`${name}: credential missing`);
          continue;
        }
      } catch {
        attempts.push(`${name}: readiness check failed`);
        continue;
      }
      eligible += 1;
      try {
        return await provider.search(request, signal);
      } catch (error) {
        if (isAbortLike(error)) throw error;
        attempts.push(`${name}: ${errorMessage(error)}`);
      }
    }
    throw webError(
      `All search providers failed (${attempts.length > 0 ? attempts.join('; ') : 'no providers configured'})`,
      eligible === 0 ? 'WEB_PROVIDER_UNAVAILABLE' : 'WEB_PROVIDER_ERROR',
    );
  }
}

/** Fallback fetch provider. */
export class AutoFetchProvider {
  constructor({ settings, providers }) {
    this.settings = settings;
    this.providers = providers;
  }

  get id() {
    return 'auto';
  }

  get title() {
    return '自动路由';
  }

  get description() {
    return {
      en: 'Tries direct HTTP first, then Tavily, Firecrawl, and AnySearch Extract on failure.',
      zh: '先直连 HTTP，失败后依次尝试 Tavily、Firecrawl 与 AnySearch Extract。',
    };
  }

  available() {
    const settings = this.settings();
    return candidates(settings, settings.fetchOrder, this.providers, 'fetch').some(({ provider }) =>
      provider.available(),
    );
  }

  async ready() {
    const settings = this.settings();
    for (const { provider } of candidates(settings, settings.fetchOrder, this.providers, 'fetch')) {
      try {
        if (await provider.ready()) return true;
      } catch {
        // Keep checking the remaining providers.
      }
    }
    return false;
  }

  async fetch(request, signal) {
    if (signal?.aborted === true) throw webError('Web fetch aborted', 'WEB_ABORTED', { cause: signal.reason });
    const settings = this.settings();
    const attempts = [];
    let eligible = 0;
    for (const { name, provider } of candidates(settings, settings.fetchOrder, this.providers, 'fetch')) {
      if (!provider.available()) {
        attempts.push(`${name}: unavailable`);
        continue;
      }
      try {
        if (!(await provider.ready())) {
          attempts.push(`${name}: credential missing`);
          continue;
        }
      } catch {
        attempts.push(`${name}: readiness check failed`);
        continue;
      }
      eligible += 1;
      try {
        return await provider.fetch(request, signal);
      } catch (error) {
        if (isAbortLike(error)) throw error;
        attempts.push(`${name}: ${errorMessage(error)}`);
      }
    }
    throw webError(
      `All fetch providers failed (${attempts.length > 0 ? attempts.join('; ') : 'no providers configured'})`,
      eligible === 0 ? 'WEB_PROVIDER_UNAVAILABLE' : 'WEB_PROVIDER_ERROR',
    );
  }
}
