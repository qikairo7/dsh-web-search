/** Multi-key provider wrapper with quota/rate failover. */

import { classifyFailure } from './errors.js';

const KEYED_METHODS = new Set([
  'search',
  'fetch',
  'searchAdvanced',
  'extractMany',
  'searchWithDomains',
  'latest',
  'hot',
]);

/** Failure classes that mean this key should be skipped for the next one. */
export function shouldRotateKey(error) {
  const failureClass = classifyFailure(error);
  return failureClass === 'quota' || failureClass === 'auth';
}

/** How long to keep a failed key out of the rotation. */
function restMilliseconds(error) {
  const status = error?.status ?? error?.cause?.status;
  if (status === 429) return 30_000;
  if (status === 402) return 20 * 60_000;
  return 30 * 60_000;
}

/**
 * Resolve the provider's primary reference and numbered key references.
 * @param {Function} resolveKey
 * @param {string} reference
 * @returns {Promise<string[]>}
 */
export async function resolveKeyCandidates(resolveKey, reference) {
  if (typeof resolveKey?.all === 'function') return resolveKey.all(reference);
  const value = await resolveKey?.(reference);
  return typeof value === 'string' && value.length > 0 ? [value] : [];
}

/**
 * Wrap one provider with a lazy set of per-key instances.
 *
 * @param {{
 *   provider: object,
 *   factory: (key: string) => object,
 *   resolveKeys: () => Promise<string[]>,
 * }} options
 * @returns {object}
 */
export function createMultiKeyProvider({ provider, factory, resolveKeys }) {
  const instances = new Map();
  const restingUntil = new Map();
  const instanceFor = (key) => {
    let instance = instances.get(key);
    if (instance === undefined) {
      instance = factory(key);
      instances.set(key, instance);
    }
    return instance;
  };

  const invoke = async (method, args) => {
    const keys = [...new Set(await resolveKeys())];
    if (keys.length === 0) return provider[method](...args);
    if (keys.length === 1) return instanceFor(keys[0])[method](...args);
    const now = Date.now();
    const readyKeys = keys.filter((key) => (restingUntil.get(key) ?? 0) <= now);
    // If every key is resting, try the whole ring again rather than failing
    // without a request.
    const candidates = readyKeys.length === 0 ? keys : readyKeys;
    let lastError;
    for (const key of candidates) {
      try {
        const result = await instanceFor(key)[method](...args);
        restingUntil.delete(key);
        return result;
      } catch (error) {
        if (!shouldRotateKey(error)) throw error;
        restingUntil.set(key, Date.now() + restMilliseconds(error));
        lastError = error;
      }
    }
    throw lastError;
  };

  return new Proxy(provider, {
    get(target, property, receiver) {
      if (property === 'ready') {
        return async () => {
          const keys = await resolveKeys();
          if (keys.length > 0) return true;
          return target.ready();
        };
      }
      // A keyed provider writes its own cooldown (for example GitHub's 403/429
      // Retry-After) on the per-key instance the call used, not on this primary
      // target. Read availability through the instantiated keys so the router
      // sees that cooldown and skips instead of hammering.
      if (property === 'available') {
        return () => (instances.size === 0
          ? target.available()
          : [...instances.values()].some((instance) => instance.available?.() ?? true));
      }
      if (typeof property === 'string' && KEYED_METHODS.has(property)) {
        return (...args) => invoke(property, args);
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
