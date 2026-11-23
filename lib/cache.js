/** Small in-memory TTL + LRU cache plus a per-capability policy wrapper. */

export class TtlLruCache {
  constructor() {
    this.entries = new Map();
  }

  get(key, ttlMs) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return undefined;
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (Date.now() - entry.at > ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value, maxEntries) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) return;
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { at: Date.now(), value });
    while (this.entries.size > maxEntries) {
      const oldest = this.entries.keys().next().value;
      this.entries.delete(oldest);
    }
  }

  clear() {
    this.entries.clear();
  }
}

/** Resolved-settings fields that control one capability's cache. */
const CAPABILITY_CACHE_FIELDS = {
  search: { ttlMs: 'searchCacheTtlMs', maxEntries: 'searchCacheMaxEntries' },
  fetch: { ttlMs: 'fetchCacheTtlMs', maxEntries: 'fetchCacheMaxEntries' },
};

/**
 * Capability-scoped result cache. Call sites hand over resolved settings and
 * only decide the cache key and whether a result is worth storing; TTL and
 * capacity come from this capability's `*CacheTtlMs` / `*CacheMaxEntries`.
 *
 * A capacity below 1 (including 0 and non-integers) disables writes: `write`
 * is a no-op while entries stored earlier in this process stay readable until
 * they expire. This class is the single owner of that rule.
 */
export class ResultCache {
  constructor(capability) {
    this.fields = CAPABILITY_CACHE_FIELDS[capability];
    if (this.fields === undefined) throw new TypeError(`unknown cache capability: ${capability}`);
    this.store = new TtlLruCache();
  }

  /** Return the cached value for `key`, or undefined when absent or expired. */
  read(key, settings) {
    return this.store.get(key, settings[this.fields.ttlMs]);
  }

  /** Store `value` at `key`; a no-op while this capability's capacity is below 1. */
  write(key, value, settings) {
    this.store.set(key, value, settings[this.fields.maxEntries]);
  }
}
