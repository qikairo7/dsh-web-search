/** SiliconFlow embeddings used for semantic duplicate removal. */

import { isAbortLike } from './errors.js';
import { joinURL, requestJSON, isHTTPURL } from './http.js';
import { resolveKeyCandidates, shouldRotateKey } from './keyring.js';

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export class SiliconFlowEmbeddings {
  constructor({ settings, resolveKey }) {
    this.settings = settings;
    this.resolveKey = resolveKey;
  }

  available() {
    const config = this.settings().siliconflow;
    return config.embeddingsEnabled === true && isHTTPURL(config.baseURL);
  }

  async ready() {
    const config = this.settings().siliconflow;
    return (await resolveKeyCandidates(this.resolveKey, config.apiKeyEnv)).length > 0;
  }

  /** Return one embedding vector per input, or undefined on any failure. */
  async embed(texts, signal) {
    const settings = this.settings();
    const config = settings.siliconflow;
    if (!config.embeddingsEnabled || !isHTTPURL(config.baseURL) || texts.length === 0) return undefined;
    const apiKeys = await resolveKeyCandidates(this.resolveKey, config.apiKeyEnv);
    if (apiKeys.length === 0) return undefined;
    for (const apiKey of apiKeys) {
      try {
        const { data } = await requestJSON(joinURL(config.baseURL, '/embeddings'), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: {
            model: config.embeddingModel,
            input: texts,
            encoding_format: 'float',
          },
          signal,
          timeoutMs: settings.requestTimeoutMs,
          provider: 'SiliconFlow',
          operation: 'embeddings',
        });
        const items = Array.isArray(data?.data) ? data.data : [];
        const vectors = [];
        for (let index = 0; index < texts.length; index += 1) {
          const item = items.find((entry) => entry?.index === index) ?? items[index];
          if (!Array.isArray(item?.embedding)) return undefined;
          vectors.push(item.embedding);
        }
        return vectors;
      } catch (error) {
        if (isAbortLike(error)) throw error;
        if (!shouldRotateKey(error)) return undefined;
      }
    }
    return undefined;
  }

  /** Remove near-duplicate sources, keeping the first occurrence. */
  async dedupe(sources, threshold, signal) {
    if (sources.length < 2) return sources;
    const texts = sources.map((source) => {
      const title = typeof source.title === 'string' ? source.title : '';
      const excerpt = source.summary ?? source.snippet ?? '';
      return `${title}\n${excerpt}`.trim() || source.url;
    });
    const vectors = await this.embed(texts, signal);
    if (vectors === undefined) return sources;

    const kept = [];
    const keptVectors = [];
    for (let index = 0; index < sources.length; index += 1) {
      const vector = vectors[index];
      let duplicate = false;
      for (const previous of keptVectors) {
        if (cosine(vector, previous) >= threshold) {
          duplicate = true;
          break;
        }
      }
      if (!duplicate) {
        kept.push(sources[index]);
        keptVectors.push(vector);
      }
    }
    return kept;
  }
}
