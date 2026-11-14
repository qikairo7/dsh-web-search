/** Small in-memory TTL + LRU cache. */

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
