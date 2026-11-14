/** SiliconFlow reranker used by quality search mode. */

import { joinURL, requestJSON, isHTTPURL } from './http.js';

export class SiliconFlowReranker {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  available() {
    const config = this.settings().siliconflow;
    return config.enabled === true && isHTTPURL(config.baseURL);
  }

  async ready() {
    const config = this.settings().siliconflow;
    return (await this.resolveKey(config.apiKeyEnv)) !== undefined;
  }

  /**
   * Reorder sources by relevance. Returns the original list when reranking is
   * unavailable or fails, so quality mode degrades to provider-priority order.
   */
  async rerank(query, sources, topN, signal) {
    const settings = this.settings();
    const config = settings.siliconflow;
    if (!config.enabled || !isHTTPURL(config.baseURL) || sources.length === 0) return sources;
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    if (apiKey === undefined) return sources;

    const documents = sources.map((source) => {
      const title = typeof source.title === 'string' ? source.title : '';
      const excerpt = source.summary ?? source.snippet ?? '';
      return `${title}\n${excerpt}\n${source.url}`.trim();
    });

    try {
      const { data } = await requestJSON(joinURL(config.baseURL, '/rerank'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: {
          model: config.model,
          query,
          documents,
          top_n: Math.min(Math.max(topN, 1), sources.length),
          return_documents: false,
        },
        signal,
        timeoutMs: settings.requestTimeoutMs,
        provider: 'SiliconFlow',
        operation: 'rerank',
      });
      const results = Array.isArray(data?.results) ? data.results : [];
      const ordered = [];
      const used = new Set();
      for (const result of results) {
        const index = result?.index;
        if (!Number.isInteger(index) || sources[index] === undefined || used.has(index)) continue;
        used.add(index);
        ordered.push(sources[index]);
      }
      for (let index = 0; index < sources.length; index += 1) {
        if (!used.has(index)) ordered.push(sources[index]);
      }
      return ordered;
    } catch {
      return sources;
    }
  }
}
