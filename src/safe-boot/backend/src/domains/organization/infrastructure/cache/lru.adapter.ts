/**
 * LruCacheAdapter — Infrastructure Adapter for ICachePort
 *
 * In-memory LRU cache for organization profile caching.
 * Replaced with RedisAdapter in production, or NoopCache in tests.
 *
 * @traceability PAS-001 Port-010 (CachePort)
 */

import { ICachePort } from '../../ports/cache.port';

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class LruCacheAdapter implements ICachePort {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlMs: number = 300_000): Promise<void> {
    if (this.store.size >= this.maxSize) {
      // Evict oldest entry (first key)
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }

    this.store.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }

  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }
}
