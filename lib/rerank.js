/** SiliconFlow reranker used by quality search mode. */

import { isAbortLike } from './errors.js';
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
   * Score every source by relevance. Returns `undefined` when reranking is
   * unavailable or fails, so quality mode degrades to provider-priority order.
   */
  async rerankScored(query, sources, signal) {
    const settings = this.settings();
    const config = settings.siliconflow;
    if (!config.enabled || !isHTTPURL(config.baseURL) || sources.length === 0) return undefined;
    const apiKey = await this.resolveKey(config.apiKeyEnv);
    if (apiKey === undefined) return undefined;

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
          top_n: sources.length,
          return_documents: false,
        },
        signal,
        timeoutMs: settings.requestTimeoutMs,
        provider: 'SiliconFlow',
        operation: 'rerank',
      });
      const results = Array.isArray(data?.results) ? data.results : [];
      const byIndex = new Map();
      results.forEach((result, rank) => {
        const index = result?.index;
        if (!Number.isInteger(index) || sources[index] === undefined) return;
        const score = typeof result.relevance_score === 'number' ? result.relevance_score : 0;
        byIndex.set(index, { score, rank });
      });
      return sources.map((source, index) => ({
        source,
        score: byIndex.get(index)?.score ?? 0,
        rank: byIndex.get(index)?.rank ?? index,
        index,
      }));
    } catch (error) {
      if (isAbortLike(error)) throw error;
      return undefined;
    }
  }
}
